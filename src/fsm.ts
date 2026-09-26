// Finite-State Machines
// ---------------------

import { Constraint } from "./constraint";
import type { CJSEvent } from "./events";

let nextId = 0;

/** A state of an {@link FSM}. */
export class State {
	private readonly _fsm: FSM;
	private readonly _name: string;
	private readonly _id = nextId++;

	constructor(fsm: FSM, name: string) {
		this._fsm = fsm;
		this._name = name;
	}

	/** The state's name */
	getName(): string {
		return this._name;
	}

	/** The FSM this state belongs to */
	getFSM(): FSM {
		return this._fsm;
	}

	/** A unique id */
	id(): number {
		return this._id;
	}
}

/** A transition between two states of an {@link FSM}. */
export class Transition {
	private _fsm: FSM | undefined;
	private readonly _from: string;
	private readonly _to: string;
	private readonly _name: string | undefined;
	private readonly _id = nextId++;
	private _event: CJSEvent | undefined;

	constructor(fsm: FSM, from: string, to: string, name?: string) {
		this._fsm = fsm;
		this._from = from;
		this._to = to;
		this._name = name;
	}

	/** The name of the state this transition goes from */
	getFrom(): string {
		return this._from;
	}

	/** The name of the state this transition goes to */
	getTo(): string {
		return this._to;
	}

	getName(): string | undefined {
		return this._name;
	}

	/** The FSM this transition belongs to (`undefined` once it's destroyed) */
	getFSM(): FSM | undefined {
		return this._fsm;
	}

	/** A unique id */
	id(): number {
		return this._id;
	}

	/** The event (from `cjs.on`) that triggers this transition */
	setEvent(event: CJSEvent): void {
		this._event = event;
	}

	/** Runs the transition, if its FSM is in the transition's `from` state. Arguments are passed to listeners. */
	run(...eventArgs: unknown[]): void {
		const fsm = this._fsm;
		if (fsm?.is(this._from)) fsm._setState(this._to, this, ...eventArgs);
	}

	/** Stops the transition from running and cleans up. */
	destroy(): void {
		this._event?._removeTransition(this);
		this._event = undefined;
		this._fsm = undefined;
	}
}

// Selectors
// ---------
// A selector describes the states and transitions that a listener (added with `fsm.on`) is
// interested in, like `"state1"`, `"*"`, or `"state1 -> state2"`. They are matched against state
// names, so a listener can be added before the state it refers to exists.

/** Describes the states and transitions a listener is interested in (see `FSM.prototype.on`). */
export interface Selector {
	/** Whether this selector matches entering the state named `state` */
	matchesState(state: string): boolean;
	/** Whether this selector matches `transition`, right before (`pre`) or right after it runs */
	matchesTransition(transition: Transition, pre: boolean): boolean;
}

/** @internal Matches the state named `name` */
export class StateSelector implements Selector {
	private readonly _name: string;
	constructor(name: string) {
		this._name = name;
	}
	matchesState(state: string): boolean {
		return state === this._name;
	}
	matchesTransition(): boolean {
		return false;
	}
}

/** @internal Matches any state (`*`) */
export class AnyStateSelector implements Selector {
	matchesState(): boolean {
		return true;
	}
	matchesTransition(): boolean {
		return false;
	}
}

/** @internal Matches transitions between states matched by `from` and `to`, before or after they run */
export class TransitionSelector implements Selector {
	private readonly _pre: boolean;
	private readonly _from: Selector;
	private readonly _to: Selector;
	constructor(pre: boolean, from: Selector, to: Selector) {
		this._pre = pre;
		this._from = from;
		this._to = to;
	}
	matchesState(): boolean {
		return false;
	}
	matchesTransition(transition: Transition, pre: boolean): boolean {
		return (
			pre === this._pre && this._from.matchesState(transition.getFrom()) && this._to.matchesState(transition.getTo())
		);
	}
}

// Matches anything that any of its selectors matches
class AnySelector implements Selector {
	private readonly _selectors: readonly Selector[];
	constructor(selectors: readonly Selector[]) {
		this._selectors = selectors;
	}
	matchesState(state: string): boolean {
		return this._selectors.some((selector) => selector.matchesState(state));
	}
	matchesTransition(transition: Transition, pre: boolean): boolean {
		return this._selectors.some((selector) => selector.matchesTransition(transition, pre));
	}
}

