//     ConstraintJS
//     ConstraintJS may be freely distributed under the MIT License
//     https://soney.github.io/constraintjs/

import { ArrayConstraint, type ArrayConstraintOptions, isArrayConstraint } from "./array-constraint";
import { type ArrayDiff, arrayDiff } from "./array-diff";
import {
	Binding,
	type BindingOptions,
	bindAttr,
	bindChildren,
	bindClass,
	bindCSS,
	bindHTML,
	bindText,
	bindValue,
	inputValue,
} from "./binding";
import {
	Constraint,
	type ConstraintGetter,
	type ConstraintOptions,
	type ConstraintSource,
	isConstraint,
	removeDependency,
} from "./constraint";
import { isPolyDOM } from "./dom";
import { CJSEvent, on } from "./events";
import { FSM, isFSM, type State, type Transition } from "./fsm";
import { get } from "./get";
import { type LiveFunction, liven, type LivenOptions } from "./liven";
import { isMapConstraint, MapConstraint, type MapConstraintOptions } from "./map-constraint";
import { memoize, type MemoizedFunction, type MemoizeOptions } from "./memoize";
import { signal, wait } from "./scheduler";
import {
	createParsedConstraint,
	createTemplate,
	type CustomPartialOptions,
	destroyTemplate,
	pauseTemplate,
	registerCustomPartial,
	registerPartial,
	resumeTemplate,
	type TemplateFunction,
	unregisterPartial,
} from "./template/template";
import type { EqualityCheck } from "./util";

declare const __VERSION__: string;

/**
 * Creates a constraint of the right kind for `value`: an {@link ArrayConstraint} for an array,
 * a {@link MapConstraint} for a plain object, a constraint for an input element's value for a DOM
 * node, and otherwise a {@link Constraint} (whose value can be a plain value, a function that
 * computes it, or another constraint to follow).
 *
 * @example
 *     var x = cjs(),
 *         y = cjs(1),
 *         z = cjs(function() {
 *             return y.get() + 1;
 *         });
 *     x.get(); // undefined
 *     y.get(); // 1
 *     z.get(); // 2
 *
 * @example Options
 *     var yes_lit = cjs(function() { return 1; }, { literal: true }),
 *         not_lit = cjs(function() { return 1; }, { literal: false });
 *     yes_lit.get(); // (function)
 *     not_lit.get(); // 1
 *
 * @example Array and map constraints
 *     var arr = cjs([1,2,3]);
 *     arr.item(0); // 1
 *     var obj = cjs({ foo: 1 });
 *     obj.get('foo'); // 1
 *
 * @example An input's value
 *     var name = cjs(document.getElementById('name_input'));
 */
function createConstraint<T>(value: AnyOnly<T>, options?: object): any;
function createConstraint(value: [], options?: Omit<ArrayConstraintOptions<any>, "value">): ArrayConstraint<any>;
function createConstraint<T>(
	value: T[],
	options?: Omit<ArrayConstraintOptions<NoInfer<T>>, "value">,
): ArrayConstraint<T>;
function createConstraint(input: Node | NodeList | null, options?: ConstraintOptions<any>): Constraint<any>;
function createConstraint<T>(getter: ConstraintGetter<T>, options?: ConstraintOptions<NoInfer<T>>): Constraint<T>;
function createConstraint<T>(constraint: Constraint<T>, options?: ConstraintOptions<NoInfer<T>>): Constraint<T>;
function createConstraint(
	object: Record<string, never>,
	options?: Omit<MapConstraintOptions<string, any>, "value">,
): MapConstraint<string, any>;
function createConstraint<V>(
	object: Record<string, V>,
	options?: Omit<MapConstraintOptions<string, NoInfer<V>>, "value">,
): MapConstraint<string, V>;
function createConstraint<T>(value?: T, options?: ConstraintOptions<NoInfer<T>>): Constraint<T>;
function createConstraint(value?: unknown, options?: object): unknown {
	if (Array.isArray(value)) return new ArrayConstraint({ value, ...options });
	if (isPolyDOM(value)) return inputValue(value);
	if (isPlainObject(value)) return new MapConstraint({ value, ...options });
	return new Constraint(value, options);
}

