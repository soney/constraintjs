// Constraints
// -----------
// A constraint holds a value that may be computed from other constraints. When a constraint
// computes its value, every constraint it reads is recorded as a dependency; when one of those
// changes, the constraint is invalidated (and recomputed lazily, the next time it's read).
// This follows the approach described in "Integrating pointer variables into one-way constraint
// models" (Vander Zanden et al., http://doi.acm.org/10.1145/180171.180174).

import type { FSM } from "./fsm";
import { get } from "./get";
import { binaryOperators, unaryOperators } from "./operators";
import { type ChangeListener, dequeue, enqueue, runQueuedListeners } from "./scheduler";
import { defaultEquals, type EqualityCheck } from "./util";

/** Options that control how a constraint computes and tracks its value. */
export interface ConstraintOptions<T = any> {
	/** Let the solver record when other constraints read this one. *Default:* `true` */
	auto_add_outgoing_dependencies?: boolean;
	/** Let the solver record the constraints this one reads. *Default:* `true` */
	auto_add_incoming_dependencies?: boolean;
	/** Keep track of the current value. *Default:* `true` */
	cache_value?: boolean;
	/**
	 * When invalidated, recompute right away and only invalidate dependents if the value actually
	 * changed. Useful when many constraints depend on one that rarely changes. *Default:* `false`
	 */
	check_on_nullify?: boolean;
	/** If the value is a function, the `this` it's called with. *Default:* the global object */
	context?: unknown;
	/** How to tell whether a new value is different from the old one. *Default:* `===` */
	equals?: EqualityCheck<T>;
	/** If the value is a function, treat the function itself as the value. *Default:* `false` */
	literal?: boolean;
	/** Whether `onChange` computes the value right away (so that the next change is noticed). *Default:* `true` */
	run_on_add_listener?: boolean;
}

/**
 * A function that computes a constraint's value. It's called with the constraint itself (for
 * `pauseGetter`/`resumeGetter`) and the `getterArg` passed to `get()`, if any.
 */
export type ConstraintGetter<T> = (this: any, constraint: Constraint<any>, getterArg?: unknown) => T;

/** What a constraint's value can be set to: a value, a function that computes one, or another constraint to follow. */
export type ConstraintSource<T> = T | ConstraintGetter<T> | Constraint<T>;

// A dependency: `to` reads `from`. The timestamp is `to`'s timestamp when it last read `from`,
// so an edge older than `to`'s current timestamp is one that `to` no longer uses.
interface Edge {
	readonly from: Constraint;
	readonly to: Constraint;
	timestamp: number;
}

let nextId = 0;
/** The constraints whose values are being computed right now, innermost last. */
const evaluationStack: Constraint[] = [];
/** Set when a constraint calls `pauseGetter()` while computing its value. */
let pendingPause: { constraint: Constraint; temporaryValue: unknown } | undefined;
/** Whether an invalidation is in progress (invalidations can trigger nested ones). */
let invalidating = false;
/** Constraints recomputed by `check_on_nullify` during the current invalidation (guards against loops). */
const rechecked = new Set<Constraint>();

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
export class Constraint<T = any> {
	/** @internal */ readonly _id = nextId++;
	// (Most constraints, like array items and plain values, never have dependencies, dependents, or
	// listeners, so these are only created when needed)
	/** @internal The constraints that read my value, by id */
	_outEdges: Map<number, Edge> | undefined = undefined;
	/** @internal The constraints whose values I read, by id */
	_inEdges: Map<number, Edge> | undefined = undefined;
	/** @internal Incremented every time I compute my value */
	_timestamp = 0;
	/** @internal Whether my cached value is up to date */
	_valid: boolean;
	/**
	 * @internal Whether I became invalid without telling my dependents and listeners (because my getter
	 * threw, or because of a silent `set`). The next change to anything I read has to tell them.
	 */
	_silentlyInvalid = false;

	// (Typed loosely so that `Constraint` is covariant in `T`: a `Constraint<number>` is a `Constraint<unknown>`)
	private _options: ConstraintOptions<any>;
	private _value: unknown;
	private _cachedValue: T | undefined;
	private _listeners: ChangeListener[] | undefined = undefined;
	/** Set while waiting for `resumeGetter()` */
	private _paused: { temporaryValue: unknown } | undefined;
	/** Set when `resumeGetter()` was called before my getter even returned */
	private _syncResume: { value: unknown } | undefined;