// One side of a spec: a state name, `*`, or a comma-separated list of those
function parseStates(spec: string): Selector {
	const selectors = spec
		.split(",")
		.map((name) => name.trim())
		.map((name) => (name === "*" ? new AnyStateSelector() : new StateSelector(name)));
	return selectors.length === 1 ? selectors[0]! : new AnySelector(selectors);
}

const specPattern = /^([\s\w,*-]+)(?:(<->|>-<|->|>-|<-|-<)([\s\w,*-]+))?$/;

// Parses a spec like "state1", "*", or "state1 -> state2" (see `FSM.prototype.on`)
function parseSpec(spec: string): Selector | undefined {
	const match = specPattern.exec(spec);
	if (!match) return undefined;
	const [, left = "", arrow, right = ""] = match;
	if (!arrow) return parseStates(left);
	const leftStates = parseStates(left);
	const rightStates = parseStates(right);
	switch (arrow) {
		case "->": // after going from left to right
			return new TransitionSelector(false, leftStates, rightStates);
		case ">-": // before going from left to right
			return new TransitionSelector(true, leftStates, rightStates);
		case "<-": // after going from right to left
			return new TransitionSelector(false, rightStates, leftStates);
		case "-<": // before going from right to left
			return new TransitionSelector(true, rightStates, leftStates);
		case "<->": // after going either way
			return new AnySelector([
				new TransitionSelector(false, leftStates, rightStates),
				new TransitionSelector(false, rightStates, leftStates),
			]);
		default: // ">-<": before going either way
			return new AnySelector([
				new TransitionSelector(true, leftStates, rightStates),
				new TransitionSelector(true, rightStates, leftStates),
			]);
	}
}

/**
 * Listener callbacks get `(event, transition, toState, fromStateName, ...moreEventArgs)`.
 */
export type StateListenerCallback = (
	this: any,
	event: unknown,
	transition: Transition,
	toState: State,
	fromState: string | null,
	...moreEventArgs: unknown[]
) => unknown;

interface StateListener {
	readonly selector: Selector;
	readonly callback: StateListenerCallback;
	readonly context: unknown;
}

/**
 * Sets up a transition to run. It's called with a function that runs the transition (call it
 * whenever the transition should happen) and the FSM.
 */
export type TransitionCallback = (this: FSM, run: (...eventArgs: unknown[]) => void, fsm: FSM) => void;

/** What can trigger a transition: an event from `cjs.on`, or a {@link TransitionCallback}. */
export type TransitionTrigger = CJSEvent | TransitionCallback;

