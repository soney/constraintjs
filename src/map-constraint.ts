// Map Constraints
// ---------------

import { Constraint } from "./constraint";
import { get } from "./get";
import { batch } from "./scheduler";
import { BREAK, defaultEquals, type EqualityCheck, isPositiveInteger } from "./util";

/** How to hash keys (or values): a function, or the name of a method to call on each one. */
export type HashOption<K> = ((key: K) => unknown) | string;

/** Options for {@link MapConstraint}. */
export interface MapConstraintOptions<K = any, V = any> {
	/**
	 * Speeds up looking up keys. Keys that are equal must have the same hash. A function, or the
	 * name of a method to call on each key. *Default:* `String(key)`
	 */
	hash?: HashOption<K>;
	/** Speeds up `keyForValue`, like `hash` does for keys (`true` uses the default hash). *Default:* `false` */
	valuehash?: HashOption<V> | boolean;
	/** How to compare keys. *Default:* `===` */
	equals?: EqualityCheck<K>;
	/** How to compare values (for `keyForValue`). *Default:* `===` */
	valueequals?: EqualityCheck<V>;
	/** Initial entries, taken from an object's own properties. */
	value?: Record<string, V>;
	/** Initial keys, paired with `values`. They come before any entries from `value`. */
	keys?: readonly K[];
	/** Initial values, paired with `keys`. */
	values?: readonly V[];
	/** Treat function values as values, rather than as functions that compute them. *Default:* `false` */
	literal_values?: boolean;
	/**
	 * Reading a key that isn't set records a dependency anyway, so that the reader is updated if
	 * the key is added. *Default:* `true`
	 */
	create_unsubstantiated?: boolean;
}

// An entry's key, value, and index are all constraints, so that reading any of them is tracked
interface Entry<K, V> {
	readonly key: Constraint<K>;
	readonly value: Constraint<V>;
	readonly index: Constraint<number>;
}

const defaultHash = (key: unknown): string => String(key);

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
export class MapConstraint<K = any, V = any> {
	/** Return this from a `forEach` callback to stop iterating. */
	static readonly BREAK = BREAK;

	// (Function-valued fields are typed loosely so that MapConstraint is covariant in K and V)
	private _hash: (key: any) => string;
	private _valueHash: ((value: any) => string) | undefined;
	private readonly _literalValues: boolean;
	private readonly _createUnsubstantiated: boolean;
	private readonly _equalityCheck: Constraint<EqualityCheck<any>>;
	private readonly _valueEqualityCheck: Constraint<EqualityCheck<any>>;
	/** The entries, in order */
	private _entryList: Array<Entry<K, V>>;
	/** Entries grouped by the hash of their keys */
	private _keyBuckets = new Map<string, Array<Entry<K, V>>>();
	/** Entries grouped by the hash of their values (only if values are hashed) */
	private _valueBuckets: Map<string, Array<Entry<K, V>>> | undefined;
	/**
	 * Placeholder entries for keys that were read before they were set (grouped by key hash), so
	 * that whatever read them is notified when they're added
	 */
	private _placeholders = new Map<string, Array<Entry<K, V>>>();
	// Views of the whole map
	private readonly _keysView: Constraint<K[]>;
	private readonly _valuesView: Constraint<V[]>;
	private readonly _entriesView: Constraint<Array<{ key: K; value: V }>>;
	private readonly _sizeView: Constraint<number>;

