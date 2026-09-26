// Templates
// ---------
// Renders parsed templates into DOM nodes that stay up to date. Each piece of a template becomes
// an "instance" that knows which DOM nodes it produces right now; every element keeps its
// children in sync with its instances' nodes through a `bindChildren` binding.

import { ArrayConstraint } from "../array-constraint";
import { matchIndices } from "../array-diff";
import { type Binding, bindAttr, bindChildren, bindClass, bindText, inputValue } from "../binding";
import { Constraint, untracked } from "../constraint";
import { domNodesOf, firstDOMNode, isDOMNode, isElement, isJQuery, isNodeList, isPolyDOM } from "../dom";
import type { FSM } from "../fsm";
import { get } from "../get";
import { MapConstraint } from "../map-constraint";
import { evaluate, type Scope } from "./evaluate";
import { type Expression, parseExpression } from "./expression";
import { type Attribute, parseTemplate, type TemplateNode } from "./parser";

/** A rendered piece of a template. */
interface Instance {
	/**
	 * The DOM nodes this renders right now. It's called while the parent element computes its
	 * children, so the constraints it reads update the parent's children when they change.
	 */
	nodes(): Node[];
	/** Called when this instance's nodes are shown (like when an `{{#if}}` branch becomes active). */
	onAdd(): void;
	/** Called when this instance's nodes are hidden. */
	onRemove(): void;
	pause(): void;
	resume(): void;
	destroy(): void;
}

type Lifecycle = "onAdd" | "onRemove" | "pause" | "resume" | "destroy";

const inert: Omit<Instance, "nodes"> = {
	onAdd() {},
	onRemove() {},
	pause() {},
	resume() {},
	destroy() {},
};

/** A function that renders a template with a context (into `parent`, if given). See `cjs.createTemplate`. */
export type TemplateFunction = (context?: unknown, parent?: unknown) => Node;

/** Options for `cjs.registerCustomPartial`. Only `createNode` is required. */
export interface CustomPartialOptions {
	/** Returns a new DOM node every time the partial is used (called with the partial's arguments). */
	createNode(this: CustomPartialOptions, ...args: any[]): unknown;
	/** Called when the node is added to the DOM tree (with the node and the partial's arguments). */
	onAdd?(this: CustomPartialOptions, node: Node, ...args: any[]): void;
	/** Called when the node is removed from the DOM tree. */
	onRemove?(this: CustomPartialOptions, node: Node): void;
	/** Called when the template is paused (usually with `cjs.pauseTemplate`). */
	pause?(this: CustomPartialOptions, node: Node): void;
	/** Called when the template is resumed (usually with `cjs.resumeTemplate`). */
	resume?(this: CustomPartialOptions, node: Node): void;
	/** Called when the template is destroyed (usually with `cjs.destroyTemplate`). */
	destroyNode?(this: CustomPartialOptions, node: Node): void;
}

const partials = new Map<string, TemplateFunction>();
const customPartials = new Map<string, CustomPartialOptions>();
/** The instance behind each node returned by a template function */
const renderedTemplates = new WeakMap<Node, Instance>();

const outAttributePattern = /^(data-)?cjs-out$/;
const eventAttributePattern = /^(data-)?cjs-on-(\w+)$/;

function callAll(instances: readonly Instance[], method: Lifecycle): void {
	// Lifecycle hooks shouldn't make the constraint that's computing the parent's children depend on anything
	untracked(() => {
		for (const instance of instances) instance[method]();
	});
}

function createInstances(nodes: readonly TemplateNode[], context: unknown, scopes: readonly Scope[]): Instance[] {
	return untracked(() => nodes.map((node) => createInstance(node, context, scopes)));
}

function nodesOf(instances: readonly Instance[]): Node[] {
	return instances.flatMap((instance) => instance.nodes());
}