function isTrigger(value: unknown): value is TransitionTrigger {
	return typeof value === "function" || typeof (value as CJSEvent | null)?._addTransition === "function";
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
export class FSM {
	/**
	 * A constraint whose value is the name of the current state.
	 *
	 * @example
	 *     var my_fsm = cjs.fsm("state1", "state2");
	 *     my_fsm.state.get(); // 'state1'
	 */
	readonly state: Constraint<string | null>;
	private _states = new Map<string, State>();
	private _transitions: Transition[] = [];
	private _currentState: State | null = null;
	/** The state that `addTransition` starts from when no `from` state is given */
	private _chainState: State | null = null;
	private _listeners: StateListener[] = [];
	private _didTransition = false;

	/**
	 * @param stateNames - The FSM's states. The first one is the starting state (see `startsAt`).
	 */
	constructor(...stateNames: Array<string | readonly string[]>) {
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
	addState(...names: string[]): this {
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
	getState(): string | null {
		return this.state.get();
	}

	/**
	 * Adds a transition from the last state added (see `addState`) to `to`, and returns a
	 * function that runs it.
	 *
	 * @example
	 *     var x = cjs.fsm("b", "a");
	 *     var run_transition = x.addTransition("b"); // a -> b
	 *     window.addEventListener("click", run_transition);
	 */
	addTransition(to: string): (...eventArgs: unknown[]) => void;
	/**
	 * Adds a transition from the last state added (see `addState`) to `to`, run by `trigger`.
	 *
	 * @example
	 *     var x = cjs.fsm("b", "a");
	 *     x.addTransition("b", cjs.on('click')); // a -> b when the window is clicked
	 *     x.addTransition("a", function(run_transition) { // b -> a when the window is clicked
	 *         window.addEventListener("click", run_transition);
	 *     });
	 */
	addTransition(to: string, trigger: TransitionTrigger): this;
	/**
	 * Adds a transition from `from` to `to`, and returns a function that runs it.
	 *
	 * @example
	 *     var x = cjs.fsm("a", "b");
	 *     var run_transition = x.addTransition("a", "b");
	 *     window.addEventListener("click", run_transition);
	 */
	addTransition(from: string, to: string): (...eventArgs: unknown[]) => void;
	/**
	 * Adds a transition from `from` to `to`, run by `trigger`.
	 *
	 * @example
	 *     var x = cjs.fsm("a", "b");
	 *     x.addTransition("a", "b", cjs.on("click"));
	 */
	addTransition(from: string, to: string, trigger: TransitionTrigger): this;
	addTransition(...args: unknown[]): ((...eventArgs: unknown[]) => void) | this {
		if (args.length === 0) throw new Error("addTransition expects at least one argument");
		const [from, to, trigger] =
			args.length === 1 || (args.length === 2 && isTrigger(args[1]))
				? [this._chainState?.getName(), args[0], args[1]]
				: args;
		if (from === undefined) throw new Error("addTransition: there is no state to transition from");

		const transition = new Transition(
			this,
			this._getOrCreateState(stateName(from)).getName(),
			this._getOrCreateState(stateName(to)).getName(),
		);
		this._transitions.push(transition);

		const run = (...eventArgs: unknown[]): void => transition.run(...eventArgs);
		if (trigger === undefined) return run;
		if (typeof trigger === "function") {
			(trigger as TransitionCallback).call(this, run, this);
		} else {
			transition.setEvent(trigger as CJSEvent);
			(trigger as CJSEvent)._addTransition(transition);
		}
		return this;
	}

	/**
	 * @internal Changes the current state. Transitions call this. Without a `transition`, it jumps
	 * straight to the state `to`, and only listeners for entering that state are called.
	 */
	_setState(to: string, transition?: Transition, ...eventArgs: unknown[]): void {
		const toState = this._states.get(to);
		if (!toState) throw new Error(`Could not find state '${to}'`);
		const fromName = this._currentState?.getName() ?? null;
		const listenerArgs = [eventArgs[0], transition, toState, fromName, ...eventArgs.slice(1)];
		this._didTransition = true;

		for (const listener of [...this._listeners]) {
			if (transition && listener.selector.matchesTransition(transition, true)) {
				listener.callback.apply(listener.context ?? globalThis, listenerArgs as Parameters<StateListenerCallback>);
			}
		}
		this._setCurrentState(toState);
		for (const listener of [...this._listeners]) {
			const { selector } = listener;
			if ((transition && selector.matchesTransition(transition, false)) || selector.matchesState(to)) {
				listener.callback.apply(listener.context ?? globalThis, listenerArgs as Parameters<StateListenerCallback>);
			}
		}
	}

	/**
	 * Removes every state, transition, and listener. Useful for cleaning up memory.
	 */
	destroy(): void {
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
	startsAt(name: string): this {
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
	is(state: string | State): boolean {
		const current = this.getState();
		return current !== null && current === stateName(state);
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
	on(spec: string | Selector, callback: StateListenerCallback, context?: unknown): this {
		const selector = typeof spec === "string" ? parseSpec(spec) : spec;
		if (!selector) throw new Error(`Unrecognized format for state/transition spec: '${spec as string}'`);
		this._listeners.push({ selector, callback, context });
		return this;
	}

	/** An alias for `on`. */
	addEventListener(spec: string | Selector, callback: StateListenerCallback, context?: unknown): this {
		return this.on(spec, callback, context);
	}

	/**
	 * Removes every listener for `callback` that was added with `on`.
	 *
	 * @see on
	 */
	off(callback: StateListenerCallback): this {
		this._listeners = this._listeners.filter((listener) => listener.callback !== callback);
		return this;
	}

	/** An alias for `off`. */
	removeEventListener(callback: StateListenerCallback): this {
		return this.off(callback);
	}

	private _getOrCreateState(name: string): State {
		let state = this._states.get(name);
		if (!state) {
			state = new State(this, name);
			this._states.set(name, state);
		}
		return state;
	}

	private _setCurrentState(state: State): void {
		this._currentState = state;
		this.state.invalidate();
	}
}

function stateName(state: unknown): string {
	return state instanceof State ? state.getName() : String(state);
}

/**
 * Whether `value` is an FSM.
 */
export function isFSM(value: unknown): value is FSM {
	return value instanceof FSM;
}
