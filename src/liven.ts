// Liven
// -----

import { Constraint } from "./constraint";
import { isBatching } from "./scheduler";

/** Options for `cjs.liven`. */
export interface LivenOptions {
	/** The `this` for the function. *Default:* the global object */
	context?: unknown;
	/** Run the function right away. *Default:* `true` */
	run_on_create?: boolean;
	/** Pause while the function runs, so that it can't trigger itself. *Default:* `false` */
	pause_while_running?: boolean;
	/** Live functions with a higher priority run before those with a lower (or no) priority. *Default:* `false` */
	priority?: number | false;
	/** Called (with `silent`) when the live function is destroyed. */
	on_destroy?: ((silent?: boolean) => void) | false;
}

/** The object returned by `cjs.liven`. */
export interface LiveFunction {
	/** Stop running the function and clean up. */
	destroy(silent?: boolean): void;
	/** Stop re-running the function until `resume` is called. Returns `false` if it was already paused. */
	pause(): boolean;
	/** Start re-running the function again (running it now if anything changed). Returns `false` if it wasn't paused. */
	resume(): boolean;
	/** Run the function now if anything it depends on has changed. */
	run(): LiveFunction;
	/** Mark the function as needing to re-run (which it does right away, unless paused). */
	invalidate(): void;
	/** The constraint that tracks the function's dependencies (for debugging). */
	readonly _constraint: Constraint;
}

/**
 * Runs `func`, and runs it again whenever any constraint it read changes.
 *
 * @example
 *     var x_val = cjs(0);
 *     var api_update = cjs.liven(function() {
 *         console.log('updating other x');
 *         other_api.setX(x_val.get());
 *     }); // 'updating other x'
 *     x_val.set(2); // 'updating other x'
 */
export function liven(func: (this: any) => void, options?: LivenOptions): LiveFunction {
	const {
		context = globalThis,
		run_on_create = true,
		pause_while_running = false,
		priority = false,
		on_destroy,
	} = options ?? {};

	// The function's dependencies are tracked by a constraint that doesn't store a value: when it's
	// invalidated, its change listener re-runs it
	const node = new Constraint(func, {
		context,
		cache_value: false,
		auto_add_outgoing_dependencies: false,
		run_on_add_listener: false,
	});
	let paused = false;

	const runIfInvalid = (): void => {
		if (!pause_while_running) {
			node.get();
			return;
		}
		pause();
		try {
			node.get();
		} catch (error) {
			// Keep listening (without running again right away): the next change to anything the
			// function read runs it again
			listen();
			throw error;
		}
		resume();
	};

	// Run now, or at the end of the current `cjs.wait()` batch, if anything the function read has
	// changed. (Queueing it when nothing has changed would do nothing but, inside a batch that
	// never ends, queue it again, forever.)
	const runSoon = (): void => {
		if (!run_on_create || node.isValid()) return;
		if (isBatching()) node._enqueueListeners();
		else node.get(false);
	};

	function listen(): void {
		paused = false;
		node.onChangeWithPriority(priority, runIfInvalid);
	}

	function pause(): boolean {
		if (paused) return false;
		paused = true;
		node.offChange(runIfInvalid);
		return true;
	}

	function resume(): boolean {
		if (!paused) return false;
		listen();
		runSoon();
		return true;
	}

	listen();

	const liveFunction: LiveFunction = {
		destroy(silent) {
			if (on_destroy) on_destroy.call(context, silent);
			node.destroy(silent);
		},
		pause,
		resume,
		run() {
			runIfInvalid();
			return liveFunction;
		},
		invalidate() {
			node.invalidate();
		},
		_constraint: node,
	};

	runSoon();
	return liveFunction;
}
