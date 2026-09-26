// Events
// ------
// Events (created with `cjs.on`) trigger FSM transitions. An event only listens while its
// transition could run: when the FSM is in the transition's `from` state.

import { toDOMArray } from "./dom";
import { AnyStateSelector, StateSelector, type Transition, TransitionSelector } from "./fsm";
import { get } from "./get";
import { liven } from "./liven";

/** Decides whether an event should trigger its transitions; called with the event's arguments (like a DOM event). */
export type EventFilter = (this: any, ...events: any[]) => unknown;

/** What an event made by `cjs.on` listens for: DOM event types on targets, or "timeout" with a delay. */
export interface EventSource {
	readonly eventType: unknown; // a string (or a constraint whose value is one), with space-separated types
	readonly targets: readonly unknown[];
}

/**
 * ***Note:*** the preferred way to create an event is with `cjs.on`.
 *
 * An event that triggers FSM transitions, like a click or a timeout. `guard` creates events that
 * only trigger when a condition holds.
 *
 * @see cjs.on
 */
export class CJSEvent {
	private readonly _source: EventSource | undefined;
	private readonly _parent: CJSEvent | undefined;
	private readonly _filter: EventFilter | undefined;
	/** The transitions this event triggers, and how to stop listening for each */
	private readonly _transitions = new Map<Transition, () => void>();

	/** @hidden Events are created with `cjs.on(...)` and `.guard(...)`, rather than with this constructor. */
	constructor(source: EventSource | undefined, parent?: CJSEvent, filter?: EventFilter) {
		this._source = source;
		this._parent = parent;
		this._filter = filter;
	}

	/**
	 * An event that fires when this one does, but only if `filter` returns a truthy value. If
	 * `filter` is a property name instead, the event's `filter` property must equal `value`.
	 *
	 * @example If the user clicks and `ready` is `true`
	 *     cjs.on("click").guard(function() {
	 *         return ready === true;
	 *     });
	 * @example If the user presses the escape key
	 *     cjs.on("keydown").guard("key", "Escape");
	 */
	guard(filter: EventFilter | string, value?: unknown): CJSEvent {
		const test: EventFilter =
			typeof filter === "function" ? filter : (event: Record<string, unknown> | undefined) => event?.[filter] === value;
		return new CJSEvent(undefined, this, test);
	}

	/** @internal Starts triggering `transition`. */
	_addTransition(transition: Transition): void {
		if (this._transitions.has(transition)) return;
		// Find the event that actually listens (the root of the `guard` chain), collecting the
		// filters on the way so that they can be checked outermost first
		const filters: EventFilter[] = [];
		let root: CJSEvent = this;
		while (root._parent) {
			filters.unshift(root._filter!);
			root = root._parent;
		}
		const fire = (...events: unknown[]): void => {
			if (filters.every((filter) => filter.apply(globalThis, events))) transition.run(...events);
		};
		this._transitions.set(transition, listen(root._source!, transition, fire));
	}

	/** @internal Stops triggering `transition`. */
	_removeTransition(transition: Transition): void {
		this._transitions.get(transition)?.();
		this._transitions.delete(transition);
	}
}

const TIMEOUT = "timeout";

// Calls `fire` whenever the source's event happens while `transition`'s FSM is in the
// transition's `from` state. Returns a function that stops listening.
function listen(source: EventSource, transition: Transition, fire: (...events: unknown[]) => void): () => void {
	const fsm = transition.getFSM()!;
	const from = transition.getFrom();
	let eventTypes: string[] = [];
	let targets: EventTarget[] = [];
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	const start = (): void => {
		for (const type of eventTypes) {
			if (type === TIMEOUT) {
				clearTimeout(timeoutId);
				const delay = get(source.targets[0]);
				timeoutId = setTimeout(fire, typeof delay === "number" && delay > 0 ? delay : 0);
			} else {
				for (const target of targets) target.addEventListener(type, fire);
			}
		}
	};
	const stop = (): void => {
		clearTimeout(timeoutId);
		timeoutId = undefined;
		for (const type of eventTypes) {
			if (type !== TIMEOUT) for (const target of targets) target.removeEventListener(type, fire);
		}
	};

	// Listen while in the `from` state: start when entering it, stop right before leaving it
	const fromState = new StateSelector(from);
	fsm.on(fromState, start);
	fsm.on(new TransitionSelector(true, fromState, new AnyStateSelector()), stop);

	// Start over whenever the event type or targets (which can be constraints) change, or when the
	// FSM's state changes without a transition (like with `startsAt`)
	const live = liven(() => {
		stop();
		eventTypes = String(get(source.eventType)).split(/\s+/).filter(Boolean);
		targets = source.targets.flatMap((target) => toDOMArray(target)).filter(isEventTarget);
		if (fsm.is(from)) start();
	});

	return () => {
		live.destroy();
		stop();
		fsm.off(start);
		fsm.off(stop);
	};
}

function isEventTarget(value: unknown): value is EventTarget {
	return typeof (value as EventTarget | null)?.addEventListener === "function";
}

/**
 * Creates an event for FSM transitions (see `FSM.prototype.addTransition`).
 *
 * @param eventType - The type of event to listen for, like `"click"` or `"timeout"` (several
 *     types can be separated by spaces). It can be a constraint.
 * @param targets - What to listen to (default: `window`). For `"timeout"`, the delay in
 *     milliseconds instead.
 *
 * @example When the window resizes
 *     cjs.on("resize")
 * @example When the user clicks `elem1` or `elem2`
 *     cjs.on("click", elem1, elem2)
 * @example After 3 seconds
 *     cjs.on("timeout", 3000)
 */
export function on(eventType: unknown, ...targets: unknown[]): CJSEvent {
	return new CJSEvent({ eventType, targets: targets.length > 0 ? targets : [globalThis] });
}