	constructor(options?: MapConstraintOptions<K, V>) {
		const {
			hash = defaultHash,
			valuehash = false,
			equals = defaultEquals,
			valueequals = defaultEquals,
			value = {},
			keys = [],
			values = [],
			literal_values = false,
			create_unsubstantiated = true,
		} = options ?? {};

		this._hash = toHashFunction(hash);
		this._valueHash = valuehash ? toHashFunction(valuehash === true ? defaultHash : valuehash) : undefined;
		this._valueBuckets = this._valueHash ? new Map() : undefined;
		this._literalValues = !!literal_values;
		this._createUnsubstantiated = create_unsubstantiated;
		this._equalityCheck = new Constraint<EqualityCheck<K>>(equals, { literal: true });
		this._valueEqualityCheck = new Constraint<EqualityCheck<V>>(valueequals, { literal: true });

		// Entries from `keys`/`values` come first, then any from `value` that aren't already there
		const initialKeys = [...keys];
		const initialValues = [...values];
		const givenKeys = new Set(initialKeys.map(String));
		for (const [key, entryValue] of Object.entries(value)) {
			if (!givenKeys.has(key)) {
				initialKeys.push(key as K);
				initialValues.push(entryValue);
			}
		}
		this._entryList = initialKeys.map((key, index) => {
			const entry = this._createEntry(key, initialValues[index] as V, index, this._literalValues);
			addToBucket(this._keyBuckets, this._hash(key), entry);
			if (this._valueBuckets) addToBucket(this._valueBuckets, this._valueHash!(initialValues[index] as V), entry);
			return entry;
		});

		this._keysView = new Constraint(() => {
			const result: K[] = [];
			this.forEach((_, key, index) => {
				result[index] = key;
			});
			return result;
		});
		this._valuesView = new Constraint(() => {
			const result: V[] = [];
			this.forEach((entryValue, _, index) => {
				result[index] = entryValue;
			});
			return result;
		});
		this._entriesView = new Constraint(() => {
			const result: Array<{ key: K; value: V }> = [];
			this.forEach((entryValue, key, index) => {
				result[index] = { key, value: entryValue };
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
	keys(): K[] {
		return this._keysView.get();
	}

	/**
	 * The values, in order.
	 *
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.values(); // [1,2]
	 */
	values(): V[] {
		return this._valuesView.get();
	}

	/**
	 * Every entry, in order, as `{key, value}` objects.
	 *
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.entries(); // [{key:'x',value:1}, {key:'y',value:2}]
	 */
	entries(): Array<{ key: K; value: V }> {
		return this._entriesView.get();
	}

	/**
	 * The number of entries.
	 *
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.size(); // 2
	 */
	size(): number {
		return this._sizeView.get();
	}

	/**
	 * Whether there are no entries.
	 *
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.isEmpty(); // false
	 */
	isEmpty(): boolean {
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
	put(key: K, value: V, index?: number, literal?: boolean): this {
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
	remove(key: K, silent?: boolean): this {
		const { hash, entry } = this._find(key);
		if (!entry) return this;
		batch(() => {
			removeFromBucket(this._keyBuckets, hash, entry);
			if (this._valueBuckets) removeFromBucket(this._valueBuckets, this._valueHash!(entry.value.get(false)), entry);
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
	get(key: K): V | undefined {
		const { hash, entry } = this._find(key);
		if (entry) return entry.value.get();
		if (!this._createUnsubstantiated) return undefined;
		// Read a placeholder, so that the reader is updated if `key` is added later
		return this._placeholder(hash, key, true)!.value.get();
	}

	/**
	 * With no arguments: a plain object of the entries (see `toObject`). With `key`: the value for
	 * `key`. With `key` and `value` (and optionally `index`): sets the value for `key` (see `put`).
	 *
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.item();       // {x:1,y:2}
	 *     map.item('x');    // 1
	 *     map.item('z', 3);
	 *     map.keys();       // ['x','y','z']
	 */
	item(): Record<string, V>;
	item(key: K): V | undefined;
	item(key: K, value: V, index?: number): this;
	item(...args: unknown[]): Record<string, V> | V | undefined | this {
		if (args.length === 0) return this.toObject();
		if (args.length === 1) return this.get(args[0] as K);
		return this.put(args[0] as K, args[1] as V, args[2] as number | undefined);
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
	itemConstraint(key: K | Constraint<K>): Constraint<V | undefined> {
		return new Constraint(() => this.get(get(key) as K));
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
	clear(silent?: boolean): this {
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
	forEach(callback: (this: any, value: V, key: K, index: number) => unknown, thisArg: unknown = this): this {
		const size = this.size();
		const entries = this._entryList.slice();
		for (let i = 0; i < size; i++) {
			const entry = entries[i];
			if (entry && callback.call(thisArg, entry.value.get(), entry.key.get(), entry.index.get()) === BREAK) break;
		}
		return this;
	}

	/** Change how keys are compared. */
	setEqualityCheck(equalityCheck: EqualityCheck<K>): this {
		this._equalityCheck.set(equalityCheck);
		return this;
	}

	/** Change how values are compared (for `keyForValue`). */
	setValueEqualityCheck(equalityCheck: EqualityCheck<V>): this {
		this._valueEqualityCheck.set(equalityCheck);
		return this;
	}

	/** Change how keys are hashed: a function, or the name of a method to call on each key. */
	setHash(hash: HashOption<K>): this {
		this._hash = toHashFunction(hash);
		const hashKey = (entry: Entry<K, V>) => this._hash(entry.key.get(false));
		this._keyBuckets = groupByHash(this._entryList, hashKey);
		this._placeholders = groupByHash([...this._placeholders.values()].flat(), hashKey);
		return this;
	}

	/** Change how values are hashed (see the `valuehash` option); `false` turns value hashing off. */
	setValueHash(hash: HashOption<V> | boolean): this {
		const valueHash = hash ? toHashFunction(hash === true ? defaultHash : hash) : undefined;
		this._valueHash = valueHash;
		this._valueBuckets = valueHash
			? groupByHash(this._entryList, (entry) => valueHash(entry.value.get(false)))
			: undefined;
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
	indexOf(key: K): number {
		const { hash, entry } = this._find(key);
		if (entry) return entry.index.get();
		if (!this._createUnsubstantiated) return -1;
		// A placeholder's index is -1 until its key is added
		return this._placeholder(hash, key, true)!.index.get();
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
	getOrPut(key: K, create: (this: any, key: K) => V, context?: unknown, index?: number, literal?: boolean): V {
		const { entry } = this._find(key);
		if (entry) return entry.value.get();
		return batch(() => {
			const value = create.call(context ?? this, key);
			// `create` may have changed this map, so `put` looks the key up again
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
	has(key: K): boolean {
		const { hash, entry } = this._find(key);
		if (entry) return true;
		// Depend on a placeholder, so that the reader is updated if `key` is added later
		if (this._createUnsubstantiated) this._placeholder(hash, key, true)!.index.get();
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
	moveIndex(oldIndex: number, newIndex: number): this {
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
	move(key: K, index: number): this {
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
	keyForValue(value: V, equalityCheck?: EqualityCheck<V>): K | undefined {
		const equals = equalityCheck ?? this._valueEqualityCheck.get();
		if (this._valueHash && this._valueBuckets) {
			const bucket = this._valueBuckets.get(this._valueHash(value));
			return bucket?.find((entry) => equals(entry.value.get(), value))?.key.get();
		}
		let found: K | undefined;
		this.forEach((candidate, key) => {
			if (!equals(value, candidate)) return undefined;
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
	destroy(silent?: boolean): void {
		batch(() => {
			this.clear(silent);
			for (const placeholders of this._placeholders.values()) {
				for (const entry of placeholders) destroyEntry(entry, silent);
			}
			this._placeholders.clear();
			for (const constraint of [
				this._equalityCheck,
				this._valueEqualityCheck,
				this._keysView,
				this._valuesView,
				this._entriesView,
				this._sizeView,
			]) {
				constraint.destroy(silent);
			}
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
	toObject(keyMap: (key: K) => PropertyKey = (key) => key as PropertyKey): Record<string, V> {
		const result: Record<PropertyKey, V> = {};
		this.forEach((value, key) => {
			result[keyMap(key)] = value;
		});
		return result;
	}

	private _createEntry(key: K, value: V, index: number, literal: boolean): Entry<K, V> {
		return {
			key: new Constraint<K>(key, { literal: true }),
			value: new Constraint<V>(value, { literal }),
			index: new Constraint<number>(index, { literal: true }),
		};
	}

	// Finds the entry for `key`. Reads the equality check and the keys it compares against, so
	// that a constraint doing the lookup is updated if the lookup's result would change.
	private _find(key: K): { hash: string; entry: Entry<K, V> | undefined } {
		const hash = this._hash(key);
		const equals = this._equalityCheck.get();
		const entry = this._keyBuckets.get(hash)?.find((candidate) => equals(candidate.key.get(), key));
		return { hash, entry };
	}

	// The placeholder for a key that isn't set (created if `create` is true)
	private _placeholder(hash: string, key: K, create: boolean): Entry<K, V> | undefined {
		const equals = this._equalityCheck.get();
		let entry = this._placeholders.get(hash)?.find((candidate) => equals(candidate.key.get(), key));
		if (!entry && create) {
			entry = this._createEntry(key, undefined as V, -1, this._literalValues);
			addToBucket(this._placeholders, hash, entry);
		}
		return entry;
	}

	private _update(entry: Entry<K, V>, value: V, index: number | undefined): void {
		if (this._valueHash && this._valueBuckets) {
			removeFromBucket(this._valueBuckets, this._valueHash(entry.value.get(false)), entry);
			addToBucket(this._valueBuckets, this._valueHash(value), entry);
		}
		entry.value.set(value);
		if (isPositiveInteger(index)) this._move(entry.index.get(false), index);
		this._valuesView.invalidate();
		this._entriesView.invalidate();
	}

	private _insert(hash: string, key: K, value: V, index: number | undefined, literal: boolean | undefined): void {
		const size = this._entryList.length;
		const position = isPositiveInteger(index) ? Math.min(index, size) : size;
		// If something already tried to read this key, reuse its placeholder so that it's notified
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

	private _move(from: number, to: number): void {
		const size = this._entryList.length;
		if (!isPositiveInteger(from) || from >= size || !isPositiveInteger(to)) return;
		const target = Math.min(to, size - 1);
		if (target === from) return;
		const [entry] = this._entryList.splice(from, 1);
		this._entryList.splice(target, 0, entry!);
		for (let i = Math.min(from, target); i <= Math.max(from, target); i++) {
			this._entryList[i]!.index.set(i);
		}
		this._keysView.invalidate();
		this._valuesView.invalidate();
		this._entriesView.invalidate();
	}

	// Updates the index of every entry from `start` on
	private _reindex(start: number): void {
		for (let i = start; i < this._entryList.length; i++) this._entryList[i]!.index.set(i);
	}

	private _invalidateViews(): void {
		this._sizeView.invalidate();
		this._keysView.invalidate();
		this._valuesView.invalidate();
		this._entriesView.invalidate();
	}
}

/**
 * Whether `value` is a map constraint.
 */
export function isMapConstraint(value: unknown): value is MapConstraint {
	return value instanceof MapConstraint;
}

function toHashFunction<K>(hash: HashOption<K>): (key: K) => string {
	if (typeof hash === "string") return (key) => String((key as Record<string, () => unknown>)[hash]!());
	return (key) => String(hash(key));
}

function addToBucket<E>(buckets: Map<string, E[]>, hash: string, entry: E): void {
	const bucket = buckets.get(hash);
	if (bucket) bucket.push(entry);
	else buckets.set(hash, [entry]);
}

function removeFromBucket<E>(buckets: Map<string, E[]>, hash: string, entry: E): void {
	const bucket = buckets.get(hash);
	if (!bucket) return;
	const index = bucket.indexOf(entry);
	if (index >= 0) bucket.splice(index, 1);
	if (bucket.length === 0) buckets.delete(hash);
}

function groupByHash<E>(entries: Iterable<E>, hash: (entry: E) => string): Map<string, E[]> {
	const buckets = new Map<string, E[]>();
	for (const entry of entries) addToBucket(buckets, hash(entry), entry);
	return buckets;
}

function destroyEntry<K, V>(entry: Entry<K, V>, silent: boolean | undefined): void {
	entry.key.destroy(silent);
	entry.value.destroy(silent);
	entry.index.destroy(silent);
}
