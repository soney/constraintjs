// Change-listener scheduling
// --------------------------
// When constraints are invalidated, their `onChange` listeners are queued rather than called
// right away, so that each runs once, after all of the invalidation has finished. `wait()` and
// `signal()` extend that to batches of changes.

/** A callback registered with `Constraint.prototype.onChange` */
export interface ChangeListener {
	readonly callback: (...args: any[]) => unknown;
	readonly context: unknown;
	readonly args: readonly unknown[];
	/** Higher-priority listeners run first; `false` means "no priority" (run after those that have one) */
	readonly priority: number | false;
	/** Whether this listener is waiting in the queue */
	queued: boolean;
}

const queue: ChangeListener[] = [];
let batchDepth = 0; // number of `wait()` calls that haven't been `signal()`ed yet
let running = false;

/**
 * Tells the constraint solver to delay running any `onChange` listeners.
 *
 * Note that `signal` needs to be called the same number of times as `wait` before the listeners
 * will run.
 *
 * @example
 *     var x = cjs(1);
 *     x.onChange(function() {
 *         console.log('x changed');
 *     });
 *     cjs.wait();
 *     x.set(2);
 *     x.set(3);
 *     cjs.signal(); // output: x changed
 */
export function wait(): void {
	batchDepth++;
}

/**
 * Tells the constraint solver it is ready to run any `onChange` listeners. `signal` needs to be
 * called the same number of times as `wait` before the listeners will run.
 *
 * @example
 *     var x = cjs(1);
 *     x.onChange(function() {
 *         console.log('x changed');
 *     });
 *     cjs.wait();
 *     cjs.wait();
 *     x.set(2);
 *     x.set(3);
 *     cjs.signal();
 *     cjs.signal(); // output: x changed
 */
export function signal(): void {
	if (batchDepth > 0) batchDepth--;
	runQueuedListeners();
}

/** Whether we're inside a `wait()`/`signal()` batch. */
export function isBatching(): boolean {
	return batchDepth > 0;
}

/** Runs `fn` as a batch: listeners are held until it finishes. */
export function batch<R>(fn: () => R): R {
	wait();
	try {
		return fn();
	} finally {
		signal();
	}
}

/** Queues a listener to run (once, no matter how many times it's queued before it runs). */
export function enqueue(listener: ChangeListener): void {
	if (listener.queued) return;
	listener.queued = true;
	const { priority } = listener;
	// Listeners with a priority go before any with a lower (or no) priority; otherwise first come, first served
	const position =
		priority === false ? -1 : queue.findIndex((other) => other.priority === false || other.priority < priority);
	if (position < 0) queue.push(listener);
	else queue.splice(position, 0, listener);
}

/** Takes a listener out of the queue (if it's there). */
export function dequeue(listener: ChangeListener): void {
	if (!listener.queued) return;
	listener.queued = false;
	queue.splice(queue.indexOf(listener), 1);
}

/**
 * Runs every queued listener, unless we're inside a batch or already running them. Every listener
 * runs even if some throw; errors are rethrown afterwards (as an `AggregateError` if there are several).
 */
export function runQueuedListeners(): void {
	if (running || batchDepth > 0) return;
	running = true;
	const errors: unknown[] = [];
	try {
		// Listeners can queue more listeners, so keep going until the queue is empty
		let listener: ChangeListener | undefined;
		while ((listener = queue.shift())) {
			listener.queued = false;
			try {
				listener.callback.apply(listener.context ?? globalThis, listener.args as unknown[]);
			} catch (error) {
				errors.push(error);
			}
		}
	} finally {
		running = false;
	}
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1) throw new AggregateError(errors, "Multiple onChange listeners threw errors");
}