// Matches only `any`: what kind of constraint `cjs(value)` makes depends on the value at runtime
type AnyOnly<T> = 0 extends 1 & T ? T : never;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") return false;
	const prototype: unknown = Object.getPrototypeOf(value);
	// (An object from another window has that window's Object.prototype)
	return prototype === null || Object.getPrototypeOf(prototype) === null;
}

// Whatever `cjs` was before this library was loaded (see `noConflict`)
const previousCjs = (globalThis as { cjs?: unknown }).cjs;

// Everything on `cjs` except the methods that return `cjs` itself (for chaining)
const api = {
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
	constraint: <T>(value?: ConstraintSource<T>, options?: ConstraintOptions<T>): Constraint<T> =>
		new Constraint<T>(value, options),

	/**
	 * Creates an array constraint.
	 *
	 * @example
	 *     var arr = cjs.array({
	 *         value: [1,2,3]
	 *     });
	 */
	array: <T>(options?: ArrayConstraintOptions<T>): ArrayConstraint<T> => new ArrayConstraint<T>(options),

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
	map: <K = any, V = any>(options?: MapConstraintOptions<K, V>): MapConstraint<K, V> =>
		new MapConstraint<K, V>(options),

	/**
	 * Creates an FSM.
	 *
	 * @param stateNames - The FSM's states; the first one is the starting state
	 *
	 * @example A state machine with two states
	 *     var my_state = cjs.fsm("state1", "state2");
	 */
	fsm: (...stateNames: Array<string | readonly string[]>): FSM => new FSM(...stateNames),

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
	inFSM: <T>(fsm: FSM, values: Record<string, ConstraintSource<T>>): Constraint<T> =>
		new Constraint<T>().inFSM(fsm, values),

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
	version: __VERSION__,

	/** `"ConstraintJS v" + cjs.version` */
	toString: (): string => `ConstraintJS v${__VERSION__}`,
};

/**
 * ConstraintJS. Calling `cjs(value)` creates a constraint; every other API is a property of `cjs`.
 */
export interface ConstraintJS extends CreateConstraint, API {
	/**
	 * Registers a template as a partial that other templates can use (`{{>name context}}`).
	 *
	 * @example
	 *     var my_temp = cjs.createTemplate(...);
	 *     cjs.registerPartial('my_template', my_temp);
	 */
	registerPartial(name: string, template: TemplateFunction | string): ConstraintJS;

	/**
	 * Registers a *custom* partial, whose DOM node is created by a function, that other templates
	 * can use (`{{>name args...}}`).
	 */
	registerCustomPartial(name: string, options: CustomPartialOptions): ConstraintJS;

	/** Unregisters a partial. */
	unregisterPartial(name: string): ConstraintJS;

	/**
	 * Stops a rendered template from updating and cleans up after it.
	 *
	 * @param node - A DOM node returned by a template function
	 */
	destroyTemplate(node: unknown): ConstraintJS;

	/**
	 * Pauses updates to a rendered template (until `resumeTemplate`).
	 *
	 * @param node - A DOM node returned by a template function
	 */
	pauseTemplate(node: unknown): ConstraintJS;

	/**
	 * Resumes updates to a rendered template (after `pauseTemplate`).
	 *
	 * @param node - A DOM node returned by a template function
	 */
	resumeTemplate(node: unknown): ConstraintJS;

	/**
	 * Restores the previous value of the global `cjs` variable (when ConstraintJS was loaded with a
	 * `<script>` tag) and returns ConstraintJS.
	 *
	 * @example
	 *     var ninjaCJS = cjs.noConflict();
	 *     var x = ninjaCJS(1);
	 */
	noConflict(): ConstraintJS;
}
type CreateConstraint = typeof createConstraint;
type API = typeof api;

const cjs: ConstraintJS = Object.assign(createConstraint, api, {
	registerPartial(name: string, template: TemplateFunction | string): ConstraintJS {
		registerPartial(name, template);
		return cjs;
	},
	registerCustomPartial(name: string, options: CustomPartialOptions): ConstraintJS {
		registerCustomPartial(name, options);
		return cjs;
	},
	unregisterPartial(name: string): ConstraintJS {
		unregisterPartial(name);
		return cjs;
	},
	destroyTemplate(node: unknown): ConstraintJS {
		destroyTemplate(node);
		return cjs;
	},
	pauseTemplate(node: unknown): ConstraintJS {
		pauseTemplate(node);
		return cjs;
	},
	resumeTemplate(node: unknown): ConstraintJS {
		resumeTemplate(node);
		return cjs;
	},
	noConflict(): ConstraintJS {
		const global = globalThis as { cjs?: unknown };
		if (global.cjs === cjs) global.cjs = previousCjs;
		return cjs;
	},
});

