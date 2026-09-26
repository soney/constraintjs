// Ported from the old QUnit suite (test/unit_tests/liven_test.js). Each test keeps, via `expect.assertions(n)`,
// the assertion count that the old `dt(name, n, fn)` wrapper declared. The wrapper's extra memory-leak check
// (which needed an obsolete Chrome extension) was dropped, along with `x = null` assignments that only served it.
import { describe, expect, test } from "vitest";
import cjs from "../src/index";

describe("Liven", () => {
	test("Basic Liven", () => {
		const x = cjs(1),
			y = cjs(() => x.get() + 1);
		let x_clone: number | undefined;
		let y_clone: number | undefined;

		const live_fn = cjs.liven(function () {
			x_clone = x.get();
			y_clone = y.get();
		});
		expect([x_clone, y_clone]).toEqual([1, 2]);

		x.set(2);
		expect([x_clone, y_clone]).toEqual([2, 3]);

		live_fn.pause();
		x.set(3);
		expect([x_clone, y_clone]).toEqual([2, 3]);
		expect(y.get()).toBe(4);

		live_fn.resume();
		expect([x_clone, y_clone]).toEqual([3, 4]);

		live_fn.destroy();
		x.set(4);
		expect([x_clone, y_clone]).toEqual([3, 4]);
	});

	test("Liven Context", () => {
		expect.assertions(2);
		const me = { prop1: 1 };
		let p1_val: number | undefined;
		const x = cjs(1);
		const live_fn = cjs.liven(
			function (this: any) {
				p1_val = this.prop1 + x.get();
			},
			{
				context: me,
			},
		);
		expect(p1_val).toBe(2);
		x.set(2);
		expect(p1_val).toBe(3);
		live_fn.destroy();
	});

	// The assertions run inside the live functions (which are re-run as change listeners), so they use
	// `expect.soft`, which records a failure without throwing, like QUnit's `equal`. A throwing `expect` would
	// either unwind through the library's listener loop (in the original, with `cjs.__debug` on, that leaves
	// the solver's `running_listeners` flag stuck so later tests in this file break too) or be swallowed by it
	// (with `__debug` off the original only logs listener errors) while still counting towards expect.assertions().
	test("Liven Priority", () => {
		expect.assertions(12);
		const x = cjs(1);
		let counter = 0;

		const live_fns = [
			cjs.liven(function () {
				// fourth to run
				if (x.get() === 1) {
					expect.soft(counter++).toBe(0);
				} else {
					expect.soft(counter++).toBe(3);
				}
			}, {}),
			cjs.liven(
				function () {
					// second to run
					if (x.get() === 1) {
						expect.soft(counter++).toBe(1);
					} else {
						expect.soft(counter++).toBe(1);
					}
				},
				{
					priority: 2,
				},
			),
			cjs.liven(function () {
				// fifth to run
				if (x.get() === 1) {
					expect.soft(counter++).toBe(2);
				} else {
					expect.soft(counter++).toBe(4);
				}
			}, {}),
			cjs.liven(
				function () {
					// third to run
					if (x.get() === 1) {
						expect.soft(counter++).toBe(3);
					} else {
						expect.soft(counter++).toBe(2);
					}
				},
				{
					priority: 1,
				},
			),
			cjs.liven(function () {
				// sixth to run
				if (x.get() === 1) {
					expect.soft(counter++).toBe(4);
				} else {
					expect.soft(counter++).toBe(5);
				}
			}, {}),
			cjs.liven(
				function () {
					// first to run
					if (x.get() === 1) {
						expect.soft(counter++).toBe(5);
					} else {
						expect.soft(counter++).toBe(0);
					}
				},
				{
					priority: 3,
				},
			),
		];
		counter = 0;
		x.set(2);
		for (let i = 0; i < live_fns.length; i++) {
			live_fns[i].destroy();
		}
	});
});

describe("Liven options", () => {
	test("run_on_create, invalidate, run, and on_destroy", () => {
		const x = cjs(1);
		let runs = 0;
		let destroyedWith: boolean | undefined;
		const live = cjs.liven(
			() => {
				runs++;
				x.get();
			},
			{ run_on_create: false, on_destroy: (silent) => (destroyedWith = silent) },
		);
		expect(runs).toBe(0);
		live.run();
		expect(runs).toBe(1);
		live.run(); // nothing changed
		expect(runs).toBe(1);
		live.invalidate();
		expect(runs).toBe(2);
		x.set(2);
		expect(runs).toBe(3);
		expect(live.pause()).toBe(true);
		expect(live.pause()).toBe(false);
		expect(live.resume()).toBe(true);
		expect(live.resume()).toBe(false);
		live.destroy(true);
		expect(destroyedWith).toBe(true);
		x.set(3);
		expect(runs).toBe(3);
	});

	test("pause_while_running keeps a live function from running inside itself", () => {
		for (const pause_while_running of [false, true]) {
			const x = cjs(1);
			let depth = 0;
			let maxDepth = 0;
			const live = cjs.liven(
				() => {
					maxDepth = Math.max(maxDepth, ++depth);
					// Reading and then changing `x` invalidates this live function while it's running
					if (x.get() !== 5) x.set(5);
					depth--;
				},
				{ pause_while_running, run_on_create: false },
			);
			live.run();
			expect(x.get()).toBe(5);
			expect(maxDepth).toBe(pause_while_running ? 1 : 2);
			live.destroy();
		}
	});

	test("a live function created during a batch runs when the batch ends", () => {
		let runs = 0;
		cjs.wait();
		const live = cjs.liven(() => {
			runs++;
		});
		expect(runs).toBe(0);
		cjs.signal();
		expect(runs).toBe(1);
		live.destroy();
	});
});
