// Bindings
// --------
// A binding keeps some aspect of DOM nodes (their text, attributes, children, ...) in sync with
// constraints.

import { arrayDiff } from "./array-diff";
import { Constraint } from "./constraint";
import { booleanAttributes, type DOMTargets, isDOMNode, isElement, toDOMArray } from "./dom";
import { get } from "./get";
import { type LiveFunction, liven } from "./liven";
import { camelCase } from "./util";

/** Options for a {@link Binding}. */
export interface BindingOptions<V = any> {
	/** The DOM nodes to update (a node, an array, a NodeList, a jQuery object, or a constraint of these) */
	targets: DOMTargets;
	/** Computes the value to apply. Constraints it reads are tracked. */
	getter: () => V;
	/** Applies a value to one target node */
	setter: (this: Binding<V>, target: Node, value: V, previous: V | undefined) => void;
	/** The value before the binding was created, or a function that reads it from the first target */
	init_val?: V | ((target: Node | undefined) => V);
	/** Called with the new and previous values before the targets are updated */
	onChange?: (this: Binding<V>, value: V, previous: V | undefined) => void;
	/** Called when the binding is destroyed */
	onDestroy?: () => void;
	/** Called when the binding is destroyed (used to clean up the binding's own constraints) */
	coreDestroy?: () => void;
}

/**
 * Keeps some aspect of DOM nodes in sync with a value computed from constraints. For example,
 * `cjs.bindText` creates a binding that keeps an element's text up to date.
 */
export class Binding<V = any> {
	readonly options: BindingOptions<V>;
	readonly targets: DOMTargets;
	private _throttleDelay: number | false = false;
	private _timeoutId: ReturnType<typeof setTimeout> | undefined;
	private readonly _update: () => void;
	private readonly _live: LiveFunction;

