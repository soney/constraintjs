/* constraintjs v0.10.2 (https://cjs.from.so/) | MIT License */
var cjs = (function() {

//#region src/scheduler.ts
	const queue = [];
	let batchDepth = 0;
	let running = false;
	/**
	* Tells the constraint solver to delay running any `onChange` listeners.
	*
	* Note that `signal` needs to be called the same number of times as `wait` before the listeners
	* will run.
	*
	* @example
	*     var x = cjs(1);
	*     x.onChange(function() {
	*         console.log('x changed');
	*     });
	*     cjs.wait();
	*     x.set(2);
	*     x.set(3);
	*     cjs.signal(); // output: x changed
	*/
	function wait() {
		batchDepth++;
	}
	/**
	* Tells the constraint solver it is ready to run any `onChange` listeners. `signal` needs to be
	* called the same number of times as `wait` before the listeners will run.
	*
	* @example
	*     var x = cjs(1);
	*     x.onChange(function() {
	*         console.log('x changed');
	*     });
	*     cjs.wait();
	*     cjs.wait();
	*     x.set(2);
	*     x.set(3);
	*     cjs.signal();
	*     cjs.signal(); // output: x changed
	*/
	function signal() {
		if (batchDepth > 0) batchDepth--;
		runQueuedListeners();
	}
	/** Whether we're inside a `wait()`/`signal()` batch. */
	function isBatching() {
		return batchDepth > 0;
	}
	/** Runs `fn` as a batch: listeners are held until it finishes. */
	function batch(fn) {
		wait();
		try {
			return fn();
		} finally {
			signal();
		}
	}
	/** Queues a listener to run (once, no matter how many times it's queued before it runs). */
	function enqueue(listener) {
		if (listener.queued) return;
		listener.queued = true;
		const { priority } = listener;
		const position = priority === false ? -1 : queue.findIndex((other) => other.priority === false || other.priority < priority);
		if (position < 0) queue.push(listener);
		else queue.splice(position, 0, listener);
	}
	/** Takes a listener out of the queue (if it's there). */
	function dequeue(listener) {
		if (!listener.queued) return;
		listener.queued = false;
		queue.splice(queue.indexOf(listener), 1);
	}
	/**
	* Runs every queued listener, unless we're inside a batch or already running them. Every listener
	* runs even if some throw; errors are rethrown afterwards (as an `AggregateError` if there are several).
	*/
	function runQueuedListeners() {
		if (running || batchDepth > 0) return;
		running = true;
		const errors = [];
		try {
			let listener;
			while (listener = queue.shift()) {
				listener.queued = false;
				try {
					listener.callback.apply(listener.context ?? globalThis, listener.args);
				} catch (error) {
					errors.push(error);
				}
			}
		} finally {
			running = false;
		}
		if (errors.length === 1) throw errors[0];
		if (errors.length > 1) throw new AggregateError(errors, "Multiple onChange listeners threw errors");
	}

//#endregion
//#region src/util.ts
/** The default equality check: `===`. */
	const defaultEquals = (a, b) => a === b;
	/**
	* Returned from a `forEach` callback (on array and map constraints) to stop iterating early.
	*/
	const BREAK = Object.freeze({});
	function isPositiveInteger(value) {
		return typeof value === "number" && Number.isInteger(value) && value >= 0;
	}
	function camelCase(name) {
		return name.replace(/^-ms-/, "ms-").replace(/-([a-z0-9])/gi, (_, letter) => letter.toUpperCase());
	}

//#endregion
//#region src/map-constraint.ts
	const defaultHash = (key) => String(key);
	/**
	* ***Note:*** the preferred way to create a map constraint is with `cjs({...})` or `cjs.map(options)`.
	*
	* Emulates a JavaScript object (or `Map`), but with constraints. Its entries are ordered, and its
	* keys can be anything (compared with `===` unless an `equals` option is given).
	*
	* @example
	*     var map = cjs({ x: 1 });
	*     var x_plus_one = cjs(function() { return map.get("x") + 1; });
	*     x_plus_one.get(); // 2
	*     map.put("x", 10);
	*     x_plus_one.get(); // 11
	*/
	var MapConstraint = class {
		/** Return this from a `forEach` callback to stop iterating. */
		static BREAK = BREAK;
		_hash;
		_valueHash;
		_literalValues;
		_createUnsubstantiated;
		_equalityCheck;
		_valueEqualityCheck;
		/** The entries, in order */
		_entryList;
		/** Entries grouped by the hash of their keys */
		_keyBuckets = /* @__PURE__ */ new Map();
		/** Entries grouped by the hash of their values (only if values are hashed) */
		_valueBuckets;
		/**
		* Placeholder entries for keys that were read before they were set (grouped by key hash), so
		* that whatever read them is notified when they're added
		*/
		_placeholders = /* @__PURE__ */ new Map();
		_keysView;
		_valuesView;
		_entriesView;
		_sizeView;
		constructor(options) {
			const { hash = defaultHash, valuehash = false, equals = defaultEquals, valueequals = defaultEquals, value = {}, keys = [], values = [], literal_values = false, create_unsubstantiated = true } = options ?? {};
			this._hash = toHashFunction(hash);
			this._valueHash = valuehash ? toHashFunction(valuehash === true ? defaultHash : valuehash) : void 0;
			this._valueBuckets = this._valueHash ? /* @__PURE__ */ new Map() : void 0;
			this._literalValues = !!literal_values;
			this._createUnsubstantiated = create_unsubstantiated;
			this._equalityCheck = new Constraint(equals, { literal: true });
			this._valueEqualityCheck = new Constraint(valueequals, { literal: true });
			const initialKeys = [...keys];
			const initialValues = [...values];
			const givenKeys = new Set(initialKeys.map(String));
			for (const [key, entryValue] of Object.entries(value)) if (!givenKeys.has(key)) {
				initialKeys.push(key);
				initialValues.push(entryValue);
			}
			this._entryList = initialKeys.map((key, index) => {
				const entry = this._createEntry(key, initialValues[index], index, this._literalValues);
				addToBucket(this._keyBuckets, this._hash(key), entry);
				if (this._valueBuckets) addToBucket(this._valueBuckets, this._valueHash(initialValues[index]), entry);
				return entry;
			});
			this._keysView = new Constraint(() => {
				const result = [];
				this.forEach((_, key, index) => {
					result[index] = key;
				});
				return result;
			});
			this._valuesView = new Constraint(() => {
				const result = [];
				this.forEach((entryValue, _, index) => {
					result[index] = entryValue;
				});
				return result;
			});
			this._entriesView = new Constraint(() => {
				const result = [];
				this.forEach((entryValue, key, index) => {
					result[index] = {
						key,
						value: entryValue
					};
				});
				return result;
			});
			this._sizeView = new Constraint(() => this._entryList.length);
		}
		/**
		* The keys, in order.
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.keys(); // ['x','y']
		*/
		keys() {
			return this._keysView.get();
		}
		/**
		* The values, in order.
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.values(); // [1,2]
		*/
		values() {
			return this._valuesView.get();
		}
		/**
		* Every entry, in order, as `{key, value}` objects.
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.entries(); // [{key:'x',value:1}, {key:'y',value:2}]
		*/
		entries() {
			return this._entriesView.get();
		}
		/**
		* The number of entries.
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.size(); // 2
		*/
		size() {
			return this._sizeView.get();
		}
		/**
		* Whether there are no entries.
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.isEmpty(); // false
		*/
		isEmpty() {
			return this.size() === 0;
		}
		/**
		* Sets the value for `key` (like `this[key] = value`).
		*
		* @param index - Where to put the entry (default: at the end for a new key; unchanged for an existing one)
		* @param literal - For a new key, whether to treat a function value as the value itself
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.put("z", 3, 1);
		*     map.keys(); // ['x','z','y']
		*/
		put(key, value, index, literal) {
			batch(() => {
				const { hash, entry } = this._find(key);
				if (entry) this._update(entry, value, index);
				else this._insert(hash, key, value, index, literal);
			});
			return this;
		}
		/**
		* Removes the entry for `key` (like `delete this[key]`).
		*
		* @param silent - If `true`, don't invalidate the constraints that depended on the entry
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.remove("x");
		*     map.keys(); // ['y']
		*/
		remove(key, silent) {
			const { hash, entry } = this._find(key);
			if (!entry) return this;
			batch(() => {
				removeFromBucket(this._keyBuckets, hash, entry);
				if (this._valueBuckets) removeFromBucket(this._valueBuckets, this._valueHash(entry.value.get(false)), entry);
				const index = entry.index.get(false);
				this._entryList.splice(index, 1);
				destroyEntry(entry, silent);
				this._reindex(index);
				if (!silent) this._invalidateViews();
			});
			return this;
		}
		/**
		* The value for `key` (like `this[key]`), or `undefined`.
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.get("x"); // 1
		*/
		get(key) {
			const { hash, entry } = this._find(key);
			if (entry) return entry.value.get();
			if (!this._createUnsubstantiated) return void 0;
			return this._placeholder(hash, key, true).value.get();
		}
		item(...args) {
			if (args.length === 0) return this.toObject();
			if (args.length === 1) return this.get(args[0]);
			return this.put(args[0], args[1], args[2]);
		}
		/**
		* A constraint whose value is the value for `key` (which can itself be a constraint).
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     var x_val = map.itemConstraint('x');
		*     x_val.get(); // 1
		*     map.item('x', 3);
		*     x_val.get(); // 3
		*/
		itemConstraint(key) {
			return new Constraint(() => this.get(get(key)));
		}
		/**
		* Removes every entry.
		*
		* @param silent - If `true`, don't invalidate the constraints that depended on the entries
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.clear();
		*     map.isEmpty(); // true
		*/
		clear(silent) {
			if (this._entryList.length === 0) return this;
			batch(() => {
				for (const entry of this._entryList) destroyEntry(entry, silent);
				this._entryList = [];
				this._keyBuckets.clear();
				this._valueBuckets?.clear();
				if (!silent) this._invalidateViews();
			});
			return this;
		}
		/**
		* Calls `callback` with the value, key, and index of every entry, in order. Return
		* `cjs.MapConstraint.BREAK` from it to stop.
		*
		* @param thisArg - The `this` for `callback` (default: this map constraint)
		*
		* @example
		*     var map = cjs({x:1,y:2,z:3});
		*     map.forEach(function(val, key) {
		*         console.log(key+':'+val);
		*         if(key === 'y') {
		*             return cjs.MapConstraint.BREAK;
		*         }
		*     }); // x:1 ... y:2
		*/
		forEach(callback, thisArg = this) {
			const size = this.size();
			const entries = this._entryList.slice();
			for (let i = 0; i < size; i++) {
				const entry = entries[i];
				if (entry && callback.call(thisArg, entry.value.get(), entry.key.get(), entry.index.get()) === BREAK) break;
			}
			return this;
		}
		/** Change how keys are compared. */
		setEqualityCheck(equalityCheck) {
			this._equalityCheck.set(equalityCheck);
			return this;
		}
		/** Change how values are compared (for `keyForValue`). */
		setValueEqualityCheck(equalityCheck) {
			this._valueEqualityCheck.set(equalityCheck);
			return this;
		}
		/** Change how keys are hashed: a function, or the name of a method to call on each key. */
		setHash(hash) {
			this._hash = toHashFunction(hash);
			const hashKey = (entry) => this._hash(entry.key.get(false));
			this._keyBuckets = groupByHash(this._entryList, hashKey);
			this._placeholders = groupByHash([...this._placeholders.values()].flat(), hashKey);
			return this;
		}
		/** Change how values are hashed (see the `valuehash` option); `false` turns value hashing off. */
		setValueHash(hash) {
			const valueHash = hash ? toHashFunction(hash === true ? defaultHash : hash) : void 0;
			this._valueHash = valueHash;
			this._valueBuckets = valueHash ? groupByHash(this._entryList, (entry) => valueHash(entry.value.get(false))) : void 0;
			return this;
		}
		/**
		* The index of the entry for `key`, or `-1`.
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.indexOf('y'); // 1
		*     map.indexOf('z'); // -1
		*/
		indexOf(key) {
			const { hash, entry } = this._find(key);
			if (entry) return entry.index.get();
			if (!this._createUnsubstantiated) return -1;
			return this._placeholder(hash, key, true).index.get();
		}
		/**
		* The value for `key`; if there isn't one, sets it to `create(key)` first.
		*
		* @param context - The `this` for `create` (default: this map constraint)
		* @param index - Where to put a new entry (default: at the end)
		* @param literal - For a new entry, whether to treat a function value as the value itself
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.getOrPut('z', function() {
		*         console.log("evaluating");
		*         return 3;
		*     }); // output: 'evaluating'
		*     // 3
		*     map.getOrPut('z', function() {
		*         console.log("evaluating");
		*         return 3;
		*     }); // (no output)
		*     // 3
		*/
		getOrPut(key, create, context, index, literal) {
			const { entry } = this._find(key);
			if (entry) return entry.value.get();
			return batch(() => {
				const value = create.call(context ?? this, key);
				this.put(key, value, index, literal);
				return value;
			});
		}
		/**
		* Whether there is an entry for `key`.
		*
		* @example
		*     var map = cjs({x: 1, y: 2});
		*     map.has('x'); // true
		*/
		has(key) {
			const { hash, entry } = this._find(key);
			if (entry) return true;
			if (this._createUnsubstantiated) this._placeholder(hash, key, true).index.get();
			return false;
		}
		/**
		* Moves the entry at `oldIndex` to `newIndex`.
		*
		* @example
		*     var map = cjs({x: 1, y: 2, z: 3});
		*     map.moveIndex(1, 0);
		*     map.keys(); // ['y','x','z']
		*/
		moveIndex(oldIndex, newIndex) {
			batch(() => this._move(oldIndex, newIndex));
			return this;
		}
		/**
		* Moves the entry for `key` to `index`.
		*
		* @example
		*     var map = cjs({x: 1, y: 2, z: 3});
		*     map.move('z', 0);
		*     map.keys(); // ['z','x','y']
		*/
		move(key, index) {
			const { entry } = this._find(key);
			if (entry) this.moveIndex(entry.index.get(false), index);
			return this;
		}
		/**
		* The key of an entry whose value is `value` (or `undefined`).
		*
		* @param equalityCheck - How to compare values (default: this map's value equality check)
		*
		* @example
		*     var map = cjs({x: 1, y: 2, z: 3});
		*     map.keyForValue(1); // 'x'
		*/
		keyForValue(value, equalityCheck) {
			const equals = equalityCheck ?? this._valueEqualityCheck.get();
			if (this._valueHash && this._valueBuckets) return this._valueBuckets.get(this._valueHash(value))?.find((entry) => equals(entry.value.get(), value))?.key.get();
			let found;
			this.forEach((candidate, key) => {
				if (!equals(value, candidate)) return void 0;
				found = key;
				return BREAK;
			});
			return found;
		}
		/**
		* Clears this map and cleans up its constraints.
		*
		* @param silent - If `true`, don't invalidate the constraints that depended on it
		*/
		destroy(silent) {
			batch(() => {
				this.clear(silent);
				for (const placeholders of this._placeholders.values()) for (const entry of placeholders) destroyEntry(entry, silent);
				this._placeholders.clear();
				for (const constraint of [
					this._equalityCheck,
					this._valueEqualityCheck,
					this._keysView,
					this._valuesView,
					this._entriesView,
					this._sizeView
				]) constraint.destroy(silent);
			});
		}
		/**
		* A plain object with this map's entries.
		*
		* @param keyMap - Converts each key to a property name (default: the key itself)
		*
		* @example
		*     var map = cjs({x: 1, y: 2, z: 3});
		*     map.toObject(); // {x:1,y:2,z:3}
		*/
		toObject(keyMap = (key) => key) {
			const result = {};
			this.forEach((value, key) => {
				result[keyMap(key)] = value;
			});
			return result;
		}
		_createEntry(key, value, index, literal) {
			return {
				key: new Constraint(key, { literal: true }),
				value: new Constraint(value, { literal }),
				index: new Constraint(index, { literal: true })
			};
		}
		_find(key) {
			const hash = this._hash(key);
			const equals = this._equalityCheck.get();
			return {
				hash,
				entry: this._keyBuckets.get(hash)?.find((candidate) => equals(candidate.key.get(), key))
			};
		}
		_placeholder(hash, key, create) {
			const equals = this._equalityCheck.get();
			let entry = this._placeholders.get(hash)?.find((candidate) => equals(candidate.key.get(), key));
			if (!entry && create) {
				entry = this._createEntry(key, void 0, -1, this._literalValues);
				addToBucket(this._placeholders, hash, entry);
			}
			return entry;
		}
		_update(entry, value, index) {
			if (this._valueHash && this._valueBuckets) {
				removeFromBucket(this._valueBuckets, this._valueHash(entry.value.get(false)), entry);
				addToBucket(this._valueBuckets, this._valueHash(value), entry);
			}
			entry.value.set(value);
			if (isPositiveInteger(index)) this._move(entry.index.get(false), index);
			this._valuesView.invalidate();
			this._entriesView.invalidate();
		}
		_insert(hash, key, value, index, literal) {
			const size = this._entryList.length;
			const position = isPositiveInteger(index) ? Math.min(index, size) : size;
			const placeholder = this._placeholder(hash, key, false);
			if (placeholder) removeFromBucket(this._placeholders, hash, placeholder);
			const entry = placeholder ?? this._createEntry(key, value, position, literal ?? this._literalValues);
			addToBucket(this._keyBuckets, hash, entry);
			if (this._valueHash && this._valueBuckets) addToBucket(this._valueBuckets, this._valueHash(value), entry);
			this._entryList.splice(position, 0, entry);
			if (placeholder) {
				entry.value.set(value);
				entry.index.set(position);
			}
			this._reindex(position + 1);
			this._invalidateViews();
		}
		_move(from, to) {
			const size = this._entryList.length;
			if (!isPositiveInteger(from) || from >= size || !isPositiveInteger(to)) return;
			const target = Math.min(to, size - 1);
			if (target === from) return;
			const [entry] = this._entryList.splice(from, 1);
			this._entryList.splice(target, 0, entry);
			for (let i = Math.min(from, target); i <= Math.max(from, target); i++) this._entryList[i].index.set(i);
			this._keysView.invalidate();
			this._valuesView.invalidate();
			this._entriesView.invalidate();
		}
		_reindex(start) {
			for (let i = start; i < this._entryList.length; i++) this._entryList[i].index.set(i);
		}
		_invalidateViews() {
			this._sizeView.invalidate();
			this._keysView.invalidate();
			this._valuesView.invalidate();
			this._entriesView.invalidate();
		}
	};
	/**
	* Whether `value` is a map constraint.
	*/
	function isMapConstraint(value) {
		return value instanceof MapConstraint;
	}
	function toHashFunction(hash) {
		if (typeof hash === "string") return (key) => String(key[hash]());
		return (key) => String(hash(key));
	}
	function addToBucket(buckets, hash, entry) {
		const bucket = buckets.get(hash);
		if (bucket) bucket.push(entry);
		else buckets.set(hash, [entry]);
	}
	function removeFromBucket(buckets, hash, entry) {
		const bucket = buckets.get(hash);
		if (!bucket) return;
		const index = bucket.indexOf(entry);
		if (index >= 0) bucket.splice(index, 1);
		if (bucket.length === 0) buckets.delete(hash);
	}
	function groupByHash(entries, hash) {
		const buckets = /* @__PURE__ */ new Map();
		for (const entry of entries) addToBucket(buckets, hash(entry), entry);
		return buckets;
	}
	function destroyEntry(entry, silent) {
		entry.key.destroy(silent);
		entry.value.destroy(silent);
		entry.index.destroy(silent);
	}

//#endregion
//#region src/get.ts
	function get(value, autoAddOutgoing) {
		if (value instanceof Constraint) return value.get(autoAddOutgoing);
		if (value instanceof ArrayConstraint) return value.toArray();
		if (value instanceof MapConstraint) return value.toObject();
		return value;
	}

//#endregion
//#region src/operators.ts
	const unaryOperators$1 = {
		"+": (a) => +a,
		"-": (a) => -a,
		"~": (a) => ~a,
		"!": (a) => !a
	};
	const binaryOperators = {
		"===": (a, b) => a === b,
		"!==": (a, b) => a !== b,
		"==": (a, b) => a == b,
		"!=": (a, b) => a != b,
		">": (a, b) => a > b,
		">=": (a, b) => a >= b,
		"<": (a, b) => a < b,
		"<=": (a, b) => a <= b,
		"+": (a, b) => a + b,
		"-": (a, b) => a - b,
		"*": (a, b) => a * b,
		"/": (a, b) => a / b,
		"%": (a, b) => a % b,
		"^": (a, b) => a ^ b,
		"&": (a, b) => a & b,
		"|": (a, b) => a | b,
		"<<": (a, b) => a << b,
		">>": (a, b) => a >> b,
		">>>": (a, b) => a >>> b,
		"&&": (a, b) => a && b,
		"||": (a, b) => a || b
	};

//#endregion
//#region src/constraint.ts
	let nextId$1 = 0;
	/** The constraints whose values are being computed right now, innermost last. */
	const evaluationStack = [];
	/** Set when a constraint calls `pauseGetter()` while computing its value. */
	let pendingPause;
	/** Whether an invalidation is in progress (invalidations can trigger nested ones). */
	let invalidating = false;
	/** Constraints recomputed by `check_on_nullify` during the current invalidation (guards against loops). */
	const rechecked = /* @__PURE__ */ new Set();
	/**
	* ***Note***: the preferred way to create a constraint is with `cjs(value)` or `cjs.constraint(value)`.
	*
	* A constraint communicates with the constraint solver to store and maintain a value. Its value can
	* be a plain value, a function that computes it (whose dependencies are tracked automatically), or
	* another constraint to follow.
	*
	* @example
	*     var x = cjs(1),
	*         y = cjs(function() { return x.get() + 1; });
	*     y.get(); // 2
	*     x.set(10);
	*     y.get(); // 11
	*/
	var Constraint = class Constraint {
		/** @internal */ _id = nextId$1++;
		/** @internal The constraints that read my value, by id */
		_outEdges = void 0;
		/** @internal The constraints whose values I read, by id */
		_inEdges = void 0;
		/** @internal Incremented every time I compute my value */
		_timestamp = 0;
		/** @internal Whether my cached value is up to date */
		_valid;
		/**
		* @internal Whether I became invalid without telling my dependents and listeners (because my getter
		* threw, or because of a silent `set`). The next change to anything I read has to tell them.
		*/
		_silentlyInvalid = false;
		_options;
		_value;
		_cachedValue;
		_listeners = void 0;
		/** Set while waiting for `resumeGetter()` */
		_paused;
		/** Set when `resumeGetter()` was called before my getter even returned */
		_syncResume;
		/**
		* @param value - The initial value, a function to compute it, or a constraint to follow
		* @param options - How the value is computed and tracked
		*/
		constructor(value, options) {
			this._options = {
				context: globalThis,
				...options
			};
			this._value = value;
			this._valid = isPlainValue(value, this._options);
			this._cachedValue = this._valid ? value : void 0;
		}
		/**
		* Get the current value of this constraint, recomputing it first if it is invalid.
		*
		* @param autoAddOutgoing - Whether a constraint that is computing its value right now should
		*     start depending on this one (default: `true`)
		* @param getterArg - Passed as the second argument to this constraint's getter function, if it recomputes
		* @see set
		*
		* @example
		*     var x = cjs(1);
		*     x.get(); // 1
		*/
		get(autoAddOutgoing, getterArg) {
			this._recordDependency(autoAddOutgoing !== false);
			if (!this._valid && !this._paused) {
				this._timestamp++;
				this._valid = true;
				this._silentlyInvalid = false;
				evaluationStack.push(this);
				try {
					const source = this._value;
					if (this._options.cache_value === false) {
						if (typeof source === "function") source.call(this._options.context);
						if (pendingPause?.constraint === this) pendingPause = void 0;
					} else {
						const value = this._options.literal ? source : typeof source === "function" ? source.call(this._options.context ?? this, this, getterArg) : source instanceof Constraint ? source.get() : source;
						if (this._syncResume) {
							this._cachedValue = this._resolve(this._syncResume.value);
							this._syncResume = void 0;
						} else if (pendingPause?.constraint === this) {
							this._paused = pendingPause;
							pendingPause = void 0;
						} else this._cachedValue = value;
					}
				} catch (error) {
					this._valid = false;
					this._silentlyInvalid = true;
					if (pendingPause?.constraint === this) pendingPause = void 0;
					this._syncResume = void 0;
					throw error;
				} finally {
					evaluationStack.pop();
				}
			}
			return this._paused ? this._paused.temporaryValue : this._cachedValue;
		}
		/**
		* Change the value of this constraint. Anything that depends on it is invalidated.
		*
		* @param value - The new value, a function to compute it, or a constraint to follow
		* @param options - `silent: true` updates the value without invalidating anything that depends on it
		* @see get
		* @see invalidate
		*
		* @example
		*    var x = cjs(1);
		*    x.get(); // 1
		*    x.set(function() { return 2; });
		*    x.get(); // 2
		*    x.set('c');
		*    x.get(); // 'c'
		*/
		set(value, options) {
			const previous = this._value;
			this._value = value;
			if (options?.silent) {
				if (this._valid) {
					this._valid = false;
					this._silentlyInvalid = true;
				}
				return this;
			}
			if (isPlainValue(value, this._options) ? !(this._options.equals ?? defaultEquals)(previous, value) : previous !== value) invalidateAll([this]);
			return this;
		}
		setOption(keyOrOptions, value) {
			const changes = typeof keyOrOptions === "string" ? { [keyOrOptions]: value } : keyOrOptions;
			Object.assign(this._options, changes);
			return Object.hasOwn(changes, "context") || Object.hasOwn(changes, "literal") ? this.invalidate() : this;
		}
		/**
		* Mark this constraint's value as invalid, so that it is recomputed the next time it's read.
		* Anything that depends on it is invalidated too.
		*
		* @see isValid
		*
		* @example Tracking the window height
		*     var height = cjs(function() { return window.innerHeight; });
		*     window.addEventListener("resize", function() {
		*         height.invalidate();
		*     });
		*/
		invalidate() {
			invalidateAll([this]);
			return this;
		}
		/**
		* Whether this constraint's cached value is up to date. An invalid value is only recomputed
		* when it's next read (for example, with `.get()`).
		*
		* @see invalidate
		*
		* @example
		*     var x = cjs(1),
		*         y = x.add(2);
		*     y.get();     // 3
		*     y.isValid(); // true
		*     x.set(2);
		*     y.isValid(); // false
		*     y.get();     // 4
		*     y.isValid(); // true
		*/
		isValid() {
			return this._valid;
		}
		/**
		* Removes every dependency to and from this constraint.
		*
		* @param silent - If `true`, don't invalidate the constraints that depended on this one
		* @see destroy
		*/
		remove(silent) {
			this._inEdges?.forEach((edge) => edge.from._outEdges?.delete(this._id));
			this._inEdges = void 0;
			const dependents = [];
			this._collectDependents(dependents);
			this._outEdges?.forEach((edge) => edge.to._inEdges?.delete(this._id));
			this._outEdges = void 0;
			if (!silent) invalidateAll(dependents);
			this._valid = false;
			this._silentlyInvalid = false;
			this._cachedValue = void 0;
			return this;
		}
		/**
		* Removes every dependency and change listener, so that this constraint can be garbage collected.
		*
		* @param silent - If `true`, don't invalidate the constraints that depended on this one
		* @see remove
		*
		* @example
		*     var x = cjs(1);
		*     x.destroy(); // ...x is no longer needed
		*/
		destroy(silent) {
			this._listeners?.forEach(dequeue);
			this._listeners = void 0;
			this.remove(silent);
			return this;
		}
		/**
		* Signal that this constraint's value will be computed later (for example, asynchronously).
		* Until `resumeGetter` is called, `get()` returns `temporaryValue`. Call this from inside the
		* constraint's getter function.
		*
		* @see resumeGetter
		*
		* @example
		*     var data = cjs(function(node) {
		*         node.pauseGetter("loading...");
		*         fetchData(function(result) {
		*             node.resumeGetter(result);
		*         });
		*     });
		*/
		pauseGetter(temporaryValue) {
			pendingPause = {
				constraint: this,
				temporaryValue
			};
			return this;
		}
		/**
		* Signal that this constraint, which was paused with `pauseGetter`, now has a value.
		*
		* @see pauseGetter
		*/
		resumeGetter(value) {
			if (pendingPause?.constraint === this) {
				pendingPause = void 0;
				this._syncResume = { value };
				return this;
			}
			this._paused = void 0;
			this._valid = true;
			const outerStack = evaluationStack.splice(0);
			evaluationStack.push(this);
			try {
				if (this._options.cache_value !== false) this._cachedValue = this._resolve(value);
				else if (typeof value === "function") value.call(this._options.context);
			} finally {
				evaluationStack.length = 0;
				evaluationStack.push(...outerStack);
			}
			const dependents = [];
			this._collectDependents(dependents);
			invalidateAll(dependents);
			return this;
		}
		/**
		* Call `callback` when this constraint's value is invalidated. If it is invalidated several
		* times before listeners run (for example, in a `cjs.wait()` batch), `callback` is only called once.
		*
		* @param thisArg - The `this` for `callback` (default: the global object)
		* @param args - Arguments to pass to `callback`
		* @see offChange
		*
		* @example
		*     var x = cjs(1);
		*     x.onChange(function() {
		*         console.log("x is " + x.get());
		*     });
		*     x.set(2); // x is 2
		*/
		onChange(callback, thisArg, ...args) {
			return this.onChangeWithPriority(false, callback, thisArg, ...args);
		}
		/**
		* Like `onChange`, but listeners with a higher `priority` are called before those with a lower
		* one (or none).
		*/
		onChangeWithPriority(priority, callback, thisArg, ...args) {
			(this._listeners ??= []).push({
				callback,
				context: thisArg,
				args,
				priority: typeof priority === "number" ? priority : false,
				queued: false
			});
			if (this._options.run_on_add_listener !== false) this.get(false);
			return this;
		}
		/**
		* Removes the most recently added listener for `callback`. If `thisArg` is given, only a
		* listener that was added with that `thisArg` is removed.
		*
		* @see onChange
		*
		* @example
		*     var x = cjs(1),
		*         callback = function() {};
		*     x.onChange(callback);
		*     // ...
		*     x.offChange(callback);
		*/
		offChange(callback, thisArg) {
			const listeners = this._listeners ?? [];
			for (let i = listeners.length - 1; i >= 0; i--) {
				const listener = listeners[i];
				if (listener.callback === callback && (!thisArg || listener.context === thisArg)) {
					listeners.splice(i, 1);
					dequeue(listener);
					break;
				}
			}
			return this;
		}
		/**
		* Change this constraint's value depending on the state of an FSM.
		*
		* @param values - For each state name, the value this constraint should have in that state
		*
		* @example
		*     var fsm = cjs.fsm("state1", "state2")
		*                  .addTransition("state1", "state2", cjs.on("click"));
		*     var x = cjs().inFSM(fsm, {
		*         state1: 'val1',
		*         state2: function() { return 'val2'; }
		*     });
		*/
		inFSM(fsm, values) {
			for (const [state, value] of Object.entries(values)) {
				fsm.on(state, () => this.set(value));
				if (fsm.is(state)) this.set(value);
			}
			return this;
		}
		/**
		* `false` if this or any of `args` is falsy; otherwise the last value. Evaluation stops at the
		* first falsy value (so, for example, `cjs(false).and(a)` never reads `a`).
		*
		* @example
		*     var x = c1.and(c2, c3, true);
		*/
		and(...args) {
			const values = [this, ...args];
			return new Constraint(() => {
				let value;
				for (const arg of values) {
					value = get(arg);
					if (!value) return false;
				}
				return value;
			});
		}
		/**
		* The first truthy value out of this and `args`, or `false` if none are. Evaluation stops at
		* the first truthy value (so, for example, `cjs(true).or(b)` never reads `b`).
		*
		* @example
		*     var x = c1.or(c2, c3, false);
		*/
		or(...args) {
			const values = [this, ...args];
			return new Constraint(() => {
				for (const arg of values) {
					const value = get(arg);
					if (value) return value;
				}
				return false;
			});
		}
		/**
		* Inline if, like `this ? trueValue : otherValue`.
		*
		* @example
		*     var x = is_selected.iif(selected_val, nonselected_val);
		*/
		iif(trueValue, otherValue) {
			return new Constraint(() => this.get() ? get(trueValue) : get(otherValue));
		}
		/**
		* A property of this constraint's value, like `this[names[0]][names[1]]...`.
		*
		* @example
		*     w = x.prop("y", "z"); // w <- x.y.z
		*/
		prop(...names) {
			return derive([this, ...names], (object, ...keys) => keys.reduce((value, key) => value == null ? void 0 : value[key], object));
		}
		/**
		* `parseInt(this, radix)`
		*
		* @example Given an `<input />` element `inp_elem`
		*     var inp_val = cjs(inp_elem).toInt();
		*/
		toInt(radix) {
			return derive([this, radix], parseInt);
		}
		/**
		* `parseFloat(this)`
		*
		* @example Given an `<input />` element `inp_elem`
		*     var inp_val = cjs(inp_elem).toFloat();
		*/
		toFloat() {
			return derive([this], parseFloat);
		}
		/**
		* `this + args[0] + args[1] + ...`. Also concatenates strings, which is handy for units.
		*
		* @example
		*     x = y.add(1, 2, z); // x <- y + 1 + 2 + z
		*     x = y.add("px");    // x <- y + "px"
		*/
		add(...args) {
			return derive([this, ...args], (first, ...rest) => rest.reduce(binaryOperators["+"], first));
		}
		/**
		* `this - args[0] - args[1] - ...`
		*
		* @example
		*     x = y.sub(1, 2, z); // x <- y - 1 - 2 - z
		*/
		sub(...args) {
			return derive([this, ...args], (first, ...rest) => rest.reduce(binaryOperators["-"], first));
		}
		/**
		* `this * args[0] * args[1] * ...`
		*
		* @example
		*     x = y.mul(1, 2, z); // x <- y * 1 * 2 * z
		*/
		mul(...args) {
			return derive([this, ...args], (first, ...rest) => rest.reduce(binaryOperators["*"], first));
		}
		/**
		* `this / args[0] / args[1] / ...`
		*
		* @example
		*     x = y.div(1, 2, z); // x <- y / 1 / 2 / z
		*/
		div(...args) {
			return derive([this, ...args], (first, ...rest) => rest.reduce(binaryOperators["/"], first));
		}
		/** `Math.abs(this)` */
		abs() {
			return derive([this], Math.abs);
		}
		/**
		* `Math.acos(this)`
		*
		* @example
		*     angle = r.div(x).acos();
		*/
		acos() {
			return derive([this], Math.acos);
		}
		/**
		* `Math.asin(this)`
		*
		* @example
		*     angle = r.div(y).asin();
		*/
		asin() {
			return derive([this], Math.asin);
		}
		/**
		* `Math.atan(this)`
		*
		* @example
		*     angle = y.div(x).atan();
		*/
		atan() {
			return derive([this], Math.atan);
		}
		/**
		* `Math.atan2(this, x)`
		*
		* @example
		*     angle = y.atan2(x);
		*/
		atan2(x) {
			return derive([this, x], Math.atan2);
		}
		/**
		* `Math.cos(this)`
		*
		* @example
		*     dx = r.mul(angle.cos());
		*/
		cos() {
			return derive([this], Math.cos);
		}
		/**
		* `Math.sin(this)`
		*
		* @example
		*     dy = r.mul(angle.sin());
		*/
		sin() {
			return derive([this], Math.sin);
		}
		/** `Math.tan(this)` */
		tan() {
			return derive([this], Math.tan);
		}
		/**
		* The largest of this and `args`: `Math.max(this, ...args)`
		*
		* @example
		*     val = val1.max(val2, val3);
		*/
		max(...args) {
			return derive([this, ...args], Math.max);
		}
		/**
		* The smallest of this and `args`: `Math.min(this, ...args)`
		*
		* @example
		*     val = val1.min(val2, val3);
		*/
		min(...args) {
			return derive([this, ...args], Math.min);
		}
		/**
		* `Math.pow(this, exponent)`
		*
		* @example
		*     d = dx.pow(2).add(dy.pow(2)).sqrt();
		*/
		pow(exponent) {
			return derive([this, exponent], Math.pow);
		}
		/** `Math.round(this)` */
		round() {
			return derive([this], Math.round);
		}
		/** `Math.floor(this)` */
		floor() {
			return derive([this], Math.floor);
		}
		/** `Math.ceil(this)` */
		ceil() {
			return derive([this], Math.ceil);
		}
		/** `Math.sqrt(this)` */
		sqrt() {
			return derive([this], Math.sqrt);
		}
		/**
		* The natural logarithm, `Math.log(this)`
		*
		* @example
		*     num_digits = num.max(2).log().div(Math.log(10)).ceil();
		*/
		log() {
			return derive([this], Math.log);
		}
		/** e to the power of this, `Math.exp(this)` */
		exp() {
			return derive([this], Math.exp);
		}
		/**
		* Converts to a number: `+this`
		*
		* @example
		*     numeric_val = val.pos();
		*/
		pos() {
			return derive([this], unaryOperators$1["+"]);
		}
		/**
		* `-this`
		*
		* @example
		*     neg_val = x.neg();
		*/
		neg() {
			return derive([this], unaryOperators$1["-"]);
		}
		/**
		* `!this`
		*
		* @example
		*     opposite = x.not();
		*/
		not() {
			return derive([this], unaryOperators$1["!"]);
		}
		/**
		* `~this`
		*
		* @example
		*     inverseBits = val.bitwiseNot();
		*/
		bitwiseNot() {
			return derive([this], unaryOperators$1["~"]);
		}
		/**
		* `this == other`
		*
		* @example
		*     isNull = val.eq(null);
		*/
		eq(other) {
			return derive([this, other], binaryOperators["=="]);
		}
		/**
		* `this != other`
		*
		* @example
		*     notNull = val.neq(null);
		*/
		neq(other) {
			return derive([this, other], binaryOperators["!="]);
		}
		/**
		* `this === other`
		*
		* @example
		*     isOne = val.eqStrict(1);
		*/
		eqStrict(other) {
			return derive([this, other], binaryOperators["==="]);
		}
		/**
		* `this !== other`
		*
		* @example
		*     notOne = val.neqStrict(1);
		*/
		neqStrict(other) {
			return derive([this, other], binaryOperators["!=="]);
		}
		/**
		* `this > other`
		*
		* @example
		*     isPositive = val.gt(0);
		*/
		gt(other) {
			return derive([this, other], binaryOperators[">"]);
		}
		/**
		* `this < other`
		*
		* @example
		*     isNegative = val.lt(0);
		*/
		lt(other) {
			return derive([this, other], binaryOperators["<"]);
		}
		/**
		* `this >= other`
		*
		* @example
		*     isBig = val.ge(100);
		*/
		ge(other) {
			return derive([this, other], binaryOperators[">="]);
		}
		/**
		* `this <= other`
		*
		* @example
		*     isSmall = val.le(100);
		*/
		le(other) {
			return derive([this, other], binaryOperators["<="]);
		}
		/** `this ^ other` */
		xor(other) {
			return derive([this, other], binaryOperators["^"]);
		}
		/** `this & other` */
		bitwiseAnd(other) {
			return derive([this, other], binaryOperators["&"]);
		}
		/** `this | other` */
		bitwiseOr(other) {
			return derive([this, other], binaryOperators["|"]);
		}
		/**
		* `this % other`
		*
		* @example
		*     isEven = x.mod(2).eq(0);
		*/
		mod(other) {
			return derive([this, other], binaryOperators["%"]);
		}
		/** `this >> other` */
		rightShift(other) {
			return derive([this, other], binaryOperators[">>"]);
		}
		/** `this << other` */
		leftShift(other) {
			return derive([this, other], binaryOperators["<<"]);
		}
		/** `this >>> other` */
		unsignedRightShift(other) {
			return derive([this, other], binaryOperators[">>>"]);
		}
		/**
		* `typeof this`
		*
		* @example
		*     var valIsNumber = val.typeOf().eq('number');
		*/
		typeOf() {
			return derive([this], (value) => typeof value);
		}
		/**
		* `this instanceof other`
		*
		* @example
		*     var valIsArray = val.instanceOf(Array);
		*/
		instanceOf(other) {
			return derive([this, other], (value, type) => value instanceof type);
		}
		/** @internal Queues my change listeners to run. */
		_enqueueListeners() {
			this._listeners?.forEach(enqueue);
		}
		/**
		* @internal Adds the constraints that still depend on me to `dependents`, dropping dependencies
		* that are no longer used.
		*/
		_collectDependents(dependents) {
			const edges = this._outEdges;
			if (!edges) return;
			for (const edge of edges.values()) if (edge.timestamp < edge.to._timestamp) {
				edges.delete(edge.to._id);
				edge.to._inEdges?.delete(this._id);
			} else dependents.push(edge.to);
		}
		/**
		* @internal With `check_on_nullify`, recompute right away. Returns `true` if the value didn't
		* change (so I'm valid again, and nothing that depends on me needs to know).
		*/
		_unchangedAfterRecheck() {
			const { cache_value, check_on_nullify, equals = defaultEquals } = this._options;
			if (cache_value === false || check_on_nullify !== true || rechecked.has(this)) return false;
			if (evaluationStack.includes(this)) return false;
			rechecked.add(this);
			const oldValue = this._cachedValue;
			try {
				return equals(oldValue, this.get(void 0, true));
			} catch {
				this._silentlyInvalid = false;
				return false;
			}
		}
		_recordDependency(allowNewDependency) {
			if (evaluationStack.length === 0) return;
			const dependent = evaluationStack[evaluationStack.length - 1];
			if (dependent === this) return;
			const edge = this._outEdges?.get(dependent._id);
			if (edge) edge.timestamp = dependent._timestamp;
			else if (allowNewDependency && this._options.auto_add_outgoing_dependencies !== false && dependent._options.auto_add_incoming_dependencies !== false) {
				const newEdge = {
					from: this,
					to: dependent,
					timestamp: dependent._timestamp
				};
				(this._outEdges ??= /* @__PURE__ */ new Map()).set(dependent._id, newEdge);
				(dependent._inEdges ??= /* @__PURE__ */ new Map()).set(this._id, newEdge);
			}
		}
		_resolve(value) {
			if (this._options.literal) return value;
			if (typeof value === "function") return value.call(this._options.context ?? this, this);
			return get(value);
		}
	};
	/**
	* Whether `value` is a constraint.
	*/
	function isConstraint(value) {
		return value instanceof Constraint;
	}
	/**
	* Removes the dependency of `to` on `from` (until `to` reads `from` again).
	*/
	function removeDependency(from, to) {
		from._outEdges?.delete(to._id);
		to._inEdges?.delete(from._id);
	}
	/**
	* Runs `fn` without recording anything it reads as a dependency of the constraint that is
	* computing its value right now.
	*/
	function untracked(fn) {
		const outerStack = evaluationStack.splice(0);
		try {
			return fn();
		} finally {
			evaluationStack.push(...outerStack);
		}
	}
	function invalidateAll(queue) {
		const isOutermost = !invalidating;
		invalidating = true;
		try {
			for (let i = 0; i < queue.length; i++) {
				const constraint = queue[i];
				if (!constraint._valid && !constraint._silentlyInvalid) continue;
				constraint._valid = false;
				constraint._silentlyInvalid = false;
				if (constraint._unchangedAfterRecheck()) continue;
				constraint._enqueueListeners();
				constraint._collectDependents(queue);
			}
		} finally {
			if (isOutermost) {
				invalidating = false;
				if (rechecked.size > 0) rechecked.clear();
			}
		}
		if (isOutermost) runQueuedListeners();
	}
	function isPlainValue(value, options) {
		return options.literal === true || typeof value !== "function" && !(value instanceof Constraint);
	}
	function derive(inputs, compute) {
		return new Constraint(() => compute(...inputs.map((input) => get(input))));
	}

//#endregion
//#region src/array-constraint.ts
/**
	* ***Note:*** the preferred way to create an array constraint is with `cjs([...])` or `cjs.array(options)`.
	*
	* Emulates a standard array, but with constraints: its methods (`push`, `pop`, `slice`, ...) keep
	* track of dependencies, so that a constraint that reads an item is only updated when that item
	* (or, for methods like `forEach`, the length) changes.
	*
	*     x[1] = y[2] + z[3]  ===  x.item(1, y.item(2) + z.item(3))
	*
	* @example
	*     var arr = cjs([1, 2, 3]);
	*     var sum = cjs(function() {
	*         return arr.toArray().reduce(function(a, b) { return a + b; }, 0);
	*     });
	*     sum.get(); // 6
	*     arr.push(4);
	*     sum.get(); // 10
	*/
	var ArrayConstraint = class ArrayConstraint {
		/** Return this from a `forEach` callback to stop iterating. */
		static BREAK = BREAK;
		/** One constraint per item. The same constraint stays at an index as items shift around. */
		_items;
		/**
		* Placeholder constraints for indices that were read before they had an item, so that whatever
		* read them is notified when an item is put there.
		*/
		_placeholders = /* @__PURE__ */ new Map();
		_length;
		_equalityCheck;
		constructor(options) {
			const { equals = defaultEquals, value = [] } = options ?? {};
			this._items = value.map((item) => new Constraint(item, { literal: true }));
			this._length = new Constraint(this._items.length);
			this._equalityCheck = new Constraint(equals, { literal: true });
		}
		/**
		* Change how items are compared (for `indexOf` and friends).
		*/
		setEqualityCheck(equalityCheck) {
			this._equalityCheck.set(equalityCheck);
			return this;
		}
		/**
		* Calls `callback` once per item. Return `cjs.ArrayConstraint.BREAK` from it to stop.
		*
		* @param thisArg - The `this` for `callback` (default: the global object)
		*
		* @example
		*     var arr = cjs(['a','b','c']);
		*     arr.forEach(function(val, i) {
		*         console.log(val);
		*         if(i === 1) {
		*             return cjs.ArrayConstraint.BREAK;
		*         }
		*     }); // 'a' ... 'b'
		*/
		forEach(callback, thisArg = globalThis) {
			const length = this.length();
			for (let i = 0; i < length; i++) if (callback.call(thisArg, this._read(i), i) === BREAK) break;
			return this;
		}
		/**
		* A new (plain) array with the results of calling `callback` on every item.
		*
		* @example
		*     var arr = cjs([1,2,3]);
		*     arr.map(function(x) { return x+1; }); // [2,3,4]
		*/
		map(callback, thisArg = globalThis) {
			const results = [];
			this.forEach((value, i) => {
				results[i] = callback.call(thisArg, value, i);
			});
			return results;
		}
		/**
		* Replaces every item.
		*
		* @example
		*     var arr = cjs([1,2,3]);
		*     arr.setValue(['a','b','c']);
		*     arr.toArray(); //['a','b','c']
		*/
		setValue(values) {
			batch(() => {
				for (let i = 0; i < values.length; i++) this._write(i, values[i]);
				this._truncate(values.length);
			});
			return this;
		}
		item(...args) {
			if (args.length === 0) return this.toArray();
			const index = Number(args[0]);
			if (args.length === 1) return this._read(index);
			const value = args[1];
			batch(() => {
				this._write(index, value);
				this._updateLength();
			});
			return value;
		}
		/**
		* Clears this array and cleans up its constraints.
		*
		* @param silent - If `true`, don't invalidate the constraints that depended on it
		*/
		destroy(silent) {
			batch(() => {
				for (const item of this._items) item?.destroy(silent);
				for (const placeholder of this._placeholders.values()) placeholder.destroy(silent);
				this._items = [];
				this._placeholders.clear();
				this._length.set(0, { silent }).destroy(silent);
				this._equalityCheck.destroy(silent);
			});
		}
		/**
		* The number of items.
		*
		* @example
		*     var arr = cjs(['a','b']);
		*     arr.length(); // 2
		*/
		length() {
			return this._length.get();
		}
		/**
		* Appends items to the end and returns the new length.
		*
		* @example
		*     var arr = cjs(['a','b']);
		*     arr.push('c','d'); // 4
		*     arr.toArray(); // ['a','b','c','d']
		*/
		push(...values) {
			batch(() => {
				const start = this._items.length;
				values.forEach((value, i) => this._write(start + i, value));
				this._updateLength();
			});
			return this.length();
		}
		/**
		* Removes the last item and returns it (or `undefined` if the array is empty).
		*
		* @example
		*     var arr = cjs(['a','b']);
		*     arr.pop(); // 'b'
		*     arr.toArray(); // ['a']
		*/
		pop() {
			return batch(() => {
				const value = this._peek(this._items.length - 1);
				this._truncate(this._items.length - 1);
				return value;
			});
		}
		/**
		* A plain array of the items.
		*
		* @example
		*     var arr = cjs(['a','b']);
		*     arr.toArray(); // ['a', 'b']
		*/
		toArray() {
			return this.map((value) => value);
		}
		/**
		* The index of the first item for which `filter` returns a truthy value, or `-1`.
		*
		* @param thisArg - The `this` for `filter` (default: this array constraint)
		*
		* @example
		*     var arr = cjs(['a','b','b']);
		*     arr.indexWhere(function(val, i) {
		*         return val === 'b';
		*     }); // 1
		*/
		indexWhere(filter, thisArg = this) {
			const length = this.length();
			for (let i = 0; i < length; i++) if (filter.call(thisArg, this._read(i), i)) return i;
			return -1;
		}
		/**
		* The index of the last item for which `filter` returns a truthy value, or `-1`.
		*
		* @param thisArg - The `this` for `filter` (default: this array constraint)
		*
		* @example
		*     var arr = cjs(['a','b','a']);
		*     arr.lastIndexWhere(function(val, i) {
		*         return val === 'a';
		*     }); // 2
		*/
		lastIndexWhere(filter, thisArg = this) {
			for (let i = this.length() - 1; i >= 0; i--) if (filter.call(thisArg, this._read(i), i)) return i;
			return -1;
		}
		/**
		* The index of the first item equal to `item`, or `-1`.
		*
		* @param equalityCheck - How to compare items (default: this array's equality check)
		*
		* @example
		*     var arr = cjs(['a','b','a']);
		*     arr.indexOf('a'); // 0
		*/
		indexOf(item, equalityCheck) {
			const equals = equalityCheck ?? this._equalityCheck.get();
			return this.indexWhere((value) => equals(value, item));
		}
		/**
		* The index of the last item equal to `item`, or `-1`.
		*
		* @param equalityCheck - How to compare items (default: this array's equality check)
		*
		* @example
		*     var arr = cjs(['a','b','a']);
		*     arr.lastIndexOf('a'); // 2
		*/
		lastIndexOf(item, equalityCheck) {
			const equals = equalityCheck ?? this._equalityCheck.get();
			return this.lastIndexWhere((value) => equals(value, item));
		}
		/**
		* Whether `filter` returns a truthy value for any item.
		*
		* @example
		*     var arr = cjs([1,3,5]);
		*     arr.some(function(x) { return x%2===0; }); // false
		*/
		some(filter, thisArg) {
			return this.indexWhere(filter, thisArg) >= 0;
		}
		/**
		* Whether `filter` returns a truthy value for every item.
		*
		* @example
		*     var arr = cjs([2,4,6]);
		*     arr.every(function(x) { return x%2===0; }); // true
		*/
		every(filter, thisArg) {
			let result = true;
			this.forEach((value, i) => {
				if (!filter.call(thisArg, value, i)) {
					result = false;
					return BREAK;
				}
			});
			return result;
		}
		/**
		* Removes `howMany` items starting at `index`, inserts `items` in their place, and returns the
		* removed items. If `index` is past the end, `items` are appended.
		*
		* @param howMany - The number of items to remove (default: `0`)
		*
		* @example
		*     var arr = cjs(['a','b','c']);
		*     arr.splice(0, 2, 'x', 'y'); // ['a','b']
		*     arr.toArray(); // ['x','y','c']
		*/
		splice(index, howMany, ...items) {
			const deleteCount = typeof howMany === "number" ? howMany : 0;
			if (!isPositiveInteger(index) || !isPositiveInteger(deleteCount)) throw new Error("index and howmany must be positive integers");
			return batch(() => {
				const oldLength = this._items.length;
				const start = Math.min(index, oldLength);
				const end = Math.min(start + deleteCount, oldLength);
				const removed = this._range(start, end);
				const tail = [...items, ...this._range(end, oldLength)];
				for (let i = 0; i < tail.length; i++) this._write(start + i, tail[i]);
				this._truncate(start + tail.length);
				return removed;
			});
		}
		/**
		* Removes the first item and returns it.
		*
		* @example
		*     var arr = cjs(['a','b','c']);
		*     arr.shift(); // 'a'
		*     arr.toArray(); //['b','c']
		*/
		shift() {
			return this.splice(0, 1)[0];
		}
		/**
		* Adds items to the beginning and returns the new length.
		*
		* @example
		*     var arr = cjs(['a','b','c']);
		*     arr.unshift('x','y'); // 5
		*     arr.toArray(); //['x','y','a','b','c']
		*/
		unshift(...items) {
			this.splice(0, 0, ...items);
			return this.length();
		}
		/**
		* A new (plain) array of these items followed by `values`. Array (and array constraint)
		* arguments are spread into the result.
		*
		* @example
		*     var arr1 = cjs(['a','b','c']),
		*         arr2 = cjs(['x']);
		*     arr1.concat(arr2); // ['a','b','c','x']
		*/
		concat(...values) {
			const plainValues = values.map((value) => value instanceof ArrayConstraint ? value.toArray() : value);
			return this.toArray().concat(...plainValues);
		}
		/**
		* A (plain) array of the items from `begin` up to (but not including) `end`. Like
		* `Array.prototype.slice`, negative indices count back from the end.
		*
		* @example
		*     var arr = cjs(['a','b','c']);
		*     arr.slice(1); // ['b','c']
		*/
		slice(begin, end) {
			const length = this.length();
			return Array.from({ length }, (_, i) => i).slice(begin, end).map((i) => this._read(i));
		}
		/**
		* A constraint whose value is the item at `index` (which can itself be a constraint).
		*
		* @example
		*     var arr = cjs(['a','b','c']);
		*     var first_item = arr.itemConstraint(0);
		*     first_item.get(); // 'a'
		*     arr.item(0,'x');
		*     first_item.get(); // 'x'
		*/
		itemConstraint(index) {
			return new Constraint(() => this.item(get(index)));
		}
		/** A (plain) array of the items that pass `filter`. */
		filter(filter, thisArg) {
			return this.toArray().filter(filter, thisArg);
		}
		/** The items joined into a string, separated by `separator` (default: `","`). */
		join(separator) {
			return this.toArray().join(separator);
		}
		/** A sorted (plain) copy of the items. This array constraint is not modified. */
		sort(compareFunction) {
			return this.toArray().sort(compareFunction);
		}
		/** A reversed (plain) copy of the items. This array constraint is not modified. */
		reverse() {
			return this.toArray().reverse();
		}
		/** The items as a string, like `Array.prototype.toString`. */
		toString() {
			return this.toArray().toString();
		}
		_read(index) {
			const item = this._items[index];
			if (item) return item.get();
			let placeholder = this._placeholders.get(index);
			if (!placeholder) {
				placeholder = new Constraint(void 0, { literal: true });
				this._placeholders.set(index, placeholder);
			}
			return placeholder.get();
		}
		_peek(index) {
			return this._items[index]?.get(false);
		}
		_range(start, end) {
			const values = [];
			for (let i = start; i < end; i++) values.push(this._peek(i));
			return values;
		}
		_write(index, value) {
			const item = this._items[index];
			if (item) {
				item.set(value);
				return;
			}
			const placeholder = this._placeholders.get(index);
			if (placeholder) {
				this._placeholders.delete(index);
				this._items[index] = placeholder;
				placeholder.set(value);
			} else this._items[index] = new Constraint(value, { literal: true });
		}
		_truncate(length) {
			for (const item of this._items.splice(Math.max(length, 0))) item?.destroy();
			this._updateLength();
		}
		_updateLength() {
			this._length.set(this._items.length);
		}
	};
	/**
	* Whether `value` is an array constraint.
	*/
	function isArrayConstraint(value) {
		return value instanceof ArrayConstraint;
	}

//#endregion
//#region src/array-diff.ts
/**
	* Computes how to transform `from` into `to` with as few operations as practical: which items
	* were removed, which were added, and which have to move. This is used to keep DOM nodes in sync
	* with a model while touching as few of them as possible.
	*
	* @param equals - How to tell whether two items are the same (default: `===`)
	*
	* @example
	*     cjs.arrayDiff(["a", "b", "c"], ["c", "b", "d"]);
	*     // {
	*     //   removed: [{ from: 0, from_item: "a" }],
	*     //   added: [{ item: "d", to: 2, to_item: "d" }],
	*     //   moved: [{ item: "c", from: 2, to: 0, move_from: 1, insert_at: 0 }],
	*     //   index_changed: [{ item: "c", from: 2, to: 0, from_item: "c", to_item: "c" }]
	*     // }
	*/
	function arrayDiff(from, to, equals = defaultEquals) {
		const sources = matchIndices(from, to, equals);
		const isKept = new Array(from.length).fill(false);
		for (const source of sources) if (source >= 0) isKept[source] = true;
		const removed = [];
		for (let i = from.length - 1; i >= 0; i--) if (!isKept[i]) removed.push({
			from: i,
			from_item: from[i]
		});
		const added = [];
		const indexChanged = [];
		sources.forEach((source, target) => {
			const item = to[target];
			if (source < 0) added.push({
				item,
				to: target,
				to_item: item
			});
			else if (source !== target) indexChanged.push({
				item,
				from: source,
				to: target,
				from_item: from[source],
				to_item: item
			});
		});
		return {
			removed,
			added,
			moved: findMoves(from.length, sources, to),
			index_changed: indexChanged
		};
	}
	/**
	* Pairs up equal items in two arrays. Returns, for every index in `to`, the index of the
	* corresponding item in `from`, or -1 if the item is new. Duplicates are paired in order.
	*/
	function matchIndices(from, to, equals = defaultEquals) {
		const sources = new Array(to.length).fill(-1);
		let start = 0;
		while (start < from.length && start < to.length && equals(from[start], to[start])) {
			sources[start] = start;
			start++;
		}
		let fromEnd = from.length;
		let toEnd = to.length;
		while (fromEnd > start && toEnd > start && equals(from[fromEnd - 1], to[toEnd - 1])) sources[--toEnd] = --fromEnd;
		if (equals === defaultEquals) {
			const unpaired = /* @__PURE__ */ new Map();
			for (let i = fromEnd - 1; i >= start; i--) {
				const indices = unpaired.get(from[i]);
				if (indices) indices.push(i);
				else unpaired.set(from[i], [i]);
			}
			for (let j = start; j < toEnd; j++) {
				const item = to[j];
				if (item !== item) continue;
				const source = unpaired.get(item)?.pop();
				if (source !== void 0) sources[j] = source;
			}
		} else {
			const isPaired = new Array(from.length).fill(false);
			for (let j = start; j < toEnd; j++) for (let i = start; i < fromEnd; i++) if (!isPaired[i] && equals(from[i], to[j])) {
				isPaired[i] = true;
				sources[j] = i;
				break;
			}
		}
		return sources;
	}
	function findMoves(fromLength, sources, to) {
		const keptInOldOrder = new Array(fromLength).fill(-1);
		sources.forEach((source, target) => {
			if (source >= 0) keptInOldOrder[source] = target;
		});
		const kept = keptInOldOrder.filter((target) => target >= 0);
		const order = sources.map((source, target) => source < 0 ? target : -1);
		let nextKept = 0;
		for (let i = 0; i < order.length; i++) if (order[i] === -1) order[i] = kept[nextKept++];
		if (order.every((target, i) => target === i)) return [];
		const stay = heaviestIncreasingSubsequence(order, (target) => order.length + (sources[target] >= 0 ? 2 : 1));
		const moved = [];
		for (let target = order.length - 1; target >= 0; target--) {
			if (stay.has(target)) continue;
			const moveFrom = order.indexOf(target);
			order.splice(moveFrom, 1);
			const insertAt = target + 1 < to.length ? order.indexOf(target + 1) : order.length;
			order.splice(insertAt, 0, target);
			const source = sources[target];
			moved.push({
				item: to[target],
				from: source >= 0 ? source : void 0,
				to: target,
				move_from: moveFrom,
				insert_at: insertAt
			});
		}
		return moved;
	}
	function heaviestIncreasingSubsequence(order, weight) {
		const n = order.length;
		const chainWeight = new Array(n).fill(0);
		const previous = new Array(n).fill(-1);
		const tree = new Array(n + 1).fill(-1);
		const heavier = (p, q) => q < 0 || p >= 0 && chainWeight[p] > chainWeight[q] ? p : q;
		order.forEach((value, position) => {
			let best = -1;
			for (let i = value; i > 0; i -= i & -i) best = heavier(tree[i], best);
			chainWeight[position] = weight(value) + (best >= 0 ? chainWeight[best] : 0);
			previous[position] = best;
			for (let i = value + 1; i <= n; i += i & -i) tree[i] = heavier(position, tree[i]);
		});
		let end = -1;
		for (let position = 0; position < n; position++) end = heavier(position, end);
		const values = /* @__PURE__ */ new Set();
		for (let position = end; position >= 0; position = previous[position]) values.add(order[position]);
		return values;
	}

//#endregion
//#region src/dom.ts
/** Attributes that are either present or absent (like `disabled`), rather than having a meaningful value. */
	const booleanAttributes = /* @__PURE__ */ new Set([
		"allowfullscreen",
		"async",
		"autofocus",
		"autoplay",
		"checked",
		"compact",
		"controls",
		"declare",
		"default",
		"defer",
		"disabled",
		"formnovalidate",
		"hidden",
		"inert",
		"ismap",
		"itemscope",
		"loop",
		"multiple",
		"muted",
		"nohref",
		"nomodule",
		"noresize",
		"noshade",
		"novalidate",
		"nowrap",
		"open",
		"playsinline",
		"readonly",
		"required",
		"reversed",
		"selected"
	]);
	/** Whether `value` is a jQuery object (if jQuery is loaded). */
	function isJQuery(value) {
		const jQuery = globalThis.jQuery;
		return typeof jQuery === "function" && value instanceof jQuery;
	}
	/** Whether `value` is a NodeList (like the result of `querySelectorAll`). */
	function isNodeList(value) {
		return typeof NodeList !== "undefined" && value instanceof NodeList;
	}
	/** Whether `value` is a DOM node of any kind. */
	function isDOMNode(value) {
		return typeof value?.nodeType === "number" && value.nodeType > 0;
	}
	/** Whether `value` is a DOM element. */
	function isElement(value) {
		return isDOMNode(value) && value.nodeType === 1;
	}
	/** Whether `value` is a DOM node, a NodeList, or a jQuery object. */
	function isPolyDOM(value) {
		return isJQuery(value) || isNodeList(value) || isDOMNode(value);
	}
	/** The first DOM node in a node, NodeList, or jQuery object. */
	function firstDOMNode(value) {
		if (isJQuery(value) || isNodeList(value)) return value[0];
		return isDOMNode(value) ? value : void 0;
	}
	/** Every DOM node in a node, NodeList, or jQuery object (anything else is returned as is). */
	function domNodesOf(value) {
		return isJQuery(value) || isNodeList(value) ? Array.from(value) : [value];
	}
	/**
	* Converts anything that can hold DOM nodes (see {@link DOMTargets}) to an array. Reading a
	* constraint here makes the caller depend on it.
	*/
	function toDOMArray(targets) {
		if (Array.isArray(targets)) return targets;
		if (targets instanceof Constraint) return toDOMArray(targets.get());
		if (targets instanceof ArrayConstraint) return targets.toArray();
		if (targets instanceof MapConstraint) return targets.values();
		if (isJQuery(targets) || isNodeList(targets)) return Array.from(targets);
		return [targets];
	}

//#endregion
//#region src/liven.ts
/**
	* Runs `func`, and runs it again whenever any constraint it read changes.
	*
	* @example
	*     var x_val = cjs(0);
	*     var api_update = cjs.liven(function() {
	*         console.log('updating other x');
	*         other_api.setX(x_val.get());
	*     }); // 'updating other x'
	*     x_val.set(2); // 'updating other x'
	*/
	function liven(func, options) {
		const { context = globalThis, run_on_create = true, pause_while_running = false, priority = false, on_destroy } = options ?? {};
		const node = new Constraint(func, {
			context,
			cache_value: false,
			auto_add_outgoing_dependencies: false,
			run_on_add_listener: false
		});
		let paused = false;
		const runIfInvalid = () => {
			if (!pause_while_running) {
				node.get();
				return;
			}
			pause();
			try {
				node.get();
			} catch (error) {
				listen();
				throw error;
			}
			resume();
		};
		const runSoon = () => {
			if (!run_on_create || node.isValid()) return;
			if (isBatching()) node._enqueueListeners();
			else node.get(false);
		};
		function listen() {
			paused = false;
			node.onChangeWithPriority(priority, runIfInvalid);
		}
		function pause() {
			if (paused) return false;
			paused = true;
			node.offChange(runIfInvalid);
			return true;
		}
		function resume() {
			if (!paused) return false;
			listen();
			runSoon();
			return true;
		}
		listen();
		const liveFunction = {
			destroy(silent) {
				if (on_destroy) on_destroy.call(context, silent);
				node.destroy(silent);
			},
			pause,
			resume,
			run() {
				runIfInvalid();
				return liveFunction;
			},
			invalidate() {
				node.invalidate();
			},
			_constraint: node
		};
		runSoon();
		return liveFunction;
	}

//#endregion
//#region src/binding.ts
/**
	* Keeps some aspect of DOM nodes in sync with a value computed from constraints. For example,
	* `cjs.bindText` creates a binding that keeps an element's text up to date.
	*/
	var Binding = class {
		options;
		targets;
		_throttleDelay = false;
		_timeoutId;
		_update;
		_live;
		constructor(options) {
			this.options = options;
			this.targets = options.targets;
			const { getter, setter, init_val } = options;
			let value;
			let previous = typeof init_val === "function" ? init_val(toDOMArray(this.targets).find(isDOMNode)) : init_val;
			this._update = () => {
				this._timeoutId = void 0;
				const targets = toDOMArray(this.targets).filter(isDOMNode);
				options.onChange?.call(this, value, previous);
				for (const target of targets) setter.call(this, target, value, previous);
				previous = value;
			};
			this._live = liven(() => {
				value = getter();
				if (this._throttleDelay === false) this._update();
				else this._timeoutId ??= setTimeout(this._update, this._throttleDelay);
			});
		}
		/**
		* Stop updating the targets until `resume` is called.
		*
		* @see resume
		* @see throttle
		*/
		pause() {
			this._live.pause();
			return this;
		}
		/**
		* Start updating the targets again (after `pause`).
		*
		* @see pause
		* @see throttle
		*/
		resume() {
			this._live.resume();
			return this;
		}
		/**
		* Wait at least `minDelay` milliseconds between updates (`0` to update right away again).
		*
		* @see pause
		* @see resume
		*/
		throttle(minDelay) {
			this._throttleDelay = minDelay > 0 ? minDelay : false;
			if (this._throttleDelay === false && this._timeoutId !== void 0) {
				clearTimeout(this._timeoutId);
				this._update();
			}
			this._live.run();
			return this;
		}
		/**
		* Stop updating the targets and clean up.
		*/
		destroy() {
			this._live.destroy();
			if (this._timeoutId !== void 0) {
				clearTimeout(this._timeoutId);
				this._timeoutId = void 0;
			}
			this.options.onDestroy?.();
			this.options.coreDestroy?.();
		}
	};
	function createListBinding(compute, setter, initialValue) {
		return (targets, ...values) => {
			const value = new Constraint(() => compute(values));
			return new Binding({
				targets,
				getter: () => value.get(),
				setter,
				init_val: initialValue,
				coreDestroy: () => value.destroy()
			});
		};
	}
	function createPropertyBinding(setProperty, removeProperty) {
		return (targets, ...args) => {
			if (args.length === 0) return void 0;
			const source = args.length === 1 ? args[0] : { [String(args[0])]: args[1] };
			return new Binding({
				targets,
				getter: () => {
					const properties = get(source) ?? {};
					return Object.fromEntries(Object.entries(properties).map(([name, value]) => [name, get(value)]));
				},
				setter: (target, properties, previous) => {
					if (!isElement(target)) return;
					for (const name of Object.keys(previous ?? {})) if (!Object.hasOwn(properties, name)) removeProperty(target, name);
					for (const [name, value] of Object.entries(properties)) setProperty(target, name, value);
				}
			});
		};
	}
	function flattenValues(values) {
		return values.flatMap((value) => {
			const resolved = get(value);
			return Array.isArray(resolved) ? resolved : [resolved];
		});
	}
	function toNode(value) {
		return isDOMNode(value) ? value : document.createTextNode(String(value));
	}
	function updateChildren(parent, previous, children) {
		const { removed, added, moved } = arrayDiff(previous, children);
		for (const { from } of removed) {
			const child = parent.childNodes[from];
			if (child) parent.removeChild(child);
		}
		for (const { item, to } of added) parent.insertBefore(item, parent.childNodes[to] ?? null);
		for (const { move_from, insert_at } of moved) {
			const child = parent.childNodes[move_from];
			if (!child) continue;
			const anchor = parent.childNodes[insert_at >= move_from ? insert_at + 1 : insert_at];
			parent.insertBefore(child, anchor ?? null);
		}
	}
	/**
	* Constrain a DOM node's text content to the concatenation of `values`.
	*
	* @example If `my_elem` is a DOM element
	*     var message = cjs('hello');
	*     cjs.bindText(my_elem, message);
	*/
	const bindText = createListBinding((values) => values.map((value) => get(value)).join(""), (target, text) => {
		target.textContent = text;
	});
	/**
	* Constrain a DOM element's HTML content to the concatenation of `values`.
	*
	* @example If `my_elem` is a DOM element
	*     var message = cjs('<b>hello</b>');
	*     cjs.bindHTML(my_elem, message);
	*/
	const bindHTML = createListBinding((values) => values.map((value) => get(value)).join(""), (target, html) => {
		if (isElement(target)) target.innerHTML = html;
	});
	/**
	* Constrain an input element's value to the concatenation of `values`.
	*
	* @example If `my_input` is a text input element
	*     var value = cjs('hello');
	*     cjs.bindValue(my_input, value);
	*/
	const bindValue = createListBinding((values) => values.map((value) => get(value)).join(""), (target, value) => {
		target.value = value;
	});
	/**
	* Constrain a DOM element's class names. Each value can be a class name, a space-separated list
	* of class names, or an array of them. Classes that the element had before (and that aren't in
	* the values) are left alone.
	*
	* @example If `my_elem` is a DOM element
	*     var classes = cjs('class1 class2');
	*     cjs.bindClass(my_elem, classes);
	*/
	const bindClass = createListBinding((values) => {
		const names = flattenValues(values).flatMap((value) => value == null || value === false ? [] : String(value).split(/\s+/).filter(Boolean));
		return [...new Set(names)];
	}, (target, classes, previous = []) => {
		if (!isElement(target)) return;
		target.classList.remove(...previous.filter((name) => !classes.includes(name)));
		target.classList.add(...classes.filter((name) => !previous.includes(name)));
	}, []);
	/**
	* Constrain a DOM element's children. Each value can be a node, text, or an array of them. The
	* bound children are kept at the start of the element; any children it already had stay after them.
	*
	* @example If `my_elem`, `child1`, and `child2` are DOM elements
	*     var nodes = cjs([child1, child2]);
	*     cjs.bindChildren(my_elem, nodes);
	*/
	const bindChildren = createListBinding((values) => flattenValues(values).map(toNode), (target, children, previous = []) => updateChildren(target, previous, children), []);
	/**
	* Constrain a DOM element's CSS styles, given an object of property names and values (which can
	* be a constraint or map constraint), or a property name and a value.
	*
	* @example If `my_elem` is a DOM element
	*     var color = cjs('red'),
	*         left = cjs(0);
	*     cjs.bindCSS(my_elem, {
	*         "background-color": color,
	*         left: left.add('px')
	*     });
	*     cjs.bindCSS(my_elem, 'background-color', color);
	*/
	const bindCSS = createPropertyBinding((element, name, value) => {
		const { style } = element;
		if (name.startsWith("--")) style.setProperty(name, value == null ? "" : String(value));
		else style[camelCase(name)] = value ?? "";
	}, (element, name) => {
		const { style } = element;
		if (name.startsWith("--")) style.removeProperty(name);
		else style[camelCase(name)] = "";
	});
	/**
	* Constrain a DOM element's attributes, given an object of attribute names and values (which can
	* be a constraint or map constraint), or an attribute name and a value. An attribute is removed
	* when its value is `null` or `undefined` (or, for boolean attributes like `disabled`, falsy).
	*
	* @example If `my_input` is an input element
	*     var default_txt = cjs('enter name');
	*     cjs.bindAttr(my_input, 'placeholder', default_txt);
	*     cjs.bindAttr(my_input, {
	*         placeholder: default_txt,
	*         name: cjs('my_name')
	*     });
	*/
	const bindAttr = createPropertyBinding((element, name, value) => {
		if (value == null || booleanAttributes.has(name) && !value) element.removeAttribute(name);
		else element.setAttribute(name, String(value));
	}, (element, name) => element.removeAttribute(name));
	const inputEvents = [
		"input",
		"change",
		"keyup",
		"paste"
	];
	var InputValueConstraint = class extends Constraint {
		_elements;
		_onInput = () => {
			this.invalidate();
		};
		constructor(inputs) {
			const single = isElement(inputs);
			const elements = single ? [inputs] : Array.from(inputs);
			super(() => single ? elements[0].value : elements.map((element) => element.value));
			this._elements = elements;
			for (const element of elements) for (const type of inputEvents) element.addEventListener(type, this._onInput);
		}
		destroy(silent) {
			for (const element of this._elements) for (const type of inputEvents) element.removeEventListener(type, this._onInput);
			return super.destroy(silent);
		}
	};
	/**
	* A constraint whose value is the value of an input element (or, given several inputs, an array
	* of their values).
	*
	* @example If `name_input` is an input element
	*     var name = cjs.inputValue(name_input);
	*/
	function inputValue(inputs) {
		return new InputValueConstraint(inputs);
	}

//#endregion
//#region src/fsm.ts
	let nextId = 0;
	/** A state of an {@link FSM}. */
	var State = class {
		_fsm;
		_name;
		_id = nextId++;
		constructor(fsm, name) {
			this._fsm = fsm;
			this._name = name;
		}
		/** The state's name */
		getName() {
			return this._name;
		}
		/** The FSM this state belongs to */
		getFSM() {
			return this._fsm;
		}
		/** A unique id */
		id() {
			return this._id;
		}
	};
	/** A transition between two states of an {@link FSM}. */
	var Transition = class {
		_fsm;
		_from;
		_to;
		_name;
		_id = nextId++;
		_event;
		constructor(fsm, from, to, name) {
			this._fsm = fsm;
			this._from = from;
			this._to = to;
			this._name = name;
		}
		/** The name of the state this transition goes from */
		getFrom() {
			return this._from;
		}
		/** The name of the state this transition goes to */
		getTo() {
			return this._to;
		}
		getName() {
			return this._name;
		}
		/** The FSM this transition belongs to (`undefined` once it's destroyed) */
		getFSM() {
			return this._fsm;
		}
		/** A unique id */
		id() {
			return this._id;
		}
		/** The event (from `cjs.on`) that triggers this transition */
		setEvent(event) {
			this._event = event;
		}
		/** Runs the transition, if its FSM is in the transition's `from` state. Arguments are passed to listeners. */
		run(...eventArgs) {
			const fsm = this._fsm;
			if (fsm?.is(this._from)) fsm._setState(this._to, this, ...eventArgs);
		}
		/** Stops the transition from running and cleans up. */
		destroy() {
			this._event?._removeTransition(this);
			this._event = void 0;
			this._fsm = void 0;
		}
	};
	/** @internal Matches the state named `name` */
	var StateSelector = class {
		_name;
		constructor(name) {
			this._name = name;
		}
		matchesState(state) {
			return state === this._name;
		}
		matchesTransition() {
			return false;
		}
	};
	/** @internal Matches any state (`*`) */
	var AnyStateSelector = class {
		matchesState() {
			return true;
		}
		matchesTransition() {
			return false;
		}
	};
	/** @internal Matches transitions between states matched by `from` and `to`, before or after they run */
	var TransitionSelector = class {
		_pre;
		_from;
		_to;
		constructor(pre, from, to) {
			this._pre = pre;
			this._from = from;
			this._to = to;
		}
		matchesState() {
			return false;
		}
		matchesTransition(transition, pre) {
			return pre === this._pre && this._from.matchesState(transition.getFrom()) && this._to.matchesState(transition.getTo());
		}
	};
	var AnySelector = class {
		_selectors;
		constructor(selectors) {
			this._selectors = selectors;
		}
		matchesState(state) {
			return this._selectors.some((selector) => selector.matchesState(state));
		}
		matchesTransition(transition, pre) {
			return this._selectors.some((selector) => selector.matchesTransition(transition, pre));
		}
	};
	function parseStates(spec) {
		const selectors = spec.split(",").map((name) => name.trim()).map((name) => name === "*" ? new AnyStateSelector() : new StateSelector(name));
		return selectors.length === 1 ? selectors[0] : new AnySelector(selectors);
	}
	const specPattern = /^([\s\w,*-]+)(?:(<->|>-<|->|>-|<-|-<)([\s\w,*-]+))?$/;
	function parseSpec(spec) {
		const match = specPattern.exec(spec);
		if (!match) return void 0;
		const [, left = "", arrow, right = ""] = match;
		if (!arrow) return parseStates(left);
		const leftStates = parseStates(left);
		const rightStates = parseStates(right);
		switch (arrow) {
			case "->": return new TransitionSelector(false, leftStates, rightStates);
			case ">-": return new TransitionSelector(true, leftStates, rightStates);
			case "<-": return new TransitionSelector(false, rightStates, leftStates);
			case "-<": return new TransitionSelector(true, rightStates, leftStates);
			case "<->": return new AnySelector([new TransitionSelector(false, leftStates, rightStates), new TransitionSelector(false, rightStates, leftStates)]);
			default: return new AnySelector([new TransitionSelector(true, leftStates, rightStates), new TransitionSelector(true, rightStates, leftStates)]);
		}
	}
	function isTrigger(value) {
		return typeof value === "function" || typeof value?._addTransition === "function";
	}
	/**
	* ***Note:*** the preferred way to create an FSM is with `cjs.fsm(...stateNames)`.
	*
	* A finite-state machine, to track the state of an interface or component.
	*
	* @example
	*     var fsm = cjs.fsm("idle", "active")
	*                  .addTransition("idle", "active", cjs.on("click"))
	*                  .addTransition("active", "idle", cjs.on("timeout", 1000));
	*/
	var FSM = class {
		/**
		* A constraint whose value is the name of the current state.
		*
		* @example
		*     var my_fsm = cjs.fsm("state1", "state2");
		*     my_fsm.state.get(); // 'state1'
		*/
		state;
		_states = /* @__PURE__ */ new Map();
		_transitions = [];
		_currentState = null;
		/** The state that `addTransition` starts from when no `from` state is given */
		_chainState = null;
		_listeners = [];
		_didTransition = false;
		/**
		* @param stateNames - The FSM's states. The first one is the starting state (see `startsAt`).
		*/
		constructor(...stateNames) {
			this.state = new Constraint(() => this._currentState?.getName() ?? null);
			this.addState(...stateNames.flat());
		}
		/**
		* Adds states. The first state added becomes the current state; the last one becomes the
		* state that `addTransition` starts from when no `from` state is given.
		*
		* @example
		*     var fsm = cjs.fsm()
		*                  .addState('state1')
		*                  .addState('state2')
		*                  .addTransition('state1', cjs.on('click'));
		*/
		addState(...names) {
			for (const name of names) {
				const state = this._getOrCreateState(name);
				this._chainState = state;
				if (!this._currentState) this._setCurrentState(state);
			}
			return this;
		}
		/**
		* The name of the current state. Constraints that read it are updated when it changes.
		*
		* @example
		*     var my_fsm = cjs.fsm("state1", "state2");
		*     my_fsm.getState(); // 'state1'
		*/
		getState() {
			return this.state.get();
		}
		addTransition(...args) {
			if (args.length === 0) throw new Error("addTransition expects at least one argument");
			const [from, to, trigger] = args.length === 1 || args.length === 2 && isTrigger(args[1]) ? [
				this._chainState?.getName(),
				args[0],
				args[1]
			] : args;
			if (from === void 0) throw new Error("addTransition: there is no state to transition from");
			const transition = new Transition(this, this._getOrCreateState(stateName$1(from)).getName(), this._getOrCreateState(stateName$1(to)).getName());
			this._transitions.push(transition);
			const run = (...eventArgs) => transition.run(...eventArgs);
			if (trigger === void 0) return run;
			if (typeof trigger === "function") trigger.call(this, run, this);
			else {
				transition.setEvent(trigger);
				trigger._addTransition(transition);
			}
			return this;
		}
		/**
		* @internal Changes the current state. Transitions call this. Without a `transition`, it jumps
		* straight to the state `to`, and only listeners for entering that state are called.
		*/
		_setState(to, transition, ...eventArgs) {
			const toState = this._states.get(to);
			if (!toState) throw new Error(`Could not find state '${to}'`);
			const fromName = this._currentState?.getName() ?? null;
			const listenerArgs = [
				eventArgs[0],
				transition,
				toState,
				fromName,
				...eventArgs.slice(1)
			];
			this._didTransition = true;
			for (const listener of [...this._listeners]) if (transition && listener.selector.matchesTransition(transition, true)) listener.callback.apply(listener.context ?? globalThis, listenerArgs);
			this._setCurrentState(toState);
			for (const listener of [...this._listeners]) {
				const { selector } = listener;
				if (transition && selector.matchesTransition(transition, false) || selector.matchesState(to)) listener.callback.apply(listener.context ?? globalThis, listenerArgs);
			}
		}
		/**
		* Removes every state, transition, and listener. Useful for cleaning up memory.
		*/
		destroy() {
			this.state.destroy();
			for (const transition of this._transitions) transition.destroy();
			this._transitions = [];
			this._states.clear();
			this._listeners = [];
			this._currentState = null;
			this._chainState = null;
		}
		/**
		* Sets the state this FSM starts in (unless it has already transitioned).
		*
		* @example
		*     var my_fsm = cjs.fsm("state_a", "state_b");
		*     my_fsm.startsAt("state_b");
		*/
		startsAt(name) {
			const state = this._getOrCreateState(name);
			if (!this._didTransition) this._setCurrentState(state);
			this._chainState = state;
			return this;
		}
		/**
		* Whether the current state is `state`. Constraints that call this are updated when the state changes.
		*
		* @example
		*     var my_fsm = cjs.fsm("a", "b");
		*     my_fsm.is("a"); // true, because a is the starting state
		*/
		is(state) {
			const current = this.getState();
			return current !== null && current === stateName$1(state);
		}
		/**
		* Calls `callback` when the FSM enters a state or runs a transition. `spec` can be:
		*
		* - `'*'`: any state
		* - `'state1'`: a state named `state1` (or a comma-separated list: `'state1, state2'`)
		* - `'state1 -> state2'`: right **after** state1 transitions to state2
		* - `'state1 >- state2'`: right **before** state1 transitions to state2
		* - `'state1 <-> state2'`: right **after** any transition between state1 and state2
		* - `'state1 >-< state2'`: right **before** any transition between state1 and state2
		* - `'state1 <- state2'`: right **after** state2 transitions to state1
		* - `'state1 -< state2'`: right **before** state2 transitions to state1
		* - `'state1 -> *'`: any transition from state1
		* - `'* -> state2'`: any transition to state2
		*
		* @param context - The `this` for `callback` (default: the global object)
		* @see off
		*
		* @example
		*     var x = cjs.fsm("a", "b");
		*     x.on("a->b", function() {...});
		*/
		on(spec, callback, context) {
			const selector = typeof spec === "string" ? parseSpec(spec) : spec;
			if (!selector) throw new Error(`Unrecognized format for state/transition spec: '${spec}'`);
			this._listeners.push({
				selector,
				callback,
				context
			});
			return this;
		}
		/** An alias for `on`. */
		addEventListener(spec, callback, context) {
			return this.on(spec, callback, context);
		}
		/**
		* Removes every listener for `callback` that was added with `on`.
		*
		* @see on
		*/
		off(callback) {
			this._listeners = this._listeners.filter((listener) => listener.callback !== callback);
			return this;
		}
		/** An alias for `off`. */
		removeEventListener(callback) {
			return this.off(callback);
		}
		_getOrCreateState(name) {
			let state = this._states.get(name);
			if (!state) {
				state = new State(this, name);
				this._states.set(name, state);
			}
			return state;
		}
		_setCurrentState(state) {
			this._currentState = state;
			this.state.invalidate();
		}
	};
	function stateName$1(state) {
		return state instanceof State ? state.getName() : String(state);
	}
	/**
	* Whether `value` is an FSM.
	*/
	function isFSM(value) {
		return value instanceof FSM;
	}

//#endregion
//#region src/events.ts
/**
	* ***Note:*** the preferred way to create an event is with `cjs.on`.
	*
	* An event that triggers FSM transitions, like a click or a timeout. `guard` creates events that
	* only trigger when a condition holds.
	*
	* @see cjs.on
	*/
	var CJSEvent = class CJSEvent {
		_source;
		_parent;
		_filter;
		/** The transitions this event triggers, and how to stop listening for each */
		_transitions = /* @__PURE__ */ new Map();
		/** @hidden Events are created with `cjs.on(...)` and `.guard(...)`, rather than with this constructor. */
		constructor(source, parent, filter) {
			this._source = source;
			this._parent = parent;
			this._filter = filter;
		}
		/**
		* An event that fires when this one does, but only if `filter` returns a truthy value. If
		* `filter` is a property name instead, the event's `filter` property must equal `value`.
		*
		* @example If the user clicks and `ready` is `true`
		*     cjs.on("click").guard(function() {
		*         return ready === true;
		*     });
		* @example If the user presses the escape key
		*     cjs.on("keydown").guard("key", "Escape");
		*/
		guard(filter, value) {
			const test = typeof filter === "function" ? filter : (event) => event?.[filter] === value;
			return new CJSEvent(void 0, this, test);
		}
		/** @internal Starts triggering `transition`. */
		_addTransition(transition) {
			if (this._transitions.has(transition)) return;
			const filters = [];
			let root = this;
			while (root._parent) {
				filters.unshift(root._filter);
				root = root._parent;
			}
			const fire = (...events) => {
				if (filters.every((filter) => filter.apply(globalThis, events))) transition.run(...events);
			};
			this._transitions.set(transition, listen(root._source, transition, fire));
		}
		/** @internal Stops triggering `transition`. */
		_removeTransition(transition) {
			this._transitions.get(transition)?.();
			this._transitions.delete(transition);
		}
	};
	const TIMEOUT = "timeout";
	function listen(source, transition, fire) {
		const fsm = transition.getFSM();
		const from = transition.getFrom();
		let eventTypes = [];
		let targets = [];
		let timeoutId;
		const start = () => {
			for (const type of eventTypes) if (type === TIMEOUT) {
				clearTimeout(timeoutId);
				const delay = get(source.targets[0]);
				timeoutId = setTimeout(fire, typeof delay === "number" && delay > 0 ? delay : 0);
			} else for (const target of targets) target.addEventListener(type, fire);
		};
		const stop = () => {
			clearTimeout(timeoutId);
			timeoutId = void 0;
			for (const type of eventTypes) if (type !== TIMEOUT) for (const target of targets) target.removeEventListener(type, fire);
		};
		const fromState = new StateSelector(from);
		fsm.on(fromState, start);
		fsm.on(new TransitionSelector(true, fromState, new AnyStateSelector()), stop);
		const live = liven(() => {
			stop();
			eventTypes = String(get(source.eventType)).split(/\s+/).filter(Boolean);
			targets = source.targets.flatMap((target) => toDOMArray(target)).filter(isEventTarget);
			if (fsm.is(from)) start();
		});
		return () => {
			live.destroy();
			stop();
			fsm.off(start);
			fsm.off(stop);
		};
	}
	function isEventTarget(value) {
		return typeof value?.addEventListener === "function";
	}
	/**
	* Creates an event for FSM transitions (see `FSM.prototype.addTransition`).
	*
	* @param eventType - The type of event to listen for, like `"click"` or `"timeout"` (several
	*     types can be separated by spaces). It can be a constraint.
	* @param targets - What to listen to (default: `window`). For `"timeout"`, the delay in
	*     milliseconds instead.
	*
	* @example When the window resizes
	*     cjs.on("resize")
	* @example When the user clicks `elem1` or `elem2`
	*     cjs.on("click", elem1, elem2)
	* @example After 3 seconds
	*     cjs.on("timeout", 3000)
	*/
	function on(eventType, ...targets) {
		return new CJSEvent({
			eventType,
			targets: targets.length > 0 ? targets : [globalThis]
		});
	}

//#endregion
//#region src/memoize.ts
	const joinArguments = (args) => args.join(",");
	function sameArguments(args1, args2) {
		return args1.length === args2.length && args1.every((arg, i) => arg === args2[i]);
	}
	/**
	* Memoizes a function: its result is remembered for each set of arguments, and only recomputed
	* when a constraint that it read (for those arguments) changes.
	*
	* @example
	*     var arr = cjs([3,2,1,4,5,10]),
	*         get_nth_largest = cjs.memoize(function(n) {
	*             console.log('recomputing');
	*             var sorted_arr = arr.sort(function(a, b) { return b - a; });
	*             return sorted_arr[n];
	*         });
	*
	*     get_nth_largest(0); // logged: recomputing
	*     get_nth_largest(0); // (nothing logged because the answer is memoized)
	*     arr.splice(0, 1);
	*     get_nth_largest(0); // logged: recomputing
	*/
	function memoize(getter, options) {
		const { hash = joinArguments, equals = sameArguments, context = globalThis, literal_values = true } = options ?? {};
		const argsMap = new MapConstraint({
			hash,
			equals,
			literal_values
		});
		const memoized = (...args) => argsMap.getOrPut(args, () => new Constraint(() => getter.apply(context, args))).get();
		return Object.assign(memoized, {
			destroy(silent) {
				argsMap.forEach((constraint) => constraint.destroy(silent));
				argsMap.destroy(silent);
			},
			each(fn) {
				argsMap.forEach(fn);
			},
			options: {
				hash,
				equals,
				context,
				literal_values,
				args_map: argsMap
			}
		});
	}

//#endregion
//#region src/template/evaluate.ts
/**
	* Evaluates an expression. Names are looked up on `context`; `this`, `./x`, `../x`, and
	* `@variables` use `scopes` (outermost first).
	*
	* Constraints that are read are unwrapped (so `{{x}}` shows the value of the constraint `x`),
	* which also makes whatever evaluates the expression depend on them.
	*/
	function evaluate(expression, context, scopes) {
		const evaluateIn = (node) => evaluate(node, context, scopes);
		switch (expression.type) {
			case "Literal": return expression.value;
			case "ThisExpression": return get(scopes[scopes.length - 1]?.self);
			case "Identifier": return expression.name.startsWith("@") ? special(scopes, expression.name.slice(1)) : unwrap(property(context, expression.name));
			case "MemberExpression": return unwrap(property(evaluateIn(expression.object), propertyKey(expression, context, scopes)));
			case "CallExpression": {
				const { callee } = expression;
				const thisArg = callee.type === "MemberExpression" ? evaluateIn(callee.object) : globalThis;
				const fn = callee.type === "MemberExpression" ? unwrap(property(thisArg, propertyKey(callee, context, scopes))) : evaluateIn(callee);
				return typeof fn === "function" ? fn.apply(thisArg, expression.arguments.map(evaluateIn)) : void 0;
			}
			case "UnaryExpression": return unaryOperators$1[expression.operator]?.(evaluateIn(expression.argument));
			case "BinaryExpression": return binaryOperators[expression.operator]?.(evaluateIn(expression.left), evaluateIn(expression.right));
			case "LogicalExpression": {
				const left = evaluateIn(expression.left);
				if (expression.operator === "&&") return left && evaluateIn(expression.right);
				return left || evaluateIn(expression.right);
			}
			case "ConditionalExpression": return evaluateIn(expression.test) ? evaluateIn(expression.consequent) : evaluateIn(expression.alternate);
			case "Array": return expression.body.map(evaluateIn);
			case "Compound": return expression.body.length > 0 ? evaluateIn(expression.body[0]) : void 0;
			case "CurrLevelExpression": {
				const self = get(scopes[scopes.length - 1]?.self);
				return evaluate(expression.argument, self, scopes);
			}
			case "ParentExpression": {
				const parentScopes = scopes.slice(0, -1);
				const self = get(parentScopes[parentScopes.length - 1]?.self);
				return evaluate(expression.argument, self, parentScopes);
			}
		}
	}
	function property(object, key) {
		if (object == null) return void 0;
		if (object instanceof MapConstraint) return object.get(key);
		return object[key];
	}
	function propertyKey(expression, context, scopes) {
		const { property: key, computed } = expression;
		if (computed) return evaluate(key, context, scopes);
		return key.type === "Identifier" ? key.name : String(evaluate(key, context, scopes));
	}
	function special(scopes, name) {
		for (let i = scopes.length - 1; i >= 0; i--) {
			const specials = scopes[i].specials;
			if (specials && Object.hasOwn(specials, name)) return unwrap(specials[name]);
		}
	}
	function unwrap(value) {
		return value instanceof Constraint ? value.get() : value;
	}

//#endregion
//#region src/template/expression.ts
	const unaryOperators = /* @__PURE__ */ new Set([
		"-",
		"!",
		"~",
		"+"
	]);
	const binaryPrecedence = {
		"||": 1,
		"&&": 2,
		"|": 3,
		"^": 4,
		"&": 5,
		"==": 6,
		"!=": 6,
		"===": 6,
		"!==": 6,
		"<": 7,
		">": 7,
		"<=": 7,
		">=": 7,
		"<<": 8,
		">>": 8,
		">>>": 8,
		"+": 9,
		"-": 9,
		"*": 10,
		"/": 10,
		"%": 10
	};
	const longestBinaryOperator = Math.max(...Object.keys(binaryPrecedence).map((op) => op.length));
	const literals = {
		true: true,
		false: false,
		null: null
	};
	const escapes = {
		n: "\n",
		r: "\r",
		t: "	",
		b: "\b",
		f: "\f",
		v: "\v",
		0: "\0"
	};
	const isDigit = (ch) => ch >= "0" && ch <= "9";
	const isIdentifierStart = (ch) => /[A-Za-z_$@]/.test(ch);
	const isIdentifierPart = (ch) => /[\w$]/.test(ch);
	const isSpace = (ch) => ch === " " || ch === "	" || ch === "\n" || ch === "\r";
	/**
	* Parses an expression. Several expressions (separated by spaces, commas, or semicolons) are
	* returned as a `Compound` expression.
	*
	* @throws {ExpressionError} if the expression can't be parsed
	*/
	function parseExpression(source) {
		let index = 0;
		const char = (at = index) => source.charAt(at);
		const fail = (description) => {
			const error = /* @__PURE__ */ new Error(`${description} at character ${index}`);
			error.index = index;
			error.description = description;
			throw error;
		};
		const skipSpaces = () => {
			while (isSpace(char())) index++;
		};
		const parseConditional = () => {
			const test = parseBinary();
			skipSpaces();
			if (!test || char() !== "?") return test;
			index++;
			const consequent = parseConditional() ?? fail("Expected expression");
			skipSpaces();
			if (char() !== ":") fail("Expected :");
			index++;
			return {
				type: "ConditionalExpression",
				test,
				consequent,
				alternate: parseConditional() ?? fail("Expected expression")
			};
		};
		const parseBinaryOperator = () => {
			skipSpaces();
			for (let length = longestBinaryOperator; length > 0; length--) {
				const candidate = source.substr(index, length);
				if (Object.hasOwn(binaryPrecedence, candidate)) {
					index += length;
					return candidate;
				}
			}
		};
		const parseBinary = () => {
			const first = parseToken();
			if (!first) return void 0;
			const operands = [first];
			const operators = [];
			const reduce = () => {
				const right = operands.pop();
				const left = operands.pop();
				operands.push(binaryExpression(operators.pop(), left, right));
			};
			let operator;
			while (operator = parseBinaryOperator()) {
				const precedence = binaryPrecedence[operator];
				while (operators.length > 0 && precedence <= binaryPrecedence[operators[operators.length - 1]]) reduce();
				operators.push(operator);
				operands.push(parseToken() ?? fail(`Expected expression after ${operator}`));
			}
			while (operators.length > 0) reduce();
			return operands[0];
		};
		const parseToken = () => {
			skipSpaces();
			const ch = char();
			if (source.startsWith("./", index)) {
				index += 2;
				return {
					type: "CurrLevelExpression",
					argument: parseToken() ?? fail("Expected expression after ./")
				};
			}
			if (source.startsWith("../", index)) {
				index += 3;
				return {
					type: "ParentExpression",
					argument: parseToken() ?? fail("Expected expression after ../")
				};
			}
			if (isDigit(ch) || ch === "." && isDigit(char(index + 1))) return parseNumber();
			if (ch === "\"" || ch === "'") return parseString();
			if (ch === "[") {
				index++;
				return parsePostfix({
					type: "Array",
					body: parseList("]")
				});
			}
			if (isIdentifierStart(ch) || ch === "(") return parseVariable();
			if (unaryOperators.has(ch)) {
				index++;
				return {
					type: "UnaryExpression",
					operator: ch,
					argument: parseToken() ?? fail(`Expected expression after ${ch}`),
					prefix: true
				};
			}
		};
		const parseNumber = () => {
			const start = index;
			while (isDigit(char())) index++;
			if (char() === ".") {
				index++;
				while (isDigit(char())) index++;
			}
			if (char() === "e" || char() === "E") {
				index++;
				if (char() === "+" || char() === "-") index++;
				if (!isDigit(char())) fail(`Expected exponent (${source.slice(start, index + 1)})`);
				while (isDigit(char())) index++;
			}
			const raw = source.slice(start, index);
			if (isIdentifierStart(char())) fail(`Variable names cannot start with a number (${raw}${char()})`);
			return {
				type: "Literal",
				value: parseFloat(raw),
				raw
			};
		};
		const parseString = () => {
			const quote = char();
			const start = index++;
			let value = "";
			while (index < source.length) {
				const ch = char(index++);
				if (ch === quote) return {
					type: "Literal",
					value,
					raw: source.slice(start, index)
				};
				if (ch !== "\\") {
					value += ch;
					continue;
				}
				const escaped = char(index++);
				const hexLength = escaped === "x" ? 2 : escaped === "u" ? 4 : 0;
				const hex = source.substr(index, hexLength);
				if (hexLength > 0 && /^[\da-f]+$/i.test(hex) && hex.length === hexLength) {
					value += String.fromCharCode(parseInt(hex, 16));
					index += hexLength;
				} else value += escapes[escaped] ?? escaped;
			}
			return fail(`Unclosed quote after "${value}"`);
		};
		const parseIdentifier = () => {
			const start = index;
			if (!isIdentifierStart(char())) fail(`Unexpected ${char()}`);
			index++;
			while (index < source.length && isIdentifierPart(char())) index++;
			const name = source.slice(start, index);
			if (Object.hasOwn(literals, name)) return {
				type: "Literal",
				value: literals[name],
				raw: name
			};
			if (name === "this") return { type: "ThisExpression" };
			return {
				type: "Identifier",
				name
			};
		};
		const parseList = (terminator) => {
			const items = [];
			for (;;) {
				skipSpaces();
				if (index >= source.length) fail(`Expected ${terminator}`);
				const ch = char();
				if (ch === terminator) {
					index++;
					return items;
				}
				if (ch === ",") {
					index++;
					continue;
				}
				items.push(parseConditional() ?? fail("Expected comma"));
			}
		};
		const parseVariable = () => {
			if (char() !== "(") return parsePostfix(parseIdentifier());
			index++;
			const group = parseConditional() ?? fail("Expected expression");
			skipSpaces();
			if (char() !== ")") fail("Unclosed (");
			index++;
			return parsePostfix(group);
		};
		const parsePostfix = (object) => {
			let node = object;
			for (;;) {
				skipSpaces();
				const ch = char();
				if (ch === ".") {
					index++;
					skipSpaces();
					node = {
						type: "MemberExpression",
						computed: false,
						object: node,
						property: parseIdentifier()
					};
				} else if (ch === "[") {
					index++;
					const property = parseConditional() ?? fail("Expected expression");
					skipSpaces();
					if (char() !== "]") fail("Unclosed [");
					index++;
					node = {
						type: "MemberExpression",
						computed: true,
						object: node,
						property
					};
				} else if (ch === "(") {
					index++;
					node = {
						type: "CallExpression",
						callee: node,
						arguments: parseList(")")
					};
				} else return node;
			}
		};
		const expressions = [];
		while (index < source.length) {
			const ch = char();
			if (ch === ";" || ch === "," || isSpace(ch)) {
				index++;
				continue;
			}
			const expression = parseConditional();
			if (expression) expressions.push(expression);
			else if (index < source.length) fail(`Unexpected "${char()}"`);
		}
		return expressions.length === 1 ? expressions[0] : {
			type: "Compound",
			body: expressions
		};
	}
	function binaryExpression(operator, left, right) {
		return operator === "&&" || operator === "||" ? {
			type: "LogicalExpression",
			operator,
			left,
			right
		} : {
			type: "BinaryExpression",
			operator,
			left,
			right
		};
	}

//#endregion
//#region src/template/parser.ts
	const voidElements = new Set("area,base,basefont,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr".split(","));
	const startTagPattern = /<([A-Za-z][\w:.-]*)((?:\s+[^\s"'<>/={}]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|(?:[^\s"'=<>`/]|\/(?!>))+))?)*)\s*(\/?)>/y;
	const attributePattern = /([^\s"'<>/={}]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|((?:[^\s"'=<>`/]|\/(?!>))+)))?/g;
	const endTagPattern = /<\/([A-Za-z][\w:.-]*)[^>]*>/y;
	const handlebarPattern = /\{\{([#=!>|{/])?\s*((?:"[^"]*"|'[^']*'|[^}"'])*?)\s*\/?\}?\}\}/y;
	const tagNamePattern = /^([^\s(]*)\s*([\s\S]*)$/;
	/**
	* Parses a template.
	*
	* @throws {Error} if the template is malformed
	*/
	function parseTemplate(source) {
		const root = {
			kind: "root",
			tag: "",
			children: []
		};
		const stack = [root];
		const current = () => stack[stack.length - 1];
		const add = (node) => {
			current().children.push(node);
		};
		const innermostBlock = () => {
			for (let i = stack.length - 1; i >= 0; i--) if (stack[i].kind === "block") return stack[i];
		};
		const close = (kind, tag) => {
			for (let i = stack.length - 1; i > 0; i--) if (stack[i].kind === kind && stack[i].tag === tag) {
				stack.length = i;
				return;
			}
		};
		const openBranch = (tag, closes, parents) => {
			const previous = innermostBlock();
			if (previous && closes.includes(previous.tag)) close("block", previous.tag);
			const parent = innermostBlock();
			if (!parent || !parents.includes(parent.tag)) throw new Error(`'${tag}' must be inside of a '${parents.join("' or '")}' block`);
			return parent;
		};
		const openBlock = (tag, args) => {
			switch (tag) {
				case "if":
				case "unless": {
					const children = [];
					const node = {
						type: "if",
						branches: [{
							condition: parseExpression(args),
							negate: tag === "unless",
							children
						}]
					};
					add(node);
					stack.push({
						kind: "block",
						tag,
						children,
						node
					});
					return;
				}
				case "elif":
				case "else": {
					const parent = openBranch(tag, ["elif"], tag === "elif" ? ["if", "unless"] : [
						"if",
						"unless",
						"each"
					]);
					const children = [];
					const block = parent.node;
					if (block.type === "each") block.elseChildren = children;
					else if (block.type === "if") block.branches.push({
						condition: tag === "else" ? void 0 : parseExpression(args),
						negate: false,
						children
					});
					stack.push({
						kind: "block",
						tag,
						children
					});
					return;
				}
				case "each": {
					const node = {
						type: "each",
						collection: parseExpression(args),
						children: [],
						elseChildren: void 0
					};
					add(node);
					stack.push({
						kind: "block",
						tag,
						children: node.children,
						node
					});
					return;
				}
				case "fsm": {
					const node = {
						type: "fsm",
						fsm: parseExpression(args),
						states: /* @__PURE__ */ new Map()
					};
					add(node);
					stack.push({
						kind: "block",
						tag,
						children: [],
						node
					});
					return;
				}
				case "state": {
					const parent = openBranch(tag, ["state"], ["fsm"]);
					const children = [];
					if (parent.node?.type === "fsm") parent.node.states.set(stateName(args), children);
					stack.push({
						kind: "block",
						tag,
						children
					});
					return;
				}
				case "with": {
					const node = {
						type: "with",
						context: parseExpression(args),
						children: []
					};
					add(node);
					stack.push({
						kind: "block",
						tag,
						children: node.children,
						node
					});
					return;
				}
				default: throw new Error(`Unknown block helper '{{#${tag}}}'`);
			}
		};
		const parseHandlebar = (prefix, content) => {
			const [, name = "", args = ""] = tagNamePattern.exec(content);
			switch (prefix) {
				case "!": return;
				case "#":
					openBlock(name, args);
					return;
				case "/":
					close("block", name);
					return;
				case ">":
					add({
						type: "partial",
						name,
						args: expressionList(parseExpression(args))
					});
					return;
				default: add({
					type: "expression",
					expression: firstExpression(parseExpression(content)),
					literal: prefix === "{"
				});
			}
		};
		const parseStartTag = (tagName, attributeSource, selfClosing) => {
			const tag = tagName.toLowerCase();
			const attributes = [];
			for (const [, name = "", doubleQuoted, singleQuoted, unquoted] of attributeSource.matchAll(attributePattern)) {
				const value = doubleQuoted ?? singleQuoted ?? unquoted ?? (booleanAttributes.has(name) ? name : "");
				attributes.push({
					name,
					value
				});
			}
			const node = {
				type: "element",
				tag,
				attributes,
				children: []
			};
			add(node);
			if (!selfClosing && !voidElements.has(tag)) stack.push({
				kind: "element",
				tag,
				children: node.children
			});
		};
		let index = 0;
		let textStart = 0;
		const flushText = () => {
			if (index > textStart) add({
				type: "text",
				text: source.slice(textStart, index)
			});
		};
		const matchAt = (pattern) => {
			pattern.lastIndex = index;
			return pattern.exec(source);
		};
		while (index < source.length) if (source.startsWith("<!--", index)) {
			const end = source.indexOf("-->", index + 4);
			if (end < 0) throw new Error(`Unclosed comment at character ${index}`);
			flushText();
			add({
				type: "comment",
				text: source.slice(index + 4, end)
			});
			index = textStart = end + 3;
		} else if (source.startsWith("</", index)) {
			const match = matchAt(endTagPattern) ?? fail(source, index, "Invalid end tag");
			flushText();
			close("element", match[1].toLowerCase());
			index = textStart = endTagPattern.lastIndex;
		} else if (source[index] === "<" && /[A-Za-z]/.test(source[index + 1] ?? "")) {
			const match = matchAt(startTagPattern) ?? fail(source, index, "Invalid tag");
			flushText();
			parseStartTag(match[1], match[2], match[3] === "/");
			index = textStart = startTagPattern.lastIndex;
		} else if (source.startsWith("{{", index)) {
			const match = matchAt(handlebarPattern) ?? fail(source, index, "Unclosed {{");
			flushText();
			parseHandlebar(match[1], match[2]);
			index = textStart = handlebarPattern.lastIndex;
		} else index++;
		flushText();
		return root.children;
	}
	function fail(source, index, message) {
		throw new Error(`Parse error: ${message} at character ${index}: ${source.slice(index, index + 30)}`);
	}
	function expressionList(expression) {
		return expression.type === "Compound" ? expression.body : [expression];
	}
	function firstExpression(expression) {
		return expression.type === "Compound" ? expression.body[0] ?? expression : expression;
	}
	function stateName(args) {
		const expression = firstExpression(parseExpression(args));
		if (expression.type === "Identifier") return expression.name;
		if (expression.type === "Literal") return String(expression.value);
		throw new Error(`Invalid state name '${args}'`);
	}

//#endregion
//#region src/template/template.ts
	const inert = {
		onAdd() {},
		onRemove() {},
		pause() {},
		resume() {},
		destroy() {}
	};
	const partials = /* @__PURE__ */ new Map();
	const customPartials = /* @__PURE__ */ new Map();
	/** The instance behind each node returned by a template function */
	const renderedTemplates = /* @__PURE__ */ new WeakMap();
	const outAttributePattern = /^(data-)?cjs-out$/;
	const eventAttributePattern = /^(data-)?cjs-on-(\w+)$/;
	function callAll(instances, method) {
		untracked(() => {
			for (const instance of instances) instance[method]();
		});
	}
	function createInstances(nodes, context, scopes) {
		return untracked(() => nodes.map((node) => createInstance(node, context, scopes)));
	}
	function nodesOf(instances) {
		return instances.flatMap((instance) => instance.nodes());
	}
	function createInstance(node, context, scopes) {
		switch (node.type) {
			case "text": {
				const text = document.createTextNode(node.text);
				return {
					...inert,
					nodes: () => [text]
				};
			}
			case "comment": {
				const comment = document.createComment(node.text);
				return {
					...inert,
					nodes: () => [comment]
				};
			}
			case "element": return elementInstance(document.createElement(node.tag), node.children, node.attributes, context, scopes);
			case "expression": return node.literal ? htmlInstance(node.expression, context, scopes) : expressionInstance(node.expression, context, scopes);
			case "partial": return partialInstance(node.name, node.args, context, scopes);
			case "if": return ifInstance(node, context, scopes);
			case "each": return eachInstance(node, context, scopes);
			case "fsm": return fsmInstance(node, context, scopes);
			case "with": return withInstance(node, context, scopes);
		}
	}
	function elementInstance(element, children, attributes, context, scopes) {
		const childInstances = createInstances(children, context, scopes);
		const bindings = [];
		const constraints = [];
		const cleanups = [];
		for (const { name, value } of attributes) {
			const eventMatch = eventAttributePattern.exec(name);
			if (outAttributePattern.test(name)) {
				const input = inputValue(element);
				constraints.push(input);
				if (context instanceof MapConstraint) context.put(value, input, void 0, true);
				else context[value] = input;
			} else if (eventMatch) {
				const eventType = eventMatch[2];
				const handlerName = value.trim();
				const listener = (event) => untracked(() => {
					const handler = evaluate({
						type: "Identifier",
						name: handlerName
					}, context, scopes);
					if (typeof handler !== "function") throw new TypeError(`${name}: '${value}' is not a function in the template's context`);
					return handler.call(get(scopes[scopes.length - 1]?.self), event);
				});
				element.addEventListener(eventType, listener);
				cleanups.push(() => element.removeEventListener(eventType, listener));
			} else {
				const attributeValue = interpolate(value, context, scopes, constraints);
				if (typeof attributeValue === "string") element.setAttribute(name, attributeValue);
				else if (name === "class") bindings.push(bindClass(element, attributeValue));
				else bindings.push(bindAttr(element, name, attributeValue));
			}
		}
		const childNodes = new Constraint(() => nodesOf(childInstances));
		constraints.push(childNodes);
		bindings.push(bindChildren(element, childNodes));
		return {
			nodes: () => [element],
			onAdd() {
				for (const binding of bindings) binding.resume();
				callAll(childInstances, "onAdd");
			},
			onRemove() {
				for (const binding of bindings) binding.pause();
				callAll(childInstances, "onRemove");
			},
			pause() {
				callAll(childInstances, "pause");
				for (const binding of bindings) binding.pause();
			},
			resume() {
				callAll(childInstances, "resume");
				for (const binding of bindings) binding.resume();
			},
			destroy() {
				callAll(childInstances, "destroy");
				for (const binding of bindings) binding.destroy();
				for (const constraint of constraints) constraint.destroy();
				for (const cleanup of cleanups) cleanup();
			}
		};
	}
	function interpolate(text, context, scopes, constraints) {
		const parts = text.split(/\{\{([^}]+)\}\}/);
		if (parts.length === 1) return text;
		const pieces = parts.map((part, i) => i % 2 === 1 ? expressionConstraint(parseExpression(part), context, scopes) : part).filter((piece) => piece !== "");
		for (const piece of pieces) if (piece instanceof Constraint) constraints.push(piece);
		if (pieces.length === 1 && pieces[0] instanceof Constraint) return pieces[0];
		const joined = new Constraint(() => pieces.map((piece) => piece instanceof Constraint ? piece.get() : piece).join(""));
		constraints.push(joined);
		return joined;
	}
	function expressionConstraint(expression, context, scopes) {
		return new Constraint(() => evaluate(expression, context, scopes));
	}
	function expressionInstance(expression, context, scopes) {
		const value = expressionConstraint(expression, context, scopes);
		const initialValue = value.get();
		if (isPolyDOM(initialValue)) {
			const node = firstDOMNode(initialValue);
			return {
				...inert,
				nodes: () => [node],
				destroy: () => value.destroy(true)
			};
		}
		const text = document.createTextNode("");
		const binding = bindText(text, value);
		return {
			nodes: () => [text],
			onAdd: () => binding.resume(),
			onRemove: () => binding.pause(),
			pause: () => binding.pause(),
			resume: () => binding.resume(),
			destroy() {
				binding.destroy();
				value.destroy(true);
			}
		};
	}
	function htmlInstance(expression, context, scopes) {
		const value = expressionConstraint(expression, context, scopes);
		const nodes = new Constraint(() => {
			const html = value.get();
			if (isPolyDOM(html)) return domNodesOf(html).filter(isDOMNode);
			const template = document.createElement("template");
			template.innerHTML = html == null ? "" : String(html);
			return Array.from(template.content.childNodes);
		});
		return {
			...inert,
			nodes: () => nodes.get(),
			destroy() {
				nodes.destroy(true);
				value.destroy(true);
			}
		};
	}
	function partialInstance(name, argExpressions, context, scopes) {
		const args = () => argExpressions.map((arg) => evaluate(arg, context, scopes));
		const partial = partials.get(name);
		if (partial) {
			const node = partial.call(globalThis, ...args());
			const instance = renderedTemplates.get(node);
			return {
				nodes: () => [node],
				onAdd: () => instance?.onAdd(),
				onRemove: () => instance?.onRemove(),
				pause: () => instance?.pause(),
				resume: () => instance?.resume(),
				destroy: () => destroyTemplate(node)
			};
		}
		const custom = customPartials.get(name);
		if (custom) {
			const node = firstDOMNode(custom.createNode(...args()));
			if (!node) throw new Error(`Custom partial '${name}': createNode didn't return a DOM node`);
			return {
				nodes: () => [node],
				onAdd: () => custom.onAdd?.call(custom, node, ...args()),
				onRemove: () => custom.onRemove?.call(custom, node),
				pause: () => custom.pause?.call(custom, node),
				resume: () => custom.resume?.call(custom, node),
				destroy: () => custom.destroyNode?.call(custom, node)
			};
		}
		throw new Error(`Could not find partial with name '${name}'`);
	}
	function ifInstance(node, context, scopes) {
		const branchInstances = [];
		let active = [];
		let activeIndex = -1;
		const holds = ({ condition, negate }) => {
			if (!condition) return true;
			const value = Boolean(get(evaluate(condition, context, scopes)));
			return negate ? !value : value;
		};
		return {
			nodes() {
				const index = node.branches.findIndex(holds);
				if (index !== activeIndex) {
					callAll(active, "onRemove");
					active = index < 0 ? [] : branchInstances[index] ??= createInstances(node.branches[index].children, context, scopes);
					callAll(active, "onAdd");
					activeIndex = index;
				}
				return nodesOf(active);
			},
			onAdd: () => callAll(active, "onAdd"),
			onRemove: () => callAll(active, "onRemove"),
			pause: () => callAll(active, "pause"),
			resume: () => callAll(active, "resume"),
			destroy() {
				for (const instances of branchInstances) if (instances) callAll(instances, "destroy");
				branchInstances.length = 0;
				active = [];
				activeIndex = -1;
			}
		};
	}
	const ELSE_ITEM = {
		value: Symbol("else"),
		isEntry: false
	};
	const sameItem = (a, b) => a.value === b.value && a.key === b.key && a.isEntry === b.isEntry;
	function eachItems(collection) {
		if (collection instanceof ArrayConstraint) return collection.toArray().map((value) => ({
			value,
			isEntry: false
		}));
		if (Array.isArray(collection)) return Array.from(collection, (value) => ({
			value,
			isEntry: false
		}));
		if (collection instanceof MapConstraint) return collection.entries().map(({ key, value }) => ({
			key,
			value,
			isEntry: true
		}));
		if (collection instanceof Constraint) return eachItems(collection.get());
		if (collection !== null && typeof collection === "object") return Object.entries(collection).map(([key, value]) => ({
			key,
			value,
			isEntry: true
		}));
		return [];
	}
	function eachInstance(node, context, scopes) {
		let rows = [];
		const createRow = (item, index) => {
			if (item === ELSE_ITEM) return {
				item,
				instances: createInstances(node.elseChildren, context, scopes)
			};
			const indexConstraint = new Constraint(index);
			const specials = item.isEntry ? {
				key: item.key,
				index: indexConstraint
			} : { index: indexConstraint };
			const rowScopes = [...scopes, {
				self: item.value,
				specials
			}];
			return {
				item,
				index: indexConstraint,
				instances: createInstances(node.children, context, rowScopes)
			};
		};
		const allInstances = () => rows.flatMap((row) => row.instances);
		return {
			nodes() {
				const items = eachItems(evaluate(node.collection, context, scopes));
				const wanted = items.length === 0 && node.elseChildren ? [ELSE_ITEM] : items;
				const oldRows = rows;
				const sources = matchIndices(oldRows.map((row) => row.item), wanted, sameItem);
				const kept = new Set(sources);
				const added = [];
				rows = wanted.map((item, index) => {
					const source = sources[index];
					if (source < 0) {
						const row = createRow(item, index);
						added.push(row);
						return row;
					}
					const row = oldRows[source];
					untracked(() => row.index?.set(index));
					return row;
				});
				for (const [i, row] of oldRows.entries()) {
					if (kept.has(i)) continue;
					callAll(row.instances, "onRemove");
					callAll(row.instances, "destroy");
					row.index?.destroy(true);
				}
				for (const row of added) callAll(row.instances, "onAdd");
				return nodesOf(allInstances());
			},
			onAdd: () => callAll(allInstances(), "onAdd"),
			onRemove: () => callAll(allInstances(), "onRemove"),
			pause: () => callAll(allInstances(), "pause"),
			resume: () => callAll(allInstances(), "resume"),
			destroy() {
				for (const row of rows) {
					callAll(row.instances, "destroy");
					row.index?.destroy(true);
				}
				rows = [];
			}
		};
	}
	function fsmInstance(node, context, scopes) {
		const stateInstances = /* @__PURE__ */ new Map();
		let active = [];
		let activeState;
		return {
			nodes() {
				const fsm = evaluate(node.fsm, context, scopes);
				const state = typeof fsm?.getState === "function" ? fsm.getState() : null;
				if (state !== activeState) {
					callAll(active, "onRemove");
					const children = state === null ? void 0 : node.states.get(state);
					if (children && !stateInstances.has(state)) stateInstances.set(state, createInstances(children, context, scopes));
					active = children ? stateInstances.get(state) : [];
					callAll(active, "onAdd");
					activeState = state;
				}
				return nodesOf(active);
			},
			onAdd: () => callAll(active, "resume"),
			onRemove: () => callAll(active, "pause"),
			pause: () => callAll(active, "pause"),
			resume: () => callAll(active, "resume"),
			destroy() {
				for (const instances of stateInstances.values()) callAll(instances, "destroy");
				stateInstances.clear();
				active = [];
				activeState = void 0;
			}
		};
	}
	function withInstance(node, context, scopes) {
		const newContext = expressionConstraint(node.context, context, scopes);
		let current;
		const instances = () => current?.instances ?? [];
		return {
			nodes() {
				const value = newContext.get();
				if (!current || current.context !== value) {
					const previous = current;
					current = {
						context: value,
						instances: createInstances(node.children, value, [...scopes, { self: value }])
					};
					if (previous) {
						callAll(previous.instances, "onRemove");
						callAll(previous.instances, "destroy");
						callAll(current.instances, "onAdd");
					}
				}
				return nodesOf(current.instances);
			},
			onAdd: () => callAll(instances(), "onAdd"),
			onRemove: () => callAll(instances(), "onRemove"),
			pause: () => callAll(instances(), "pause"),
			resume: () => callAll(instances(), "resume"),
			destroy() {
				callAll(instances(), "destroy");
				newContext.destroy(true);
				current = void 0;
			}
		};
	}
	function renderTemplate(template, context, parent) {
		const scopes = [{ self: context }];
		const parentElement = firstDOMNode(parent);
		const onlyChild = template.length === 1 ? template[0] : void 0;
		const instance = !parentElement && onlyChild?.type === "element" ? createInstance(onlyChild, context, scopes) : elementInstance((isElement(parentElement) ? parentElement : void 0) ?? document.createElement("span"), template, [], context, scopes);
		const [node] = instance.nodes();
		renderedTemplates.set(node, instance);
		return node;
	}
	function templateSource(template) {
		if (typeof template === "string") return template;
		if (isJQuery(template) || isNodeList(template) || isDOMNode(template)) return (firstDOMNode(template)?.textContent ?? "").trim();
		return String(template);
	}
	function createTemplate(template, ...args) {
		const parsed = parseTemplate(templateSource(template));
		const render = (context, parent) => renderTemplate(parsed, context, parent);
		return args.length > 0 ? render(args[0], args[1]) : render;
	}
	/**
	* Registers a template (or template source) as a partial that other templates can use.
	*
	* @example Registering a partial named `my_template`
	*     var my_temp = cjs.createTemplate(...);
	*     cjs.registerPartial('my_template', my_temp);
	*
	*     // Then, in any other template:
	*     {{>my_template context}}
	*/
	function registerPartial(name, template) {
		partials.set(name, typeof template === "string" ? createTemplate(template) : template);
	}
	/**
	* Registers a *custom* partial, whose DOM node is created by a function, that other templates can use.
	*
	* @example
	*     cjs.registerCustomPartial('my_custom_partial', {
	*         createNode: function(context) {
	*             return document.createElement('span');
	*         },
	*         destroyNode: function(dom_node) {
	*             // something like: completely_destroy(dom_node);
	*         },
	*         onAdd: function(dom_node) {
	*             // something like: do_init(dom_node);
	*         },
	*         onRemove: function(dom_node) {
	*             // something like: cleanup(dom_node);
	*         }
	*     });
	*
	*     // Then, in any other template:
	*     {{>my_custom_partial context}}
	*/
	function registerCustomPartial(name, options) {
		customPartials.set(name, options);
	}
	/** Unregisters a partial (registered with `registerPartial` or `registerCustomPartial`). */
	function unregisterPartial(name) {
		partials.delete(name);
		customPartials.delete(name);
	}
	/**
	* Stops a rendered template from updating and cleans up after it.
	*
	* @param node - A DOM node returned by a template function
	*/
	function destroyTemplate(node) {
		const domNode = firstDOMNode(node);
		const instance = domNode && renderedTemplates.get(domNode);
		if (!instance) return;
		renderedTemplates.delete(domNode);
		instance.destroy();
	}
	/**
	* Pauses updates to a rendered template (until `resumeTemplate`).
	*
	* @param node - A DOM node returned by a template function
	*/
	function pauseTemplate(node) {
		const domNode = firstDOMNode(node);
		if (domNode) renderedTemplates.get(domNode)?.pause();
	}
	/**
	* Resumes updates to a rendered template (after `pauseTemplate`).
	*
	* @param node - A DOM node returned by a template function
	*/
	function resumeTemplate(node) {
		const domNode = firstDOMNode(node);
		if (domNode) renderedTemplates.get(domNode)?.resume();
	}
	/**
	* Parses an expression (with the same syntax as template expressions) and returns a constraint
	* for its value. Names in the expression are looked up on `context` (an object or map
	* constraint). If the expression can't be parsed or evaluated, the error is logged and the
	* value is `undefined`.
	*
	* @param source - The expression (or a constraint whose value is one)
	*
	* @example
	*     var a = cjs(1);
	*     var x = cjs.createParsedConstraint("a+b", {a: a, b: cjs(2)});
	*     x.get(); // 3
	*     a.set(2);
	*     x.get(); // 4
	*/
	function createParsedConstraint(source, context) {
		let parsedSource;
		let parsed;
		return new Constraint(() => {
			try {
				const text = String(get(source));
				if (text !== parsedSource || !parsed) {
					parsed = parseExpression(text);
					parsedSource = text;
				}
				return evaluate(parsed, context, [{ self: context }]);
			} catch (error) {
				console.error(error);
				return;
			}
		});
	}

//#endregion
//#region src/index.ts
	function createConstraint(value, options) {
		if (Array.isArray(value)) return new ArrayConstraint({
			value,
			...options
		});
		if (isPolyDOM(value)) return inputValue(value);
		if (isPlainObject(value)) return new MapConstraint({
			value,
			...options
		});
		return new Constraint(value, options);
	}
	function isPlainObject(value) {
		if (value === null || typeof value !== "object") return false;
		const prototype = Object.getPrototypeOf(value);
		return prototype === null || Object.getPrototypeOf(prototype) === null;
	}
	const previousCjs = globalThis.cjs;
	const cjs = Object.assign(createConstraint, {
		Constraint,
		ArrayConstraint,
		MapConstraint,
		FSM,
		Binding,
		CJSEvent,
		/**
		* Creates a constraint.
		*
		* @param value - The initial value, a function to compute it, or a constraint to follow
		* @see Constraint
		*/
		constraint: (value, options) => new Constraint(value, options),
		/**
		* Creates an array constraint.
		*
		* @example
		*     var arr = cjs.array({
		*         value: [1,2,3]
		*     });
		*/
		array: (options) => new ArrayConstraint(options),
		/**
		* Creates a map constraint.
		*
		* @example
		*     var map_obj = cjs.map({
		*         value: { foo: 1 }
		*     });
		*     map_obj.get('foo'); // 1
		*     map_obj.put('bar', 2);
		*     map_obj.get('bar'); // 2
		*/
		map: (options) => new MapConstraint(options),
		/**
		* Creates an FSM.
		*
		* @param stateNames - The FSM's states; the first one is the starting state
		*
		* @example A state machine with two states
		*     var my_state = cjs.fsm("state1", "state2");
		*/
		fsm: (...stateNames) => new FSM(...stateNames),
		/**
		* Creates a constraint whose value depends on the state of an FSM.
		*
		* @param values - For each state name, the constraint's value in that state
		*
		* @example
		*     var fsm = cjs.fsm("state1", "state2")
		*                  .addTransition("state1", "state2", cjs.on("click"));
		*     var x = cjs.inFSM(fsm, {
		*         state1: 'val1',
		*         state2: function() { return 'val2'; }
		*     });
		*/
		inFSM: (fsm, values) => new Constraint().inFSM(fsm, values),
		isConstraint,
		isArrayConstraint,
		isMapConstraint,
		isFSM,
		get,
		wait,
		signal,
		removeDependency,
		arrayDiff,
		liven,
		memoize,
		on,
		bindText,
		bindHTML,
		bindValue,
		bindChildren,
		bindAttr,
		bindCSS,
		bindClass,
		inputValue,
		createTemplate,
		createParsedConstraint,
		/** The version of ConstraintJS. */
		version: "0.10.2",
		/** `"ConstraintJS v" + cjs.version` */
		toString: () => `ConstraintJS v0.10.2`
	}, {
		registerPartial(name, template) {
			registerPartial(name, template);
			return cjs;
		},
		registerCustomPartial(name, options) {
			registerCustomPartial(name, options);
			return cjs;
		},
		unregisterPartial(name) {
			unregisterPartial(name);
			return cjs;
		},
		destroyTemplate(node) {
			destroyTemplate(node);
			return cjs;
		},
		pauseTemplate(node) {
			pauseTemplate(node);
			return cjs;
		},
		resumeTemplate(node) {
			resumeTemplate(node);
			return cjs;
		},
		noConflict() {
			const global = globalThis;
			if (global.cjs === cjs) global.cjs = previousCjs;
			return cjs;
		}
	});

//#endregion
//#region src/default-entry.ts
	var default_entry_default = cjs;

//#endregion
return default_entry_default;
})();
//# sourceMappingURL=cjs.js.map