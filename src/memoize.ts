// Memoize
// -------

import { Constraint } from "./constraint";
import { MapConstraint } from "./map-constraint";

/** Options for `cjs.memoize`. */
export interface MemoizeOptions {
	/** Hashes an array of arguments (equal argument lists must have equal hashes). *Default:* the arguments joined by commas */
	hash?: (args: unknown[]) => unknown;
	/** Whether two arrays of arguments are equal. *Default:* same length and `===` items */
	equals?: (args1: unknown[], args2: unknown[]) => boolean;
	/** The `this` for the memoized function. *Default:* the global object */
	context?: unknown;
	/** Whether function results are kept as functions (rather than called). *Default:* `true` */
	literal_values?: boolean;
}

/** A function returned by `cjs.memoize`. */
export interface MemoizedFunction<A extends unknown[], R> {
	(...args: A): R;
	/** Clears the memoized values and cleans up. */
	destroy(silent?: boolean): void;
	/** Calls `fn` with the constraint for every memoized result and its arguments. */
	each(fn: (constraint: Constraint<R>, args: A, index: number) => unknown): void;
	readonly options: MemoizeOptions & { readonly args_map: MapConstraint<A, Constraint<R>> };
}

const joinArguments = (args: unknown[]): string => args.join(",");

function sameArguments(args1: unknown[], args2: unknown[]): boolean {
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
export function memoize<A extends unknown[], R>(
	getter: (this: any, ...args: A) => R,
	options?: MemoizeOptions,
): MemoizedFunction<A, R> {
	const { hash = joinArguments, equals = sameArguments, context = globalThis, literal_values = true } = options ?? {};
	// A map from argument lists to constraints for their results
	const argsMap = new MapConstraint<A, Constraint<R>>({
		hash: hash as (args: A) => unknown,
		equals: equals as (args1: A, args2: A) => boolean,
		literal_values,
	});

	const memoized = (...args: A): R =>
		argsMap.getOrPut(args, () => new Constraint(() => getter.apply(context, args))).get();

	return Object.assign(memoized, {
		destroy(silent?: boolean): void {
			argsMap.forEach((constraint) => constraint.destroy(silent));
			argsMap.destroy(silent);
		},
		each(fn: (constraint: Constraint<R>, args: A, index: number) => unknown): void {
			argsMap.forEach(fn);
		},
		options: { hash, equals, context, literal_values, args_map: argsMap },
	});
}