	constructor(options: BindingOptions<V>) {
		this.options = options;
		this.targets = options.targets;
		const { getter, setter, init_val } = options;

		let value: V;
		let previous =
			typeof init_val === "function"
				? (init_val as (target: Node | undefined) => V)(toDOMArray(this.targets).find(isDOMNode))
				: init_val;

		this._update = () => {
			this._timeoutId = undefined;
			const targets = toDOMArray(this.targets).filter(isDOMNode);
			options.onChange?.call(this, value, previous);
			for (const target of targets) setter.call(this, target, value, previous);
			previous = value;
		};

		this._live = liven(() => {
			value = getter(); // read inside the live function, so that its dependencies are tracked
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
	pause(): this {
		this._live.pause();
		return this;
	}

	/**
	 * Start updating the targets again (after `pause`).
	 *
	 * @see pause
	 * @see throttle
	 */
	resume(): this {
		this._live.resume();
		return this;
	}

	/**
	 * Wait at least `minDelay` milliseconds between updates (`0` to update right away again).
	 *
	 * @see pause
	 * @see resume
	 */
	throttle(minDelay: number): this {
		this._throttleDelay = minDelay > 0 ? minDelay : false;
		if (this._throttleDelay === false && this._timeoutId !== undefined) {
			// No more waiting: apply the update that was scheduled
			clearTimeout(this._timeoutId);
			this._update();
		}
		this._live.run();
		return this;
	}

	/**
	 * Stop updating the targets and clean up.
	 */
	destroy(): void {
		this._live.destroy();
		if (this._timeoutId !== undefined) {
			clearTimeout(this._timeoutId);
			this._timeoutId = undefined;
		}
		this.options.onDestroy?.();
		this.options.coreDestroy?.();
	}
}

type Setter<V> = BindingOptions<V>["setter"];

// A binding whose value is computed from any number of arguments (constraints or plain values)
function createListBinding<V>(
	compute: (values: readonly unknown[]) => V,
	setter: Setter<V>,
	initialValue?: BindingOptions<V>["init_val"],
): (targets: DOMTargets, ...values: unknown[]) => Binding<V> {
	return (targets, ...values) => {
		const value = new Constraint(() => compute(values));
		return new Binding<V>({
			targets,
			getter: () => value.get(),
			setter,
			init_val: initialValue,
			coreDestroy: () => value.destroy(),
		});
	};
}

/** Binds named properties (like attributes or styles) of DOM elements; see `cjs.bindAttr` and `cjs.bindCSS`. */
export interface PropertyBinder {
	/** Binds the properties in an object of names and values (which can be a constraint or map constraint). */
	(targets: DOMTargets, properties: unknown): Binding<Record<string, unknown>>;
	/** Binds one property. */
	(targets: DOMTargets, name: string, value: unknown): Binding<Record<string, unknown>>;
}

// A binding for named properties (like attributes or styles): takes either an object of names
// and values (which can be a constraint or map constraint), or a name and a value
function createPropertyBinding(
	setProperty: (element: Element, name: string, value: unknown) => void,
	removeProperty: (element: Element, name: string) => void,
): PropertyBinder {
	return (targets: DOMTargets, ...args: unknown[]): Binding<Record<string, unknown>> => {
		if (args.length === 0) return undefined as never; // (nothing to bind)
		const source = args.length === 1 ? args[0] : { [String(args[0])]: args[1] };
		return new Binding<Record<string, unknown>>({
			targets,
			getter: () => {
				const properties = (get(source) ?? {}) as Record<string, unknown>;
				return Object.fromEntries(Object.entries(properties).map(([name, value]) => [name, get(value)]));
			},
			setter: (target, properties, previous) => {
				if (!isElement(target)) return;
				for (const name of Object.keys(previous ?? {})) {
					if (!Object.hasOwn(properties, name)) removeProperty(target, name);
				}
				for (const [name, value] of Object.entries(properties)) setProperty(target, name, value);
			},
		});
	};
}

// Array and array constraint arguments contribute each of their items
function flattenValues(values: readonly unknown[]): unknown[] {
	return values.flatMap((value) => {
		const resolved = get(value);
		return Array.isArray(resolved) ? resolved : [resolved];
	});
}

function toNode(value: unknown): Node {
	return isDOMNode(value) ? value : document.createTextNode(String(value));
}

// Updates `parent`'s children from `previous` to `children` with as few DOM operations as possible
function updateChildren(parent: Node, previous: readonly Node[], children: readonly Node[]): void {
	const { removed, added, moved } = arrayDiff(previous, children);
	for (const { from } of removed) {
		const child = parent.childNodes[from];
		if (child) parent.removeChild(child);
	}
	for (const { item, to } of added) {
		parent.insertBefore(item, parent.childNodes[to] ?? null);
	}
	for (const { move_from, insert_at } of moved) {
		const child = parent.childNodes[move_from];
		if (!child) continue;
		// `insertBefore` takes the child out first, so skip past it when moving it forward
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
export const bindText = createListBinding(
	(values) => values.map((value) => get(value)).join(""),
	(target, text) => {
		target.textContent = text;
	},
);

/**
 * Constrain a DOM element's HTML content to the concatenation of `values`.
 *
 * @example If `my_elem` is a DOM element
 *     var message = cjs('<b>hello</b>');
 *     cjs.bindHTML(my_elem, message);
 */
export const bindHTML = createListBinding(
	(values) => values.map((value) => get(value)).join(""),
	(target, html) => {
		if (isElement(target)) target.innerHTML = html;
	},
);

/**
 * Constrain an input element's value to the concatenation of `values`.
 *
 * @example If `my_input` is a text input element
 *     var value = cjs('hello');
 *     cjs.bindValue(my_input, value);
 */
export const bindValue = createListBinding(
	(values) => values.map((value) => get(value)).join(""),
	(target, value) => {
		(target as HTMLInputElement).value = value;
	},
);

/**
 * Constrain a DOM element's class names. Each value can be a class name, a space-separated list
 * of class names, or an array of them. Classes that the element had before (and that aren't in
 * the values) are left alone.
 *
 * @example If `my_elem` is a DOM element
 *     var classes = cjs('class1 class2');
 *     cjs.bindClass(my_elem, classes);
 */
export const bindClass = createListBinding(
	(values) => {
		const names = flattenValues(values).flatMap((value) =>
			value == null || value === false ? [] : String(value).split(/\s+/).filter(Boolean),
		);
		return [...new Set(names)];
	},
	(target, classes, previous = []) => {
		if (!isElement(target)) return;
		target.classList.remove(...previous.filter((name) => !classes.includes(name)));
		target.classList.add(...classes.filter((name) => !previous.includes(name)));
	},
	[],
);

/**
 * Constrain a DOM element's children. Each value can be a node, text, or an array of them. The
 * bound children are kept at the start of the element; any children it already had stay after them.
 *
 * @example If `my_elem`, `child1`, and `child2` are DOM elements
 *     var nodes = cjs([child1, child2]);
 *     cjs.bindChildren(my_elem, nodes);
 */
export const bindChildren = createListBinding(
	(values) => flattenValues(values).map(toNode),
	(target, children, previous = []) => updateChildren(target, previous, children),
	[],
);

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
export const bindCSS = createPropertyBinding(
	(element, name, value) => {
		const { style } = element as HTMLElement;
		if (name.startsWith("--")) style.setProperty(name, value == null ? "" : String(value));
		else (style as unknown as Record<string, unknown>)[camelCase(name)] = value ?? "";
	},
	(element, name) => {
		const { style } = element as HTMLElement;
		if (name.startsWith("--")) style.removeProperty(name);
		else (style as unknown as Record<string, unknown>)[camelCase(name)] = "";
	},
);

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
export const bindAttr = createPropertyBinding(
	(element, name, value) => {
		if (value == null || (booleanAttributes.has(name) && !value)) element.removeAttribute(name);
		else element.setAttribute(name, String(value));
	},
	(element, name) => element.removeAttribute(name),
);

const inputEvents = ["input", "change", "keyup", "paste"];

// A constraint that follows the value of input elements
class InputValueConstraint extends Constraint<string | string[]> {
	private readonly _elements: HTMLInputElement[];
	private readonly _onInput = (): void => {
		this.invalidate();
	};

	constructor(inputs: DOMTargets) {
		const single = isElement(inputs);
		const elements = (single ? [inputs] : Array.from(inputs as ArrayLike<Node>)) as HTMLInputElement[];
		super(() => (single ? elements[0]!.value : elements.map((element) => element.value)));
		this._elements = elements;
		for (const element of elements) {
			for (const type of inputEvents) element.addEventListener(type, this._onInput);
		}
	}

	override destroy(silent?: boolean): this {
		for (const element of this._elements) {
			for (const type of inputEvents) element.removeEventListener(type, this._onInput);
		}
		return super.destroy(silent);
	}
}

/**
 * A constraint whose value is the value of an input element (or, given several inputs, an array
 * of their values).
 *
 * @example If `name_input` is an input element
 *     var name = cjs.inputValue(name_input);
 */
export function inputValue(inputs: DOMTargets): Constraint<any> {
	return new InputValueConstraint(inputs);
}