function createInstance(node: TemplateNode, context: unknown, scopes: readonly Scope[]): Instance {
	switch (node.type) {
		case "text": {
			const text = document.createTextNode(node.text);
			return { ...inert, nodes: () => [text] };
		}
		case "comment": {
			const comment = document.createComment(node.text);
			return { ...inert, nodes: () => [comment] };
		}
		case "element":
			return elementInstance(document.createElement(node.tag), node.children, node.attributes, context, scopes);
		case "expression":
			return node.literal
				? htmlInstance(node.expression, context, scopes)
				: expressionInstance(node.expression, context, scopes);
		case "partial":
			return partialInstance(node.name, node.args, context, scopes);
		case "if":
			return ifInstance(node, context, scopes);
		case "each":
			return eachInstance(node, context, scopes);
		case "fsm":
			return fsmInstance(node, context, scopes);
		case "with":
			return withInstance(node, context, scopes);
	}
}

// An element: its attributes are bound to their values, and its children to its child instances
function elementInstance(
	element: Element,
	children: readonly TemplateNode[],
	attributes: readonly Attribute[],
	context: unknown,
	scopes: readonly Scope[],
): Instance {
	const childInstances = createInstances(children, context, scopes);
	const bindings: Binding[] = [];
	const constraints: Constraint[] = [];
	const cleanups: Array<() => void> = [];

	for (const { name, value } of attributes) {
		const eventMatch = eventAttributePattern.exec(name);
		if (outAttributePattern.test(name)) {
			// `data-cjs-out=name` puts a constraint for this input's value into the context
			const input = inputValue(element);
			constraints.push(input);
			if (context instanceof MapConstraint) context.put(value, input, undefined, true);
			else (context as Record<string, unknown>)[value] = input;
		} else if (eventMatch) {
			// `data-cjs-on-click=handler` calls the context's `handler` on clicks
			const eventType = eventMatch[2]!;
			const handlerName = value.trim();
			const listener = (event: Event): unknown =>
				untracked(() => {
					const handler = evaluate({ type: "Identifier", name: handlerName }, context, scopes);
					if (typeof handler !== "function") {
						throw new TypeError(`${name}: '${value}' is not a function in the template's context`);
					}
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
		},
	};
}

// An attribute value like "a {{b}} c". Returns the text if there are no expressions; the
// expression's constraint if that's all there is (so that `disabled={{flag}}` gets a boolean);
// otherwise a constraint for the concatenation.
function interpolate(
	text: string,
	context: unknown,
	scopes: readonly Scope[],
	constraints: Constraint[],
): string | Constraint {
	const parts = text.split(/\{\{([^}]+)\}\}/); // expressions are at the odd indices
	if (parts.length === 1) return text;
	const pieces = parts
		.map((part, i) => (i % 2 === 1 ? expressionConstraint(parseExpression(part), context, scopes) : part))
		.filter((piece) => piece !== "");
	for (const piece of pieces) {
		if (piece instanceof Constraint) constraints.push(piece);
	}
	if (pieces.length === 1 && pieces[0] instanceof Constraint) return pieces[0];
	const joined = new Constraint(() =>
		pieces.map((piece) => (piece instanceof Constraint ? piece.get() : piece)).join(""),
	);
	constraints.push(joined);
	return joined;
}

function expressionConstraint(expression: Expression, context: unknown, scopes: readonly Scope[]): Constraint {
	return new Constraint(() => evaluate(expression, context, scopes));
}

// `{{expression}}`: text that follows the expression's value (or, if the value is initially a
// DOM node, that node)
function expressionInstance(expression: Expression, context: unknown, scopes: readonly Scope[]): Instance {
	const value = expressionConstraint(expression, context, scopes);
	const initialValue = value.get();
	if (isPolyDOM(initialValue)) {
		const node = firstDOMNode(initialValue)!;
		return { ...inert, nodes: () => [node], destroy: () => value.destroy(true) };
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
		},
	};
}

// `{{{expression}}}`: the expression's value as HTML (or DOM nodes)
function htmlInstance(expression: Expression, context: unknown, scopes: readonly Scope[]): Instance {
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
		},
	};
}

// `{{> name args...}}`: a registered template or custom partial
function partialInstance(
	name: string,
	argExpressions: readonly Expression[],
	context: unknown,
	scopes: readonly Scope[],
): Instance {
	const args = (): unknown[] => argExpressions.map((arg) => evaluate(arg, context, scopes));

	const partial = partials.get(name);
	if (partial) {
		const node = partial.call(globalThis, ...(args() as Parameters<TemplateFunction>));
		const instance = renderedTemplates.get(node);
		return {
			nodes: () => [node],
			onAdd: () => instance?.onAdd(),
			onRemove: () => instance?.onRemove(),
			pause: () => instance?.pause(),
			resume: () => instance?.resume(),
			destroy: () => destroyTemplate(node),
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
			destroy: () => custom.destroyNode?.call(custom, node),
		};
	}

	throw new Error(`Could not find partial with name '${name}'`);
}