	/**
	 * @param value - The initial value, a function to compute it, or a constraint to follow
	 * @param options - How the value is computed and tracked
	 */
	constructor(value?: ConstraintSource<T>, options?: ConstraintOptions<NoInfer<T>>) {
		this._options = { context: globalThis, ...options };
		this._value = value;
		this._valid = isPlainValue(value, this._options);
		this._cachedValue = this._valid ? (value as T) : undefined;
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
	get(autoAddOutgoing?: boolean, getterArg?: unknown): T {
		this._recordDependency(autoAddOutgoing !== false);
		if (!this._valid && !this._paused) {
			// Recompute my value. (This is done here rather than in a helper method because every level
			// of a chain of constraints adds its frames to the call stack; fewer frames allow deeper chains.)
			this._timestamp++;
			// Mark myself valid first, so that if I read my own value I get the previous one (instead of recursing)
			this._valid = true;
			this._silentlyInvalid = false;
			evaluationStack.push(this);
			try {
				const source = this._value;
				if (this._options.cache_value === false) {
					// Nothing to store: just run the function (this is how `cjs.liven` works). There's no
					// value to wait for, so pausing doesn't apply.
					if (typeof source === "function") source.call(this._options.context);
					if (pendingPause?.constraint === this) pendingPause = undefined;
				} else {
					const value: T = this._options.literal
						? (source as T)
						: typeof source === "function"
							? (source as ConstraintGetter<T>).call(this._options.context ?? this, this, getterArg)
							: source instanceof Constraint
								? source.get()
								: (source as T);
					if (this._syncResume) {
						this._cachedValue = this._resolve(this._syncResume.value);
						this._syncResume = undefined;
					} else if (pendingPause?.constraint === this) {
						// My getter called pauseGetter(): until resumeGetter() is called, get() returns the temporary value
						this._paused = pendingPause;
						pendingPause = undefined;
					} else {
						this._cachedValue = value;
					}
				}
			} catch (error) {
				// Try again the next time my value is read, and make sure that the next change to anything
				// I read notifies my listeners (which may be waiting to retry)
				this._valid = false;
				this._silentlyInvalid = true;
				if (pendingPause?.constraint === this) pendingPause = undefined;
				this._syncResume = undefined;
				throw error;
			} finally {
				evaluationStack.pop();
			}
		}
		return (this._paused ? this._paused.temporaryValue : this._cachedValue) as T;
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
	set(value: ConstraintSource<T>, options?: { silent?: boolean }): this {
		const previous = this._value;
		this._value = value;
		if (options?.silent) {
			// Recompute my value the next time it's read, but leave everything that depends on me alone
			if (this._valid) {
				this._valid = false;
				this._silentlyInvalid = true;
			}
			return this;
		}
		const changed = isPlainValue(value, this._options)
			? !(this._options.equals ?? defaultEquals)(previous as T, value as T)
			: previous !== value;
		if (changed) invalidateAll([this]);
		return this;
	}

	/**
	 * Change how this constraint's value is computed (see {@link ConstraintOptions}).
	 *
	 * @example
	 *     var x = cjs(function() { return 1; });
	 *     x.get(); // 1
	 *     x.setOption({ literal: true, auto_add_outgoing_dependencies: false });
	 *     x.get(); // (function)
	 *
	 *     x.setOption("literal", false);
	 *     x.get(); // 1
	 */
	setOption(options: ConstraintOptions<T>): this;
	setOption<K extends keyof ConstraintOptions<T>>(key: K, value: ConstraintOptions<T>[K]): this;
	setOption(keyOrOptions: string | ConstraintOptions<T>, value?: unknown): this {
		const changes: ConstraintOptions<T> = typeof keyOrOptions === "string" ? { [keyOrOptions]: value } : keyOrOptions;
		Object.assign(this._options, changes);
		// A different `this` or literal-ness can change my value
		const affectsValue = Object.hasOwn(changes, "context") || Object.hasOwn(changes, "literal");
		return affectsValue ? this.invalidate() : this;
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
	invalidate(): this {
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
	isValid(): boolean {
		return this._valid;
	}

	/**
	 * Removes every dependency to and from this constraint.
	 *
	 * @param silent - If `true`, don't invalidate the constraints that depended on this one
	 * @see destroy
	 */
	remove(silent?: boolean): this {
		this._inEdges?.forEach((edge) => edge.from._outEdges?.delete(this._id));
		this._inEdges = undefined;
		const dependents: Constraint[] = [];
		this._collectDependents(dependents);
		this._outEdges?.forEach((edge) => edge.to._inEdges?.delete(this._id));
		this._outEdges = undefined;
		if (!silent) invalidateAll(dependents);
		// In case this constraint is used again, make sure it recomputes its value
		this._valid = false;
		this._silentlyInvalid = false;
		this._cachedValue = undefined;
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
	destroy(silent?: boolean): this {
		this._listeners?.forEach(dequeue);
		this._listeners = undefined;
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
	pauseGetter(temporaryValue?: unknown): this {
		pendingPause = { constraint: this, temporaryValue };
		return this;
	}

	/**
	 * Signal that this constraint, which was paused with `pauseGetter`, now has a value.
	 *
	 * @see pauseGetter
	 */
	resumeGetter(value?: unknown): this {
		if (pendingPause?.constraint === this) {
			// The value turned out to be available before my getter even returned
			pendingPause = undefined;
			this._syncResume = { value };
			return this;
		}
		this._paused = undefined;
		this._valid = true;
		// Compute my value as if my getter were still running (rather than on behalf of whatever
		// constraint happens to be computing its value right now)
		const outerStack = evaluationStack.splice(0);
		evaluationStack.push(this);
		try {
			if (this._options.cache_value !== false) this._cachedValue = this._resolve(value);
			else if (typeof value === "function") value.call(this._options.context);
		} finally {
			evaluationStack.length = 0;
			evaluationStack.push(...outerStack);
		}
		// Everything that read my temporary value needs to update
		const dependents: Constraint[] = [];
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
	onChange(callback: (...args: any[]) => unknown, thisArg?: unknown, ...args: unknown[]): this {
		return this.onChangeWithPriority(false, callback, thisArg, ...args);
	}

	/**
	 * Like `onChange`, but listeners with a higher `priority` are called before those with a lower
	 * one (or none).
	 */
	onChangeWithPriority(
		priority: number | false,
		callback: (...args: any[]) => unknown,
		thisArg?: unknown,
		...args: unknown[]
	): this {
		(this._listeners ??= []).push({
			callback,
			context: thisArg,
			args,
			priority: typeof priority === "number" ? priority : false,
			queued: false,
		});
		if (this._options.run_on_add_listener !== false) {
			// Make sure my value is up to date so that its next change is noticed, without making
			// anything that is computing its value right now depend on me
			this.get(false);
		}
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
	offChange(callback: (...args: any[]) => unknown, thisArg?: unknown): this {
		const listeners = this._listeners ?? [];
		for (let i = listeners.length - 1; i >= 0; i--) {
			const listener = listeners[i]!;
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
	inFSM(fsm: FSM, values: Record<string, ConstraintSource<T>>): this {
		for (const [state, value] of Object.entries(values)) {
			fsm.on(state, () => this.set(value));
			if (fsm.is(state)) this.set(value);
		}
		return this;
	}

	// Modifiers
	// ---------
	// Each of these creates a new constraint whose value is computed from this one (and any
	// arguments, which can be constraints or plain values).

	/**
	 * `false` if this or any of `args` is falsy; otherwise the last value. Evaluation stops at the
	 * first falsy value (so, for example, `cjs(false).and(a)` never reads `a`).
	 *
	 * @example
	 *     var x = c1.and(c2, c3, true);
	 */
	and(...args: unknown[]): Constraint {
		const values = [this, ...args];
		return new Constraint(() => {
			let value: unknown;
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
	or(...args: unknown[]): Constraint {
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
	iif(trueValue: unknown, otherValue: unknown): Constraint {
		return new Constraint(() => (this.get() ? get(trueValue) : get(otherValue)));
	}

	/**
	 * A property of this constraint's value, like `this[names[0]][names[1]]...`.
	 *
	 * @example
	 *     w = x.prop("y", "z"); // w <- x.y.z
	 */
	prop(...names: unknown[]): Constraint {
		return derive([this, ...names], (object, ...keys: PropertyKey[]) =>
			keys.reduce((value, key) => (value == null ? undefined : value[key]), object),
		);
	}

	/**
	 * `parseInt(this, radix)`
	 *
	 * @example Given an `<input />` element `inp_elem`
	 *     var inp_val = cjs(inp_elem).toInt();
	 */
	toInt(radix?: unknown): Constraint<number> {
		return derive([this, radix], parseInt);
	}

	/**
	 * `parseFloat(this)`
	 *
	 * @example Given an `<input />` element `inp_elem`
	 *     var inp_val = cjs(inp_elem).toFloat();
	 */
	toFloat(): Constraint<number> {
		return derive([this], parseFloat);
	}

	/**
	 * `this + args[0] + args[1] + ...`. Also concatenates strings, which is handy for units.
	 *
	 * @example
	 *     x = y.add(1, 2, z); // x <- y + 1 + 2 + z
	 *     x = y.add("px");    // x <- y + "px"
	 */
	add(...args: unknown[]): Constraint {
		return derive([this, ...args], (first, ...rest) => rest.reduce(binaryOperators["+"]!, first));
	}

	/**
	 * `this - args[0] - args[1] - ...`
	 *
	 * @example
	 *     x = y.sub(1, 2, z); // x <- y - 1 - 2 - z
	 */
	sub(...args: unknown[]): Constraint<number> {
		return derive([this, ...args], (first, ...rest) => rest.reduce(binaryOperators["-"]!, first));
	}

	/**
	 * `this * args[0] * args[1] * ...`
	 *
	 * @example
	 *     x = y.mul(1, 2, z); // x <- y * 1 * 2 * z
	 */
	mul(...args: unknown[]): Constraint<number> {
		return derive([this, ...args], (first, ...rest) => rest.reduce(binaryOperators["*"]!, first));
	}

	/**
	 * `this / args[0] / args[1] / ...`
	 *
	 * @example
	 *     x = y.div(1, 2, z); // x <- y / 1 / 2 / z
	 */
	div(...args: unknown[]): Constraint<number> {
		return derive([this, ...args], (first, ...rest) => rest.reduce(binaryOperators["/"]!, first));
	}

	/** `Math.abs(this)` */
	abs(): Constraint<number> {
		return derive([this], Math.abs);
	}

	/**
	 * `Math.acos(this)`
	 *
	 * @example
	 *     angle = r.div(x).acos();
	 */
	acos(): Constraint<number> {
		return derive([this], Math.acos);
	}

	/**
	 * `Math.asin(this)`
	 *
	 * @example
	 *     angle = r.div(y).asin();
	 */
	asin(): Constraint<number> {
		return derive([this], Math.asin);
	}

	/**
	 * `Math.atan(this)`
	 *
	 * @example
	 *     angle = y.div(x).atan();
	 */
	atan(): Constraint<number> {
		return derive([this], Math.atan);
	}

	/**
	 * `Math.atan2(this, x)`
	 *
	 * @example
	 *     angle = y.atan2(x);
	 */
	atan2(x: unknown): Constraint<number> {
		return derive([this, x], Math.atan2);
	}

	/**
	 * `Math.cos(this)`
	 *
	 * @example
	 *     dx = r.mul(angle.cos());
	 */
	cos(): Constraint<number> {
		return derive([this], Math.cos);
	}

	/**
	 * `Math.sin(this)`
	 *
	 * @example
	 *     dy = r.mul(angle.sin());
	 */
	sin(): Constraint<number> {
		return derive([this], Math.sin);
	}

	/** `Math.tan(this)` */
	tan(): Constraint<number> {
		return derive([this], Math.tan);
	}

	/**
	 * The largest of this and `args`: `Math.max(this, ...args)`
	 *
	 * @example
	 *     val = val1.max(val2, val3);
	 */
	max(...args: unknown[]): Constraint<number> {
		return derive([this, ...args], Math.max);
	}

	/**
	 * The smallest of this and `args`: `Math.min(this, ...args)`
	 *
	 * @example
	 *     val = val1.min(val2, val3);
	 */
	min(...args: unknown[]): Constraint<number> {
		return derive([this, ...args], Math.min);
	}

	/**
	 * `Math.pow(this, exponent)`
	 *
	 * @example
	 *     d = dx.pow(2).add(dy.pow(2)).sqrt();
	 */
	pow(exponent: unknown): Constraint<number> {
		return derive([this, exponent], Math.pow);
	}

	/** `Math.round(this)` */
	round(): Constraint<number> {
		return derive([this], Math.round);
	}

	/** `Math.floor(this)` */
	floor(): Constraint<number> {
		return derive([this], Math.floor);
	}

	/** `Math.ceil(this)` */
	ceil(): Constraint<number> {
		return derive([this], Math.ceil);
	}

	/** `Math.sqrt(this)` */
	sqrt(): Constraint<number> {
		return derive([this], Math.sqrt);
	}

	/**
	 * The natural logarithm, `Math.log(this)`
	 *
	 * @example
	 *     num_digits = num.max(2).log().div(Math.log(10)).ceil();
	 */
	log(): Constraint<number> {
		return derive([this], Math.log);
	}

	/** e to the power of this, `Math.exp(this)` */
	exp(): Constraint<number> {
		return derive([this], Math.exp);
	}

	/**
	 * Converts to a number: `+this`
	 *
	 * @example
	 *     numeric_val = val.pos();
	 */
	pos(): Constraint<number> {
		return derive([this], unaryOperators["+"]!);
	}

	/**
	 * `-this`
	 *
	 * @example
	 *     neg_val = x.neg();
	 */
	neg(): Constraint<number> {
		return derive([this], unaryOperators["-"]!);
	}

	/**
	 * `!this`
	 *
	 * @example
	 *     opposite = x.not();
	 */
	not(): Constraint<boolean> {
		return derive([this], unaryOperators["!"]!);
	}

	/**
	 * `~this`
	 *
	 * @example
	 *     inverseBits = val.bitwiseNot();
	 */
	bitwiseNot(): Constraint<number> {
		return derive([this], unaryOperators["~"]!);
	}

	/**
	 * `this == other`
	 *
	 * @example
	 *     isNull = val.eq(null);
	 */
	eq(other: unknown): Constraint<boolean> {
		return derive([this, other], binaryOperators["=="]!);
	}

	/**
	 * `this != other`
	 *
	 * @example
	 *     notNull = val.neq(null);
	 */
	neq(other: unknown): Constraint<boolean> {
		return derive([this, other], binaryOperators["!="]!);
	}

	/**
	 * `this === other`
	 *
	 * @example
	 *     isOne = val.eqStrict(1);
	 */
	eqStrict(other: unknown): Constraint<boolean> {
		return derive([this, other], binaryOperators["==="]!);
	}

	/**
	 * `this !== other`
	 *
	 * @example
	 *     notOne = val.neqStrict(1);
	 */
	neqStrict(other: unknown): Constraint<boolean> {
		return derive([this, other], binaryOperators["!=="]!);
	}

	/**
	 * `this > other`
	 *
	 * @example
	 *     isPositive = val.gt(0);
	 */
	gt(other: unknown): Constraint<boolean> {
		return derive([this, other], binaryOperators[">"]!);
	}

	/**
	 * `this < other`
	 *
	 * @example
	 *     isNegative = val.lt(0);
	 */
	lt(other: unknown): Constraint<boolean> {
		return derive([this, other], binaryOperators["<"]!);
	}

	/**
	 * `this >= other`
	 *
	 * @example
	 *     isBig = val.ge(100);
	 */
	ge(other: unknown): Constraint<boolean> {
		return derive([this, other], binaryOperators[">="]!);
	}

	/**
	 * `this <= other`
	 *
	 * @example
	 *     isSmall = val.le(100);
	 */
	le(other: unknown): Constraint<boolean> {
		return derive([this, other], binaryOperators["<="]!);
	}

	/** `this ^ other` */
	xor(other: unknown): Constraint<number> {
		return derive([this, other], binaryOperators["^"]!);
	}

	/** `this & other` */
	bitwiseAnd(other: unknown): Constraint<number> {
		return derive([this, other], binaryOperators["&"]!);
	}

	/** `this | other` */
	bitwiseOr(other: unknown): Constraint<number> {
		return derive([this, other], binaryOperators["|"]!);
	}

	/**
	 * `this % other`
	 *
	 * @example
	 *     isEven = x.mod(2).eq(0);
	 */
	mod(other: unknown): Constraint<number> {
		return derive([this, other], binaryOperators["%"]!);
	}

	/** `this >> other` */
	rightShift(other: unknown): Constraint<number> {
		return derive([this, other], binaryOperators[">>"]!);
	}

	/** `this << other` */
	leftShift(other: unknown): Constraint<number> {
		return derive([this, other], binaryOperators["<<"]!);
	}

	/** `this >>> other` */
	unsignedRightShift(other: unknown): Constraint<number> {
		return derive([this, other], binaryOperators[">>>"]!);
	}

	/**
	 * `typeof this`
	 *
	 * @example
	 *     var valIsNumber = val.typeOf().eq('number');
	 */
	typeOf(): Constraint<string> {
		return derive([this], (value) => typeof value);
	}

	/**
	 * `this instanceof other`
	 *
	 * @example
	 *     var valIsArray = val.instanceOf(Array);
	 */
	instanceOf(other: unknown): Constraint<boolean> {
		return derive([this, other], (value, type) => value instanceof type);
	}

	/** @internal Queues my change listeners to run. */
	_enqueueListeners(): void {
		this._listeners?.forEach(enqueue);
	}

	/**
	 * @internal Adds the constraints that still depend on me to `dependents`, dropping dependencies
	 * that are no longer used.
	 */
	_collectDependents(dependents: Constraint[]): void {
		const edges = this._outEdges;
		if (!edges) return;
		for (const edge of edges.values()) {
			if (edge.timestamp < edge.to._timestamp) {
				// The dependent has recomputed its value since it last read mine: it doesn't use me anymore
				edges.delete(edge.to._id);
				edge.to._inEdges?.delete(this._id);
			} else {
				dependents.push(edge.to);
			}
		}
	}

	/**
	 * @internal With `check_on_nullify`, recompute right away. Returns `true` if the value didn't
	 * change (so I'm valid again, and nothing that depends on me needs to know).
	 */
	_unchangedAfterRecheck(): boolean {
		const { cache_value, check_on_nullify, equals = defaultEquals } = this._options;
		if (cache_value === false || check_on_nullify !== true || rechecked.has(this)) return false;
		rechecked.add(this);
		const oldValue = this._cachedValue as T;
		try {
			return equals(oldValue, this.get(undefined, true));
		} catch {
			// My value is now an error (which `get()` will throw): that's a change, and everything that
			// depends on me is about to hear about it
			this._silentlyInvalid = false;
			return false;
		}
	}

	// If a constraint is computing its value right now, record that it depends on me
	private _recordDependency(allowNewDependency: boolean): void {
		// (Check the length first: reading `evaluationStack[-1]` is a slow property lookup)
		if (evaluationStack.length === 0) return;
		const dependent = evaluationStack[evaluationStack.length - 1]!;
		if (dependent === this) return;
		const edge = this._outEdges?.get(dependent._id);
		if (edge) {
			edge.timestamp = dependent._timestamp; // still in use
		} else if (
			allowNewDependency &&
			this._options.auto_add_outgoing_dependencies !== false &&
			dependent._options.auto_add_incoming_dependencies !== false
		) {
			const newEdge: Edge = { from: this, to: dependent, timestamp: dependent._timestamp };
			(this._outEdges ??= new Map()).set(dependent._id, newEdge);
			(dependent._inEdges ??= new Map()).set(this._id, newEdge);
		}
	}

	// The value passed to resumeGetter() is treated like a value passed to set()
	private _resolve(value: unknown): T {
		if (this._options.literal) return value as T;
		if (typeof value === "function") return value.call(this._options.context ?? this, this);
		return get(value) as T;
	}
}

/**
 * Whether `value` is a constraint.
 */
export function isConstraint(value: unknown): value is Constraint {
	return value instanceof Constraint;
}

/**
 * Removes the dependency of `to` on `from` (until `to` reads `from` again).
 */
export function removeDependency(from: Constraint, to: Constraint): void {
	from._outEdges?.delete(to._id);
	to._inEdges?.delete(from._id);
}

/**
 * Runs `fn` without recording anything it reads as a dependency of the constraint that is
 * computing its value right now.
 */
export function untracked<R>(fn: () => R): R {
	const outerStack = evaluationStack.splice(0);
	try {
		return fn();
	} finally {
		evaluationStack.push(...outerStack);
	}
}

// Invalidates the constraints in `queue` and everything that depends on them. Change listeners
// run once it's done. (`queue` is used as the work queue, so pass an array nothing else uses.)
function invalidateAll(queue: Constraint[]): void {
	// Listeners can invalidate constraints too; only the outermost invalidation runs the listeners
	const isOutermost = !invalidating;
	invalidating = true;
	try {
		// Walk the dependency graph breadth-first (rather than recursively, which makes for deep stacks)
		for (let i = 0; i < queue.length; i++) {
			const constraint = queue[i]!;
			// An invalid constraint's dependents are invalid too, and its listeners have been queued
			// (unless it became invalid silently)
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

// A value is "plain" (rather than computed) if it's literal or not a function or constraint
function isPlainValue(value: unknown, options: ConstraintOptions): boolean {
	return options.literal === true || (typeof value !== "function" && !(value instanceof Constraint));
}

// A new constraint whose value is `compute` applied to the current values of `inputs`
function derive(inputs: readonly unknown[], compute: (...values: any[]) => unknown): Constraint<any> {
	return new Constraint(() => compute(...inputs.map((input) => get(input))));
}
