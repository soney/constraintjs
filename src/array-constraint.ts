// Array Constraints
// -----------------

import { Constraint } from "./constraint";
import { get } from "./get";
import { batch } from "./scheduler";
import { BREAK, defaultEquals, type EqualityCheck, isPositiveInteger } from "./util";

/** Options for {@link ArrayConstraint}. */
export interface ArrayConstraintOptions<T = any> {
	/** How to compare items (used by `indexOf` and friends). *Default:* `===` */
	equals?: EqualityCheck<T>;
	/** The initial items. *Default:* `[]` */
	value?: readonly T[];
}

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
export class ArrayConstraint<T = any> {
	/** Return this from a `forEach` callback to stop iterating. */
	static readonly BREAK = BREAK;

	/** One constraint per item. The same constraint stays at an index as items shift around. */
	private _items: Array<Constraint<T> | undefined>;
	/**
	 * Placeholder constraints for indices that were read before they had an item, so that whatever
	 * read them is notified when an item is put there.
	 */
	private _placeholders = new Map<number, Constraint<T | undefined>>();
	private _length: Constraint<number>;
	// (Typed loosely so that ArrayConstraint is covariant in T)
	private _equalityCheck: Constraint<EqualityCheck<any>>;

	constructor(options?: ArrayConstraintOptions<T>) {
		const { equals = defaultEquals, value = [] } = options ?? {};
		this._items = value.map((item) => new Constraint<T>(item, { literal: true }));
		this._length = new Constraint(this._items.length);
		this._equalityCheck = new Constraint<EqualityCheck<T>>(equals, { literal: true });
	}

