// Ported from the old QUnit suite (test/unit_tests/constraint_test.js). Each test keeps, via `expect.assertions(n)`,
// the assertion count that the old `dt(name, n, fn)` wrapper declared. The wrapper's extra memory-leak check
// (which needed an obsolete Chrome extension) was dropped, along with `x = null` assignments that only served it.
import { afterEach, describe, expect, test, vi } from "vitest";
import cjs, { type Constraint } from "../src/index";

describe("Constraints", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test("Basic Constraints", () => {
		expect.assertions(6);
		const x = cjs(1);
		const y = cjs(function () {
			return x.get() + 1;
		});
		const z = cjs(function () {
			return y.get() * 2;
		});
		expect(x.get()).toBe(1);
		expect(y.get()).toBe(2);
		expect(z.get()).toBe(4);
		x.set(10);
		expect(x.get()).toBe(10);
		expect(y.get()).toBe(11);
		expect(z.get()).toBe(22);
		x.destroy();
		y.destroy();
		z.destroy();
	});

	test("Invalidation and change listening", () => {
		expect.assertions(10);
		let x_change_counter = 0,
			y_change_counter = 0;
		const x = cjs("Hello");
		const x_is_hello = cjs(10);
		const x_isnt_hello = cjs(20);
		const y = cjs(function () {
			if (x.get() === "Hello") {
				return x_is_hello.get();
			} else {
				return x_isnt_hello.get();
			}
		});
		x.onChange(function () {
			x_change_counter++;
		});
		y.onChange(function () {
			y_change_counter++;
		});
		expect(x_change_counter).toBe(0);
		expect(y_change_counter).toBe(0);
		expect(y.get()).toBe(x_is_hello.get());
		x.set("World");
		expect(x_change_counter).toBe(1);
		expect(y_change_counter).toBe(1);
		expect(y.get()).toBe(x_isnt_hello.get());
		x_isnt_hello.set(200);
		expect(y.get()).toBe(x_isnt_hello.get());
		expect(x_change_counter).toBe(1);
		expect(y_change_counter).toBe(2);
		x.invalidate();
		expect(x.get()).toBe("World");
	});

	test("Constraint context", () => {
		expect.assertions(1);
		const x = cjs(
			function (this: any) {
				return this.prop1;
			},
			{
				context: { prop1: 1 },
			},
		);
		expect(x.get()).toBe(1);
	});

	test("Self Referring", () => {
		expect.assertions(3);
		const x = cjs(1);
		expect(x.get()).toBe(1);
		x.set(function () {
			return x.get() + 1;
		});
		expect(x.get()).toBe(2);
		expect(x.get()).toBe(2);
	});

	test("Modifiers", () => {
		expect.assertions(21);
		const x = cjs(1),
			y = cjs(2),
			sum_plus_one = x.add(y, 1);
		expect(sum_plus_one.get()).toBe(4);
		y.set(3);
		expect(sum_plus_one.get()).toBe(5);
		x.set(2);
		expect(sum_plus_one.get()).toBe(6);

		let times_a_evaled = 0,
			times_b_evaled = 0;
		const a = cjs(function () {
				times_a_evaled++;
				return false;
			}),
			b = cjs(function () {
				times_b_evaled++;
				return false;
			}),
			and_val = a.and(b),
			or_val = a.or(b);
		expect(times_a_evaled).toBe(0);
		expect(times_b_evaled).toBe(0);
		expect(and_val.get()).toBe(false);
		expect(times_a_evaled).toBe(1);
		expect(times_b_evaled).toBe(0);
		a.invalidate();
		b.invalidate();
		expect(or_val.get()).toBe(false);
		expect(times_a_evaled).toBe(2);
		expect(times_b_evaled).toBe(1);

		a.set(function () {
			times_a_evaled++;
			return true;
		});

		a.invalidate();
		b.invalidate();
		expect(and_val.get()).toBe(false);
		expect(times_a_evaled).toBe(3);
		expect(times_b_evaled).toBe(2);
		a.invalidate();
		b.invalidate();
		expect(or_val.get()).toBe(true);
		expect(times_a_evaled).toBe(4);
		expect(times_b_evaled).toBe(2);

		const negx = x.neg(),
			not_3 = negx.neq(3);

		expect(not_3.get()).toBe(true);
		expect(negx.get()).toBe(-x.get());
		x.set(-3);
		expect(negx.get()).toBe(-x.get());
		expect(not_3.get()).toBe(false);
	});

	test("Setting as constraint", () => {
		expect.assertions(7);
		const x = cjs(1);
		const y = cjs(x);
		const z = cjs(3);
		expect(x.get()).toBe(1);
		expect(y.get()).toBe(1);
		x.set(2);
		expect(x.get()).toBe(2);
		expect(y.get()).toBe(2);
		y.set(z);
		expect(x.get()).toBe(2);
		expect(y.get()).toBe(3);
		expect(z.get()).toBe(3);
	});

	// The old suite contained this exact test twice; it is kept once.
	test("Parsed Constraints", () => {
		expect.assertions(2);
		const a = cjs(1);
		const x = cjs.createParsedConstraint("a+b", { a: a, b: cjs(2) });
		expect(x.get()).toBe(3);
		a.set(2);
		expect(x.get()).toBe(4);
	});

	test("Pause Syncronous Getter", () => {
		expect.assertions(5);
		let eval_count = 0;
		const a = cjs(function (node: any) {
			node.pauseGetter(1);
			node.resumeGetter(10);
		});
		const live_fn = cjs.liven(function () {
			eval_count++;
			a.get();
		});
		const b = a.add(1);
		expect(eval_count).toBe(1);
		expect(a.get()).toBe(10);
		expect(eval_count).toBe(1);
		expect(b.get()).toBe(11);
		expect(eval_count).toBe(1);

		a.destroy();
		b.destroy();
		live_fn.destroy();
	});

	// Originally an async test (dtAsync) driven by real setTimeout calls; the same schedule is now
	// stepped through with fake timers.
	test("Pause Asyncronous Getter", () => {
		expect.assertions(25);
		vi.useFakeTimers();
		let x = 0;
		const a = cjs(function (node: any) {
			node.pauseGetter(1);
			x++;
			setTimeout(function () {
				x++;
				node.resumeGetter(10);
			}, 50);
		});
		expect(x).toBe(0);
		const b = a.add(1);
		expect(a.get()).toBe(1);
		expect(x).toBe(1);
		expect(b.get()).toBe(2);
		expect(x).toBe(1);

		setTimeout(function () {
			expect(x).toBe(1);
			expect(a.get()).toBe(1);
			expect(x).toBe(1);
			expect(b.get()).toBe(2);
			expect(x).toBe(1);
		}, 25);
		setTimeout(function () {
			expect(x).toBe(2);
			expect(a.get()).toBe(10);
			expect(x).toBe(2);
			expect(b.get()).toBe(11);
			expect(x).toBe(2);
		}, 100);
		setTimeout(function () {
			expect(x).toBe(2);
			expect(a.get()).toBe(10);
			expect(x).toBe(2);
			expect(b.get()).toBe(11);
			expect(x).toBe(2);
		}, 150);
		setTimeout(function () {
			expect(x).toBe(2);
			expect(a.get()).toBe(10);
			expect(x).toBe(2);
			expect(b.get()).toBe(11);
			expect(x).toBe(2);
			a.destroy();
			b.destroy();
		}, 200);

		vi.advanceTimersByTime(25); // t=25: first check (getter still paused)
		vi.advanceTimersByTime(75); // t=50: getter resumes with 10; t=100: second check
		vi.advanceTimersByTime(50); // t=150: third check
		vi.advanceTimersByTime(50); // t=200: fourth check and cleanup
	});

	test("Check on nullify", () => {
		expect.assertions(9);
		let computed_z_times = 0;
		const x = cjs(1);
		const y = cjs(
			function () {
				return x.get() % 2;
			},
			{ check_on_nullify: true },
		);
		const z = cjs(function () {
			computed_z_times++;
			return y.get() + 1;
		});

		expect(computed_z_times).toBe(0);
		expect(z.get()).toBe(2);
		expect(computed_z_times).toBe(1);
		expect(z.get()).toBe(2);
		expect(computed_z_times).toBe(1);
		x.set(3);
		expect(z.get()).toBe(2);
		expect(computed_z_times).toBe(1);
		x.set(2);
		expect(z.get()).toBe(1);
		expect(computed_z_times).toBe(2);
	});

	test("Nullify check infinite loop", () => {
		expect.assertions(4);
		const x = cjs(0, { check_on_nullify: true });
		expect(x.get()).toBe(0);
		x.set(function () {
			return x.get() + 1;
		});
		expect(x.get()).toBe(1);

		const y = cjs(0, { check_on_nullify: true });
		const z = cjs(
			function () {
				return y.get();
			},
			{ check_on_nullify: false },
		);
		expect(y.get()).toBe(0);
		y.set(function () {
			return z.get() + 1;
		});
		expect(z.get()).toBe(1);
	});
});

