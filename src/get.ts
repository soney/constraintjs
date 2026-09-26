import { ArrayConstraint } from "./array-constraint";
import { Constraint } from "./constraint";
import { MapConstraint } from "./map-constraint";

/**
 * Gets the value of anything: the value of a constraint, a plain array for an array constraint,
 * a plain object for a map constraint, or the object itself for anything else.
 *
 * @param autoAddOutgoing - For constraints, whether a constraint that is computing its value right
 *     now should start depending on this one (default: `true`)
 *
 * @example
 *     var w = 1,
 *         x = cjs(2),
 *         y = cjs(['a','b']),
 *         z = cjs({c: 2});
 *
 *     cjs.get(w); // 1
 *     cjs.get(x); // 2
 *     cjs.get(y); // ['a','b']
 *     cjs.get(z); // {c: 2}
 */
export function get<T>(value: Constraint<T>, autoAddOutgoing?: boolean): T;
export function get<T>(value: ArrayConstraint<T>): T[];
export function get<V>(value: MapConstraint<any, V>): Record<string, V>;
export function get<T>(value: T): T;
export function get(value: unknown, autoAddOutgoing?: boolean): unknown {
	if (value instanceof Constraint) return value.get(autoAddOutgoing);
	if (value instanceof ArrayConstraint) return value.toArray();
	if (value instanceof MapConstraint) return value.toObject();
	return value;
}