	/**
	 * Change how items are compared (for `indexOf` and friends).
	 */
	setEqualityCheck(equalityCheck: EqualityCheck<T>): this {
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
	forEach(callback: (this: any, value: T, index: number) => unknown, thisArg: unknown = globalThis): this {
		const length = this.length();
		for (let i = 0; i < length; i++) {
			if (callback.call(thisArg, this._read(i) as T, i) === BREAK) break;
		}
		return this;
	}

	/**
	 * A new (plain) array with the results of calling `callback` on every item.
	 *
	 * @example
	 *     var arr = cjs([1,2,3]);
	 *     arr.map(function(x) { return x+1; }); // [2,3,4]
	 */
	map<R>(callback: (this: any, value: T, index: number) => R, thisArg: unknown = globalThis): R[] {
		const results: R[] = [];
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
	setValue(values: readonly T[]): this {
		batch(() => {
			for (let i = 0; i < values.length; i++) this._write(i, values[i] as T);
			this._truncate(values.length);
		});
		return this;
	}

	/**
	 * With no arguments: a plain array of the items (see `toArray`). With `index`: the item at
	 * `index`. With `index` and `value`: sets the item at `index` and returns `value`.
	 *
	 * @example
	 *     var arr = cjs(['a','b']);
	 *     arr.item();        // ['a','b']
	 *     arr.item(0);       // 'a'
	 *     arr.item(0, 'x');
	 *     arr.toArray();     // ['x','b']
	 */
	item(): T[];
	item(index: number): T | undefined;
	item(index: number, value: T): T;
	item(...args: [] | [number] | [number, T]): T[] | T | undefined {
		if (args.length === 0) return this.toArray();
		// (Like array indices, a numeric string like "1" works too)
		const index = Number(args[0]);
		if (args.length === 1) return this._read(index);
		const value = args[1] as T;
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
	destroy(silent?: boolean): void {
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
	length(): number {
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
	push(...values: T[]): number {
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
	pop(): T | undefined {
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
	toArray(): T[] {
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
	indexWhere(filter: (this: any, value: T, index: number) => unknown, thisArg: unknown = this): number {
		const length = this.length();
		for (let i = 0; i < length; i++) {
			if (filter.call(thisArg, this._read(i) as T, i)) return i;
		}
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
	lastIndexWhere(filter: (this: any, value: T, index: number) => unknown, thisArg: unknown = this): number {
		for (let i = this.length() - 1; i >= 0; i--) {
			if (filter.call(thisArg, this._read(i) as T, i)) return i;
		}
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
	indexOf(item: T, equalityCheck?: EqualityCheck<T>): number {
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
	lastIndexOf(item: T, equalityCheck?: EqualityCheck<T>): number {
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
	some(filter: (this: any, value: T, index: number) => unknown, thisArg?: unknown): boolean {
		return this.indexWhere(filter, thisArg) >= 0;
	}

	/**
	 * Whether `filter` returns a truthy value for every item.
	 *
	 * @example
	 *     var arr = cjs([2,4,6]);
	 *     arr.every(function(x) { return x%2===0; }); // true
	 */
	every(filter: (this: any, value: T, index: number) => unknown, thisArg?: unknown): boolean {
		let result = true;
		this.forEach((value, i) => {
			if (!filter.call(thisArg, value, i)) {
				result = false;
				return BREAK;
			}
			return undefined;
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
	splice(index: number, howMany?: number, ...items: T[]): T[] {
		const deleteCount = typeof howMany === "number" ? howMany : 0;
		if (!isPositiveInteger(index) || !isPositiveInteger(deleteCount)) {
			throw new Error("index and howmany must be positive integers");
		}
		return batch(() => {
			const oldLength = this._items.length;
			const start = Math.min(index, oldLength);
			const end = Math.min(start + deleteCount, oldLength);
			const removed = this._range(start, end);
			// Items keep their constraint by index, so shift the values over rather than splicing the
			// constraints: a constraint that reads item i is only updated if the value at i changes
			const tail = [...items, ...this._range(end, oldLength)];
			for (let i = 0; i < tail.length; i++) this._write(start + i, tail[i] as T);
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
	shift(): T | undefined {
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
	unshift(...items: T[]): number {
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
	concat(...values: unknown[]): unknown[] {
		const plainValues = values.map((value) => (value instanceof ArrayConstraint ? value.toArray() : value));
		return this.toArray().concat(...(plainValues as T[]));
	}

	/**
	 * A (plain) array of the items from `begin` up to (but not including) `end`. Like
	 * `Array.prototype.slice`, negative indices count back from the end.
	 *
	 * @example
	 *     var arr = cjs(['a','b','c']);
	 *     arr.slice(1); // ['b','c']
	 */
	slice(begin?: number, end?: number): T[] {
		const length = this.length();
		const indices = Array.from({ length }, (_, i) => i).slice(begin, end);
		return indices.map((i) => this._read(i) as T);
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
	itemConstraint(index: number | Constraint<number>): Constraint<T | undefined> {
		return new Constraint(() => this.item(get(index) as number));
	}

	/** A (plain) array of the items that pass `filter`. */
	filter(filter: (value: T, index: number, array: T[]) => unknown, thisArg?: unknown): T[] {
		return this.toArray().filter(filter, thisArg);
	}

	/** The items joined into a string, separated by `separator` (default: `","`). */
	join(separator?: string): string {
		return this.toArray().join(separator);
	}

	/** A sorted (plain) copy of the items. This array constraint is not modified. */
	sort(compareFunction?: (a: T, b: T) => number): T[] {
		return this.toArray().sort(compareFunction);
	}

	/** A reversed (plain) copy of the items. This array constraint is not modified. */
	reverse(): T[] {
		return this.toArray().reverse();
	}

	/** The items as a string, like `Array.prototype.toString`. */
	toString(): string {
		return this.toArray().toString();
	}

	// Reads the item at `index`. If there's no item there yet, reads a placeholder instead, so that
	// the reader is notified when an item is put there.
	private _read(index: number): T | undefined {
		const item = this._items[index];
		if (item) return item.get();
		let placeholder = this._placeholders.get(index);
		if (!placeholder) {
			placeholder = new Constraint<T | undefined>(undefined, { literal: true });
			this._placeholders.set(index, placeholder);
		}
		return placeholder.get();
	}

	// Reads the item at `index` without making anything depend on it
	private _peek(index: number): T | undefined {
		return this._items[index]?.get(false);
	}

	private _range(start: number, end: number): T[] {
		const values: T[] = [];
		for (let i = start; i < end; i++) values.push(this._peek(i) as T);
		return values;
	}

	// Sets the item at `index`. (Callers update the length once they're done writing.)
	private _write(index: number, value: T): void {
		const item = this._items[index];
		if (item) {
			item.set(value);
			return;
		}
		const placeholder = this._placeholders.get(index);
		if (placeholder) {
			// Something already read this index: promote its placeholder, so that the reader is notified
			this._placeholders.delete(index);
			this._items[index] = placeholder as Constraint<T>;
			placeholder.set(value);
		} else {
			this._items[index] = new Constraint<T>(value, { literal: true });
		}
	}

	// Removes (and cleans up) every item from `length` on, and updates the length
	private _truncate(length: number): void {
		for (const item of this._items.splice(Math.max(length, 0))) item?.destroy();
		this._updateLength();
	}

	private _updateLength(): void {
		this._length.set(this._items.length);
	}
}

/**
 * Whether `value` is an array constraint.
 */
export function isArrayConstraint(value: unknown): value is ArrayConstraint {
	return value instanceof ArrayConstraint;
}
