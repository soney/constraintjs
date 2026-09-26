// DOM helpers
// -----------

import { ArrayConstraint } from "./array-constraint";
import { Constraint } from "./constraint";
import { MapConstraint } from "./map-constraint";

/** Something that holds DOM nodes: a node, an array, a NodeList, a jQuery object, or a constraint of these. */
export type DOMTargets = unknown;

/** Attributes that are either present or absent (like `disabled`), rather than having a meaningful value. */
export const booleanAttributes: ReadonlySet<string> = new Set([
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
	"selected",
]);

/** Whether `value` is a jQuery object (if jQuery is loaded). */
export function isJQuery(value: unknown): value is ArrayLike<Node> {
	const jQuery = (globalThis as { jQuery?: new () => unknown }).jQuery;
	return typeof jQuery === "function" && value instanceof jQuery;
}

/** Whether `value` is a NodeList (like the result of `querySelectorAll`). */
export function isNodeList(value: unknown): value is NodeList {
	return typeof NodeList !== "undefined" && value instanceof NodeList;
}

/** Whether `value` is a DOM node of any kind. */
export function isDOMNode(value: unknown): value is Node {
	return typeof (value as Node | null)?.nodeType === "number" && (value as Node).nodeType > 0;
}

/** Whether `value` is a DOM element. */
export function isElement(value: unknown): value is Element {
	return isDOMNode(value) && value.nodeType === 1;
}

/** Whether `value` is a DOM node, a NodeList, or a jQuery object. */
export function isPolyDOM(value: unknown): boolean {
	return isJQuery(value) || isNodeList(value) || isDOMNode(value);
}

/** The first DOM node in a node, NodeList, or jQuery object. */
export function firstDOMNode(value: unknown): Node | undefined {
	if (isJQuery(value) || isNodeList(value)) return value[0];
	return isDOMNode(value) ? value : undefined;
}

/** Every DOM node in a node, NodeList, or jQuery object (anything else is returned as is). */
export function domNodesOf(value: unknown): unknown[] {
	return isJQuery(value) || isNodeList(value) ? Array.from(value) : [value];
}

/**
 * Converts anything that can hold DOM nodes (see {@link DOMTargets}) to an array. Reading a
 * constraint here makes the caller depend on it.
 */
export function toDOMArray(targets: DOMTargets): unknown[] {
	if (Array.isArray(targets)) return targets;
	if (targets instanceof Constraint) return toDOMArray(targets.get());
	if (targets instanceof ArrayConstraint) return targets.toArray();
	if (targets instanceof MapConstraint) return targets.values();
	if (isJQuery(targets) || isNodeList(targets)) return Array.from(targets);
	return [targets];
}