describe("Constraints: regression tests", () => {
	test("setOption accepts an object of options", () => {
		const fn = () => 1;
		const x = cjs(fn);
		expect(x.get()).toBe(1);
		x.setOption({ literal: true, auto_add_outgoing_dependencies: false });
		expect(x.get()).toBe(fn);
		x.setOption("literal", false);
		expect(x.get()).toBe(1);
	});

	test("setOption with a new context recomputes the value", () => {
		const x = cjs(
			function (this: { a: number }) {
				return this.a;
			},
			{ context: { a: 1 } },
		);
		expect(x.get()).toBe(1);
		x.setOption({ context: { a: 2 } });
		expect(x.get()).toBe(2);
	});

	test("set() uses the `equals` option", () => {
		// (cjs.constraint, because cjs() would make a map constraint out of a plain object)
		const x = cjs.constraint<{ id: number; name?: string }>({ id: 1 }, { equals: (a, b) => a.id === b.id });
		const listener = vi.fn();
		x.onChange(listener);
		x.set({ id: 1, name: "same id" });
		expect(listener).not.toHaveBeenCalled();
		x.set({ id: 2 });
		expect(listener).toHaveBeenCalledTimes(1);
		x.destroy();
	});

	test("add() concatenates strings without a leading 0", () => {
		expect(cjs("10").add("px").get()).toBe("10px");
		expect(cjs("a").add("b", "c").get()).toBe("abc");
		expect(cjs(1).add(2, cjs(3)).get()).toBe(6);
		expect(cjs(5).add().get()).toBe(5);
	});

	test("a dependency that is no longer used does not trigger updates", () => {
		const useA = cjs(true);
		const a = cjs("a");
		const b = cjs("b");
		const value = cjs(() => (useA.get() ? a.get() : b.get()));
		const listener = vi.fn();
		value.onChange(listener);
		expect(value.get()).toBe("a");

		useA.set(false);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(value.get()).toBe("b");

		// `value` no longer reads `a`, so changing it shouldn't invalidate `value`
		a.set("A");
		expect(listener).toHaveBeenCalledTimes(1);
		expect(value.isValid()).toBe(true);

		b.set("B");
		expect(listener).toHaveBeenCalledTimes(2);
		expect(value.get()).toBe("B");
	});

	test("an error in a getter doesn't break dependency tracking", () => {
		const shouldThrow = cjs(true);
		const failing = cjs(() => {
			if (shouldThrow.get()) throw new Error("oops");
			return "ok";
		});
		expect(() => failing.get()).toThrow("oops");
		// It recomputes next time, rather than returning a stale value
		expect(failing.isValid()).toBe(false);

		// Reading a constraint at the top level must not make `failing` depend on it
		const x = cjs(1);
		x.get();
		shouldThrow.set(false);
		expect(failing.get()).toBe("ok");
		x.set(2);
		expect(failing.isValid()).toBe(true);
	});

	test("a constraint whose getter threw keeps notifying its listeners", () => {
		// A live function that throws once still runs when its dependencies change again
		const user = cjs.constraint<{ name: string } | null>({ name: "a" });
		const names: string[] = [];
		const live = cjs.liven(() => names.push(user.get()!.name));
		expect(() => user.set(null)).toThrow(TypeError);
		user.set({ name: "b" });
		user.set({ name: "c" });
		expect(names).toEqual(["a", "b", "c"]);
		live.destroy();

		// ...and so does a constraint whose getter threw when it was read
		const x = cjs(1);
		const c = cjs(() => {
			if (x.get() === 2) throw new Error("two");
			return x.get();
		});
		const listener = vi.fn();
		c.onChange(listener);
		x.set(2);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(() => c.get()).toThrow("two");
		x.set(3);
		expect(listener).toHaveBeenCalledTimes(2);
		expect(c.get()).toBe(3);
	});

	test("a constraint that catches a dependency's error updates when the dependency recovers", () => {
		const x = cjs(0);
		const failing = cjs(() => {
			if (x.get() === 0) throw new Error("zero");
			return 10 / x.get();
		});
		const safe = cjs(() => {
			try {
				return failing.get();
			} catch {
				return "fallback";
			}
		});
		expect(safe.get()).toBe("fallback");
		x.set(2);
		expect(safe.get()).toBe(5);
	});

	test("check_on_nullify treats an error as a change", () => {
		const x = cjs(1);
		const checked = cjs(
			() => {
				if (x.get() < 0) throw new Error("negative");
				return x.get() > 10;
			},
			{ check_on_nullify: true },
		);
		const listener = vi.fn();
		checked.onChange(listener);
		expect(() => x.set(-1)).not.toThrow();
		expect(listener).toHaveBeenCalledTimes(1);
		expect(() => checked.get()).toThrow("negative");
		x.set(2);
		expect(checked.get()).toBe(false);
	});

	test("a getter that pauses and then throws doesn't leave the constraint paused", () => {
		const key = cjs("a");
		const cache: Record<string, string> = { b: "cached b" };
		const data = cjs((node: Constraint) => {
			const k = key.get();
			if (k in cache) return cache[k];
			node.pauseGetter("loading");
			throw new Error("offline");
		});
		expect(() => data.get()).toThrow("offline");
		key.set("b");
		expect(data.get()).toBe("cached b");
	});

	test("a constraint can have a very large number of dependents", () => {
		const x = cjs(1);
		const dependents = Array.from({ length: 150_000 }, () => cjs(() => x.get() + 1));
		for (const dependent of dependents) dependent.get();
		x.set(2);
		expect(dependents[0]!.get()).toBe(3);
		expect(dependents[dependents.length - 1]!.get()).toBe(3);
	});

	test("an error in one onChange listener doesn't stop the others or later updates", () => {
		const x = cjs(1);
		const calls: string[] = [];
		x.onChange(() => {
			calls.push("first");
			throw new Error("listener error");
		});
		x.onChange(() => calls.push("second"));
		expect(() => x.set(2)).toThrow("listener error");
		expect(calls).toEqual(["first", "second"]);

		const y = cjs(1);
		const listener = vi.fn();
		y.onChange(listener);
		y.set(2);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	test("set() with silent: true updates the value without invalidating dependents", () => {
		const x = cjs(1);
		const y = x.add(10);
		expect(y.get()).toBe(11);
		x.set(2, { silent: true });
		expect(x.get()).toBe(2);
		expect(y.isValid()).toBe(true);
		expect(y.get()).toBe(11);
		// Later changes still propagate
		x.set(3);
		expect(y.get()).toBe(13);
	});

	test("a listener runs once per batch even if its constraint is invalidated again", () => {
		const x = cjs(1);
		const listener = vi.fn();
		x.onChange(listener);
		cjs.wait();
		x.set(2);
		x.get();
		x.set(3);
		cjs.signal();
		expect(listener).toHaveBeenCalledTimes(1);
	});

	test("an extra signal() doesn't break later batches", () => {
		const x = cjs(1);
		const listener = vi.fn();
		x.onChange(listener);
		cjs.signal(); // unbalanced
		cjs.wait();
		x.set(2);
		expect(listener).not.toHaveBeenCalled();
		cjs.signal();
		expect(listener).toHaveBeenCalledTimes(1);
	});

	test("cjs() only makes map constraints out of plain objects", () => {
		const date = new Date(0);
		expect(cjs.isConstraint(cjs(date))).toBe(true);
		expect(cjs(date).get()).toBe(date);

		const arr = cjs([1, 2]);
		const wrapped = cjs(arr);
		expect(cjs.isConstraint(wrapped)).toBe(true);
		expect(wrapped.get()).toBe(arr);

		const map = cjs({ length: 2, x: 1 });
		expect(cjs.isMapConstraint(map)).toBe(true);
		expect(map.keys()).toEqual(["length", "x"]);
		expect(map.get("x")).toBe(1);
	});

	test("modifiers", () => {
		const x = cjs(4);
		expect(x.typeOf().get()).toBe("number");
		expect(
			cjs
				.constraint([] as unknown[])
				.instanceOf(Array)
				.get(),
		).toBe(true);
		expect(x.iif("yes", "no").get()).toBe("yes");
		expect(x.max(cjs(7), 2).get()).toBe(7);
		expect(x.min(cjs(7), 2).get()).toBe(2);
		expect(x.pow(2).get()).toBe(16);
		expect(x.sqrt().get()).toBe(2);
		expect(x.sub(1, 1).get()).toBe(2);
		expect(x.mul(2, 3).get()).toBe(24);
		expect(x.div(2).get()).toBe(2);
		expect(x.mod(3).get()).toBe(1);
		expect(x.eq("4").get()).toBe(true);
		expect(x.eqStrict("4").get()).toBe(false);
		expect(x.gt(3).get()).toBe(true);
		expect(x.le(3).get()).toBe(false);
		expect(cjs("ff").toInt(16).get()).toBe(255);
		expect(cjs("1.5").toFloat().get()).toBe(1.5);
		expect(
			cjs
				.constraint({ a: { b: 1 } })
				.prop("a", "b")
				.get(),
		).toBe(1);
		expect(cjs.constraint("").prop("length").get()).toBe(0);
		expect(cjs.constraint(null).prop("x").get()).toBe(undefined);
	});

	test("cjs.toString() and version", () => {
		expect(cjs.version).toMatch(/^\d+\.\d+\.\d+/);
		expect(cjs.toString()).toBe(`ConstraintJS v${cjs.version}`);
	});
});

describe("Constraint API", () => {
	test("every modifier", () => {
		const x = cjs(0.5);
		const cases: Array<[Constraint, unknown]> = [
			[x.abs(), 0.5],
			[x.acos(), Math.acos(0.5)],
			[x.asin(), Math.asin(0.5)],
			[x.atan(), Math.atan(0.5)],
			[x.atan2(2), Math.atan2(0.5, 2)],
			[x.cos(), Math.cos(0.5)],
			[x.sin(), Math.sin(0.5)],
			[x.tan(), Math.tan(0.5)],
			[x.round(), 1],
			[x.floor(), 0],
			[x.ceil(), 1],
			[x.log(), Math.log(0.5)],
			[x.exp(), Math.exp(0.5)],
			[cjs("3").pos(), 3],
			[x.not(), false],
			[cjs(5).bitwiseNot(), -6],
			[cjs(5).neqStrict("5"), true],
			[cjs(5).neq("5"), false],
			[cjs(5).lt(6), true],
			[cjs(5).ge(5), true],
			[cjs(5).xor(1), 4],
			[cjs(5).bitwiseAnd(4), 4],
			[cjs(5).bitwiseOr(2), 7],
			[cjs(-16).rightShift(2), -4],
			[cjs(1).leftShift(3), 8],
			[cjs(-16).unsignedRightShift(28), 15],
		];
		for (const [constraint, expected] of cases) expect(constraint.get()).toBe(expected);
	});

	test("cjs(input) follows an input's value", () => {
		const input = document.createElement("input");
		input.value = "a";
		const value = cjs(input);
		expect(value.get()).toBe("a");
		input.value = "b";
		input.dispatchEvent(new Event("input"));
		expect(value.get()).toBe("b");
		value.destroy();
		const inputs = [document.createElement("input"), document.createElement("input")];
		inputs[1]!.value = "z";
		expect(cjs.inputValue(inputs).get()).toEqual(["", "z"]);
	});

	test("cjs.array, cjs.map, and cjs.constraint", () => {
		expect(cjs.array({ value: [1, 2] }).toArray()).toEqual([1, 2]);
		expect(cjs.map({ keys: ["a"], values: [1] }).toObject()).toEqual({ a: 1 });
		expect(cjs.constraint(() => 3).get()).toBe(3);
	});

	test("removeDependency", () => {
		const x = cjs(1);
		const y = cjs(() => x.get() + 1);
		y.get();
		cjs.removeDependency(x, y);
		x.set(2);
		expect(y.isValid()).toBe(true);
		expect(y.get()).toBe(2);
	});

	test("offChange takes a queued listener out of the queue", () => {
		const x = cjs(1);
		const listener = vi.fn();
		x.onChange(listener);
		cjs.wait();
		x.set(2); // queues the listener
		x.offChange(listener);
		cjs.signal();
		expect(listener).not.toHaveBeenCalled();
	});

	test("errors from several listeners are reported together", () => {
		const x = cjs(1);
		x.onChange(() => {
			throw new Error("one");
		});
		x.onChange(() => {
			throw new Error("two");
		});
		expect(() => x.set(2)).toThrow(AggregateError);
	});

	test("resumeGetter with a function value calls it", () => {
		let resume: ((value: unknown) => void) | undefined;
		const x = cjs(function (node: Constraint) {
			node.pauseGetter("waiting");
			resume = (value) => node.resumeGetter(value);
		});
		expect(x.get()).toBe("waiting");
		resume!(() => "computed");
		expect(x.get()).toBe("computed");
	});
});