export default cjs;

// Types can be imported by name (`import { type Constraint } from "constraintjs"`), and are also
// available as `cjs.Constraint` and so on (the only way to name them from CommonJS code). The
// aliases outside the namespace keep the names inside it from referring to themselves once the
// type declarations are bundled.
type _ArrayConstraint<T> = ArrayConstraint<T>;
type _ArrayConstraintOptions<T> = ArrayConstraintOptions<T>;
type _ArrayDiff<T> = ArrayDiff<T>;
type _Binding<V> = Binding<V>;
type _BindingOptions<V> = BindingOptions<V>;
type _CJSEvent = CJSEvent;
type _Constraint<T> = Constraint<T>;
type _ConstraintGetter<T> = ConstraintGetter<T>;
type _ConstraintOptions<T> = ConstraintOptions<T>;
type _ConstraintSource<T> = ConstraintSource<T>;
type _CustomPartialOptions = CustomPartialOptions;
type _EqualityCheck<T> = EqualityCheck<T>;
type _FSM = FSM;
type _LiveFunction = LiveFunction;
type _LivenOptions = LivenOptions;
type _MapConstraint<K, V> = MapConstraint<K, V>;
type _MapConstraintOptions<K, V> = MapConstraintOptions<K, V>;
type _MemoizedFunction<A extends unknown[], R> = MemoizedFunction<A, R>;
type _MemoizeOptions = MemoizeOptions;
type _State = State;
type _TemplateFunction = TemplateFunction;
type _Transition = Transition;

/** @hidden */
declare namespace cjs {
	export type ArrayConstraint<T = any> = _ArrayConstraint<T>;
	export type ArrayConstraintOptions<T = any> = _ArrayConstraintOptions<T>;
	export type ArrayDiff<T = any> = _ArrayDiff<T>;
	export type Binding<V = any> = _Binding<V>;
	export type BindingOptions<V = any> = _BindingOptions<V>;
	export type CJSEvent = _CJSEvent;
	export type Constraint<T = any> = _Constraint<T>;
	export type ConstraintGetter<T = any> = _ConstraintGetter<T>;
	export type ConstraintOptions<T = any> = _ConstraintOptions<T>;
	export type ConstraintSource<T = any> = _ConstraintSource<T>;
	export type CustomPartialOptions = _CustomPartialOptions;
	export type EqualityCheck<T = any> = _EqualityCheck<T>;
	export type FSM = _FSM;
	export type LiveFunction = _LiveFunction;
	export type LivenOptions = _LivenOptions;
	export type MapConstraint<K = any, V = any> = _MapConstraint<K, V>;
	export type MapConstraintOptions<K = any, V = any> = _MapConstraintOptions<K, V>;
	export type MemoizedFunction<A extends unknown[] = any[], R = any> = _MemoizedFunction<A, R>;
	export type MemoizeOptions = _MemoizeOptions;
	export type State = _State;
	export type TemplateFunction = _TemplateFunction;
	export type Transition = _Transition;
}

export type {
	ArrayConstraintOptions,
	ArrayDiff,
	BindingOptions,
	ConstraintGetter,
	ConstraintOptions,
	ConstraintSource,
};
export type { CustomPartialOptions, EqualityCheck, LiveFunction, LivenOptions, MapConstraintOptions };
export type { MemoizedFunction, MemoizeOptions, State, TemplateFunction, Transition };
export { ArrayConstraint, Binding, CJSEvent, Constraint, FSM, MapConstraint };
export type { PropertyBinder } from "./binding";
export type { DOMTargets } from "./dom";
export type { EventFilter } from "./events";
export type { Selector, StateListenerCallback, TransitionCallback, TransitionTrigger } from "./fsm";
export type { HashOption } from "./map-constraint";