// `{{#if}}`/`{{#unless}}` (with any `{{#elif}}`s and an `{{#else}}`): renders the first branch
// whose condition holds. Each branch is created the first time it's shown and reused after that.
function ifInstance(node: Extract<TemplateNode, { type: "if" }>, context: unknown, scopes: readonly Scope[]): Instance {
	const branchInstances: Array<Instance[] | undefined> = [];
	let active: Instance[] = [];
	let activeIndex = -1;

	const holds = ({ condition, negate }: (typeof node.branches)[number]): boolean => {
		if (!condition) return true; // {{#else}}
		const value = Boolean(get(evaluate(condition, context, scopes)));
		return negate ? !value : value;
	};

	return {
		nodes() {
			const index = node.branches.findIndex(holds);
			if (index !== activeIndex) {
				callAll(active, "onRemove");
				active =
					index < 0
						? []
						: (branchInstances[index] ??= createInstances(node.branches[index]!.children, context, scopes));
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
			for (const instances of branchInstances) {
				if (instances) callAll(instances, "destroy");
			}
			branchInstances.length = 0;
			active = [];
			activeIndex = -1;
		},
	};
}

// An item of an `{{#each}}` collection: an array item, or an object or map entry
interface EachItem {
	readonly value: unknown;
	readonly key?: unknown;
	readonly isEntry: boolean;
}

// Stands in for the `{{#else}}` block of an `{{#each}}` over an empty collection
const ELSE_ITEM: EachItem = { value: Symbol("else"), isEntry: false };

const sameItem = (a: EachItem, b: EachItem): boolean =>
	a.value === b.value && a.key === b.key && a.isEntry === b.isEntry;

function eachItems(collection: unknown): EachItem[] {
	if (collection instanceof ArrayConstraint) return collection.toArray().map((value) => ({ value, isEntry: false }));
	if (Array.isArray(collection)) return Array.from(collection, (value) => ({ value, isEntry: false }));
	if (collection instanceof MapConstraint) {
		return collection.entries().map(({ key, value }) => ({ key, value, isEntry: true }));
	}
	if (collection instanceof Constraint) return eachItems(collection.get());
	if (collection !== null && typeof collection === "object") {
		return Object.entries(collection).map(([key, value]) => ({ key, value, isEntry: true }));
	}
	return [];
}

interface Row {
	readonly item: EachItem;
	readonly instances: Instance[];
	readonly index?: Constraint<number>;
}

// `{{#each collection}}`: renders its content once per item of an array, array constraint,
// object, or map constraint. `this` is the item, and `@index` (and, for objects and maps, `@key`)
// are available. Rows are reused as items move around.
function eachInstance(
	node: Extract<TemplateNode, { type: "each" }>,
	context: unknown,
	scopes: readonly Scope[],
): Instance {
	let rows: Row[] = [];

	const createRow = (item: EachItem, index: number): Row => {
		if (item === ELSE_ITEM) return { item, instances: createInstances(node.elseChildren!, context, scopes) };
		const indexConstraint = new Constraint(index);
		const specials = item.isEntry ? { key: item.key, index: indexConstraint } : { index: indexConstraint };
		const rowScopes = [...scopes, { self: item.value, specials }];
		return { item, index: indexConstraint, instances: createInstances(node.children, context, rowScopes) };
	};

	const allInstances = (): Instance[] => rows.flatMap((row) => row.instances);

	return {
		nodes() {
			const items = eachItems(evaluate(node.collection, context, scopes));
			const wanted = items.length === 0 && node.elseChildren ? [ELSE_ITEM] : items;
			const oldRows = rows;
			const sources = matchIndices(
				oldRows.map((row) => row.item),
				wanted,
				sameItem,
			);
			const kept = new Set(sources);
			const added: Row[] = [];
			rows = wanted.map((item, index) => {
				const source = sources[index]!;
				if (source < 0) {
					const row = createRow(item, index);
					added.push(row);
					return row;
				}
				const row = oldRows[source]!;
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
		},
	};
}

// `{{#fsm machine}}{{#state name}}...{{/fsm}}`: renders the content for the FSM's current state.
// Each state's content is created the first time it's shown and reused after that.
function fsmInstance(
	node: Extract<TemplateNode, { type: "fsm" }>,
	context: unknown,
	scopes: readonly Scope[],
): Instance {
	const stateInstances = new Map<string, Instance[]>();
	let active: Instance[] = [];
	let activeState: string | null | undefined;

	return {
		nodes() {
			const fsm = evaluate(node.fsm, context, scopes) as FSM | undefined;
			const state = typeof fsm?.getState === "function" ? fsm.getState() : null;
			if (state !== activeState) {
				callAll(active, "onRemove");
				const children = state === null ? undefined : node.states.get(state);
				if (children && !stateInstances.has(state!)) {
					stateInstances.set(state!, createInstances(children, context, scopes));
				}
				active = children ? stateInstances.get(state!)! : [];
				callAll(active, "onAdd");
				activeState = state;
			}
			return nodesOf(active);
		},
		// When the whole block is shown or hidden, its content is resumed or paused
		onAdd: () => callAll(active, "resume"),
		onRemove: () => callAll(active, "pause"),
		pause: () => callAll(active, "pause"),
		resume: () => callAll(active, "resume"),
		destroy() {
			for (const instances of stateInstances.values()) callAll(instances, "destroy");
			stateInstances.clear();
			active = [];
			activeState = undefined;
		},
	};
}

// `{{#with value}}`: renders its content with `value` as the context. If `value` changes, the
// content is rendered again.
function withInstance(
	node: Extract<TemplateNode, { type: "with" }>,
	context: unknown,
	scopes: readonly Scope[],
): Instance {
	const newContext = expressionConstraint(node.context, context, scopes);
	let current: { context: unknown; instances: Instance[] } | undefined;
	const instances = (): Instance[] => current?.instances ?? [];

	return {
		nodes() {
			const value = newContext.get();
			if (!current || current.context !== value) {
				const previous = current;
				current = { context: value, instances: createInstances(node.children, value, [...scopes, { self: value }]) };
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
			current = undefined;
		},
	};
}

function renderTemplate(template: readonly TemplateNode[], context: unknown, parent: unknown): Node {
	const scopes: Scope[] = [{ self: context }];
	const parentElement = firstDOMNode(parent);
	// A template that's a single element becomes that element; anything else is wrapped in a
	// <span> (or rendered into `parent`, if given)
	const onlyChild = template.length === 1 ? template[0] : undefined;
	const instance =
		!parentElement && onlyChild?.type === "element"
			? createInstance(onlyChild, context, scopes)
			: elementInstance(
					(isElement(parentElement) ? parentElement : undefined) ?? document.createElement("span"),
					template,
					[],
					context,
					scopes,
				);
	const [node] = instance.nodes();
	renderedTemplates.set(node!, instance);
	return node!;
}

// The template source from a string, or from the text of an element (like a <script> tag)
function templateSource(template: unknown): string {
	if (typeof template === "string") return template;
	if (isJQuery(template) || isNodeList(template) || isDOMNode(template)) {
		return (firstDOMNode(template)?.textContent ?? "").trim();
	}
	return String(template);
}

/**
 * Creates a template. With a `context`, renders it right away and returns the resulting DOM
 * node. Otherwise, returns a function that can be called with a context (and optionally a parent
 * node to render into) to render it.
 *
 * ConstraintJS templates use a syntax like [Handlebars](http://handlebarsjs.com/). Values in
 * the context can be constraints; the rendered DOM stays up to date as they change.
 *
 * ## Expressions
 *
 * ```html
 * <h1>{{title}}</h1>
 * <p>{{subtext.toUpperCase() + "!"}}</p>
 * ```
 *
 * With `{ title: cjs('hello'), subtext: 'world' }`, renders `<h1>hello</h1><p>WORLD!</p>`.
 *
 * Use triple braces to insert HTML: `<p>{{{html_content}}}</p>`
 *
 * Comments are ignored: `{{! a comment }}`
 *
 * ## Events and inputs
 *
 * `data-cjs-on-(event)=handler` calls the context's `handler` when the event happens:
 *
 * ```html
 * <div data-cjs-on-click=update_obj></div>
 * ```
 *
 * `data-cjs-out=name` sets the context's `name` to a constraint for the input's value:
 *
 * ```html
 * <input data-cjs-out=user_name />
 * <h1>Hello, {{user_name}}</h1>
 * ```
 *
 * ## Block helpers
 *
 * ### Loops
 *
 * `{{#each}}` renders its content for every item of an array or object. `{{this}}` is the
 * current item, `{{@index}}` its index, and for objects, `{{@key}}` its key. The `{{#else}}`
 * part is rendered when there are no items.
 *
 * ```html
 * {{#each arr_name}}
 *     {{@index}}: {{this}}
 * {{#else}}
 *     <strong>No items!</strong>
 * {{/each}}
 * ```
 *
 * ### Conditions
 *
 * ```html
 * {{#if cond1}}
 *     Cond content
 * {{#elif other_cond}}
 *     other_cond content
 * {{#else}}
 *     else content
 * {{/if}}
 * ```
 *
 * The opposite of `{{#if}}` is `{{#unless}}`:
 *
 * ```html
 * {{#unless logged_in}}
 *     Not logged in!
 * {{/unless}}
 * ```
 *
 * ### State
 *
 * `{{#fsm}}` renders the content for an FSM's current state:
 *
 * ```html
 * {{#fsm my_fsm}}
 *     {{#state state1}}
 *         State1 content
 *     {{#state state2}}
 *         State2 content
 * {{/fsm}}
 * ```
 *
 * ### With
 *
 * `{{#with}}` changes the context. `{{../x}}` reads `x` from the enclosing context.
 *
 * ```html
 * {{#with obj}}
 *     Value: {{x}}
 * {{/with}}
 * ```
 *
 * ## Partials
 *
 * Partials nest templates in other templates:
 *
 * ```js
 * var my_temp = cjs.createTemplate(...);
 * cjs.registerPartial('my_template', my_temp);
 * ```
 *
 * Then, in any other template, `{{>my_template context}}` renders `my_template` with `context`.
 *
 * @param template - The template, or an element (like a `<script type="cjs/template">`) whose text is the template
 * @see destroyTemplate
 * @see pauseTemplate
 * @see resumeTemplate
 *
 * @example
 * ```html
 * <script id='my_template' type='cjs/template'>
 *     {{x}}
 * </script>
 * ```
 * ```js
 * var template = cjs.createTemplate(document.getElementById('my_template'));
 * var element1 = template({x: 1});
 * var element2 = template({x: 2});
 * ```
 *
 * @example
 * ```js
 * var element = cjs.createTemplate("{{x}}", {x: 1});
 * ```
 */
export function createTemplate(template: unknown): TemplateFunction;
export function createTemplate(template: unknown, context: unknown, parent?: unknown): Node;
export function createTemplate(template: unknown, ...args: unknown[]): TemplateFunction | Node {
	const parsed = parseTemplate(templateSource(template));
	const render: TemplateFunction = (context, parent) => renderTemplate(parsed, context, parent);
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
export function registerPartial(name: string, template: TemplateFunction | string): void {
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
export function registerCustomPartial(name: string, options: CustomPartialOptions): void {
	customPartials.set(name, options);
}

/** Unregisters a partial (registered with `registerPartial` or `registerCustomPartial`). */
export function unregisterPartial(name: string): void {
	partials.delete(name);
	customPartials.delete(name);
}

/**
 * Stops a rendered template from updating and cleans up after it.
 *
 * @param node - A DOM node returned by a template function
 */
export function destroyTemplate(node: unknown): void {
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
export function pauseTemplate(node: unknown): void {
	const domNode = firstDOMNode(node);
	if (domNode) renderedTemplates.get(domNode)?.pause();
}

/**
 * Resumes updates to a rendered template (after `pauseTemplate`).
 *
 * @param node - A DOM node returned by a template function
 */
export function resumeTemplate(node: unknown): void {
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
export function createParsedConstraint(source: unknown, context: unknown): Constraint {
	let parsedSource: string | undefined;
	let parsed: Expression | undefined;
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
			return undefined;
		}
	});
}
