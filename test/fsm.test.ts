// Ported from the old QUnit suite (test/unit_tests/fsm_test.js). Each test keeps, via `expect.assertions(n)`,
// the assertion count that the old `dt(name, n, fn)` wrapper declared. The wrapper's extra memory-leak check
// (which needed an obsolete Chrome extension) was dropped, along with `x = null` assignments that only served it.
import { afterEach, describe, expect, test, vi } from "vitest";
import cjs from "../src/index";

describe("Finite State Machines", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test("Basic FSM", () => {
		expect.assertions(2);
		let do_transition: any;
		const fsm = cjs
			.fsm()
			.addState("state_1")
			.addState("state_2")
			.startsAt("state_1")
			.addTransition("state_2", function (dt: any) {
				do_transition = dt;
			});
		expect(fsm.is("state_1")).toBe(true);
		do_transition();
		expect(fsm.is("state_2")).toBe(true);
	});

	test("addTransition Types", () => {
		expect.assertions(5);
		const fsm = cjs.fsm().addState("state_1").addState("state_2").startsAt("state_1");
		const t12_1 = fsm.addTransition("state_2"),
			t12_2 = fsm.addTransition("state_1", "state_2");
		let t21_1: any, t21_2: any;
		fsm
			.addState("state_2")
			.addTransition("state_1", function (dt: any) {
				t21_1 = dt;
			})
			.addTransition("state_2", "state_1", function (dt: any) {
				t21_2 = dt;
			});
		expect(fsm.is("state_1")).toBe(true);
		t12_1();
		expect(fsm.is("state_2")).toBe(true);
		t21_1();
		expect(fsm.is("state_1")).toBe(true);
		t12_2();
		expect(fsm.is("state_2")).toBe(true);
		t21_2();
		expect(fsm.is("state_1")).toBe(true);
	});

	// Originally a real-time asyncTest; the same setTimeout schedule is now stepped through with fake
	// timers. The original expected 8 assertions; the last one was a memory-leak snapshot taken through
	// the (obsolete) Chrome memory-tester extension and has been dropped.
	test("cjs.on", () => {
		expect.assertions(7);
		vi.useFakeTimers();
		const fsm = cjs
			.fsm()
			.addState("state_1")
			.addState("state_2")
			.startsAt("state_1")
			.addTransition("state_2", cjs.on("timeout", 50))
			.addTransition(
				"state_2",
				cjs.on("timeout", 0).guard(function () {
					return false;
				}),
			)
			.addState("state_2")
			.addTransition(
				"state_1",
				cjs.on("timeout", 50).guard(function () {
					return true;
				}),
			);
		let transition_count = 0;
		fsm.on("state_1 -> state_2", function () {
			transition_count++;
		});
		fsm.on("state_2 -> state_1", function () {
			transition_count++;
		});

		expect(fsm.is("state_1")).toBe(true);
		expect(transition_count).toBe(0);
		setTimeout(function () {
			expect(fsm.is("state_2")).toBe(true);
			expect(transition_count).toBe(1);
			setTimeout(function () {
				expect(fsm.is("state_1")).toBe(true);
				expect(transition_count).toBe(2);
				fsm.destroy();
				setTimeout(function () {
					expect(transition_count).toBe(2);
				}, 150);
			}, 50);
		}, 75);

		vi.advanceTimersByTime(75); // t=75: first check
		vi.advanceTimersByTime(50); // t=125: second check, then the FSM is destroyed
		vi.advanceTimersByTime(150); // t=275: third check
	});

	test("FSM Constraint", () => {
		expect.assertions(5);
		const fsm = cjs.fsm().addState("state_1").addState("state_2").startsAt("state_1");
		const t12 = fsm.addTransition("state_1", "state_2");
		fsm.addTransition("state_2", "state_1"); // (the original stored this as an unused `t21`)
		const s2val = cjs(2);
		const fsmc = cjs.inFSM(fsm, {
			state_1: 1,
			state_2: function () {
				return s2val.get();
			},
		});

		expect(fsm.is("state_1")).toBe(true);
		expect(fsmc.get()).toBe(1);
		t12();
		expect(fsm.is("state_2")).toBe(true);
		expect(fsmc.get()).toBe(2);
		s2val.set(3);
		expect(fsmc.get()).toBe(3);

		fsmc.destroy();
		fsm.destroy();
	});

	test("FSM on", () => {
		expect.assertions(42);
		const fsm = cjs.fsm().addState("state_1").addState("state_2").startsAt("state_1");
		const t12 = fsm.addTransition("state_1", "state_2"),
			t21 = fsm.addTransition("state_2", "state_1");

		let c01 = 0,
			c02 = 0,
			c03 = 0,
			c04 = 0,
			c05 = 0,
			c06 = 0,
			c07 = 0,
			c08 = 0,
			c09 = 0,
			c10 = 0,
			c11 = 0,
			c12 = 0,
			c13 = 0,
			c14 = 0;
		fsm.on("state_1 -> state_2", function () {
			c01++;
		});
		fsm.on("state_1 >- state_2", function () {
			c02++;
		});
		fsm.on("state_2 <- state_1", function () {
			c03++;
		});
		fsm.on("state_2 -< state_1", function () {
			c04++;
		});
		fsm.on("* -> state_2", function () {
			c05++;
		});
		fsm.on("state_1 -> *", function () {
			c06++;
		});
		fsm.on("*", function () {
			c07++;
		});
		fsm.on("state_1 <-> state_2", function () {
			c08++;
		});
		fsm.on("state_1 >-< state_2", function () {
			c09++;
		});
		fsm.on("* -> state_1", function () {
			c10++;
		});
		fsm.on("state_2 -> state_1", function () {
			c11++;
		});
		fsm.on("state_2 >- state_1", function () {
			c12++;
		});
		fsm.on("state_1 <- state_2", function () {
			c13++;
		});
		fsm.on("state_1 -< state_2", function () {
			c14++;
		});

		expect(c01).toBe(0);
		expect(c02).toBe(0);
		expect(c03).toBe(0);
		expect(c04).toBe(0);
		expect(c05).toBe(0);
		expect(c06).toBe(0);
		expect(c07).toBe(0);
		expect(c08).toBe(0);
		expect(c09).toBe(0);
		expect(c10).toBe(0);
		expect(c11).toBe(0);
		expect(c12).toBe(0);
		expect(c13).toBe(0);
		expect(c14).toBe(0);

		t12();

		expect(c01).toBe(1);
		expect(c02).toBe(1);
		expect(c03).toBe(1);
		expect(c04).toBe(1);
		expect(c05).toBe(1);
		expect(c06).toBe(1);
		expect(c07).toBe(1);
		expect(c08).toBe(1);
		expect(c09).toBe(1);
		expect(c10).toBe(0);
		expect(c11).toBe(0);
		expect(c12).toBe(0);
		expect(c13).toBe(0);
		expect(c14).toBe(0);

		t21();

		expect(c01).toBe(1);
		expect(c02).toBe(1);
		expect(c03).toBe(1);
		expect(c04).toBe(1);
		expect(c05).toBe(1);
		expect(c06).toBe(1);
		expect(c07).toBe(2);
		expect(c08).toBe(2);
		expect(c09).toBe(2);
		expect(c10).toBe(1);
		expect(c11).toBe(1);
		expect(c12).toBe(1);
		expect(c13).toBe(1);
		expect(c14).toBe(1);

		fsm.destroy();
	});

	test("FSM startsAt bug", () => {
		expect.assertions(2);
		const fsm = cjs.fsm().addState("state_1");
		expect(fsm.is("state_1")).toBe(true);
		fsm.startsAt("state_2");
		expect(fsm.is("state_2")).toBe(true);

		fsm.destroy();
	});
});

function click(target: EventTarget): void {
	target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("Finite State Machines: regression tests", () => {
	test("off() removes listeners", () => {
		const fsm = cjs.fsm("a", "b");
		const toB = fsm.addTransition("a", "b");
		const listener = vi.fn();
		fsm.on("b", listener);
		fsm.off(listener);
		toB();
		expect(listener).not.toHaveBeenCalled();
	});

	test("specs can list several states", () => {
		const fsm = cjs.fsm("a", "b", "c");
		const toB = fsm.addTransition("a", "b");
		const toC = fsm.addTransition("b", "c");
		const entered = vi.fn();
		const left = vi.fn();
		fsm.on("a, b", entered);
		fsm.on("a, b -> *", left);
		toB();
		toC();
		expect(entered).toHaveBeenCalledTimes(1);
		expect(left).toHaveBeenCalledTimes(2);
	});

	test("adding the first state updates the current state", () => {
		const fsm = cjs.fsm();
		expect(fsm.getState()).toBe(null);
		fsm.addState("x");
		expect(fsm.getState()).toBe("x");
		expect(fsm.is("x")).toBe(true);
	});

	test("a shared event runs only the transition that applies", () => {
		const button = document.createElement("button");
		const clicked = cjs.on("click", button); // one event for both transitions
		const fsm = cjs.fsm("off", "on").addTransition("off", "on", clicked).addTransition("on", "off", clicked);
		click(button);
		expect(fsm.getState()).toBe("on");
		click(button);
		expect(fsm.getState()).toBe("off");
		fsm.destroy();
	});

	test("guards can be chained", () => {
		const button = document.createElement("button");
		let a = true;
		let b = true;
		const fsm = cjs.fsm("idle", "active");
		fsm.addTransition(
			"idle",
			"active",
			cjs
				.on("click", button)
				.guard(() => a)
				.guard(() => b),
		);
		b = false;
		click(button);
		expect(fsm.is("idle")).toBe(true);
		a = false;
		b = true;
		click(button);
		expect(fsm.is("idle")).toBe(true);
		a = true;
		click(button);
		expect(fsm.is("active")).toBe(true);
		fsm.destroy();
	});

	test("events start listening when startsAt() or addState() sets the state", () => {
		const button = document.createElement("button");
		const fsm = cjs
			.fsm("idle", "active")
			.addTransition("idle", "active", cjs.on("click", button))
			.addTransition("active", "idle", cjs.on("click", button))
			.startsAt("active");
		click(button);
		expect(fsm.getState()).toBe("idle");
		click(button);
		expect(fsm.getState()).toBe("active");
		fsm.destroy();

		const other = cjs.fsm().addTransition("a", "b", cjs.on("click", button));
		other.addState("a");
		click(button);
		expect(other.getState()).toBe("b");
		other.destroy();
	});

	test("timeouts start when startsAt() sets the state", () => {
		vi.useFakeTimers();
		try {
			const fsm = cjs.fsm("idle", "waiting").addTransition("waiting", "done", cjs.on("timeout", 5));
			fsm.startsAt("waiting");
			vi.advanceTimersByTime(10);
			expect(fsm.getState()).toBe("done");
			fsm.destroy();
		} finally {
			vi.useRealTimers();
		}
	});

	test("leaving a state cancels its pending timeouts", () => {
		vi.useFakeTimers();
		try {
			const fsm = cjs.fsm("a", "b", "c");
			fsm.addTransition("a", "b", cjs.on("timeout", 100));
			const toC = fsm.addTransition("a", "c");
			expect(vi.getTimerCount()).toBe(1);
			toC();
			expect(vi.getTimerCount()).toBe(0);
			fsm.destroy();
		} finally {
			vi.useRealTimers();
		}
	});

	test("destroying an FSM removes the event listeners it added", () => {
		const button = document.createElement("button");
		// Count the listeners that are currently attached
		const attached = new Set<unknown>();
		const addEventListener = button.addEventListener.bind(button);
		const removeEventListener = button.removeEventListener.bind(button);
		vi.spyOn(button, "addEventListener").mockImplementation((type, listener, options) => {
			attached.add(listener);
			addEventListener(type, listener, options);
		});
		vi.spyOn(button, "removeEventListener").mockImplementation((type, listener, options) => {
			attached.delete(listener);
			removeEventListener(type, listener, options);
		});

		const fsm = cjs.fsm("a", "b");
		fsm.addTransition(
			"a",
			"b",
			cjs.on("click", button).guard(() => true),
		);
		expect(attached.size).toBe(1);
		fsm.destroy();
		expect(attached.size).toBe(0);
	});

	test("_setState without a transition jumps to a state (as older code does)", () => {
		const fsm = cjs.fsm("a", "b");
		const onTransition = vi.fn();
		const onEnter = vi.fn();
		fsm.on("a -> b", onTransition);
		fsm.on("b", onEnter);
		fsm._setState("b");
		expect(fsm.getState()).toBe("b");
		expect(onEnter).toHaveBeenCalledTimes(1);
		expect(onTransition).not.toHaveBeenCalled();
	});
});

describe("FSM API", () => {
	test("transitions, states, and aliases", () => {
		const fsm = cjs.fsm(["a", "b"]);
		expect(cjs.isFSM(fsm)).toBe(true);
		const listener = vi.fn();
		fsm.addEventListener("a -> b", listener);
		const toB = fsm.addTransition("a", "b");
		toB("event", "extra");
		const [event, transition, toState, fromState, extra] = listener.mock.calls[0]!;
		expect(event).toBe("event");
		expect(extra).toBe("extra");
		expect(fromState).toBe("a");
		expect(toState.getName()).toBe("b");
		expect(toState.getFSM()).toBe(fsm);
		expect(typeof toState.id()).toBe("number");
		expect(transition.getFrom()).toBe("a");
		expect(transition.getTo()).toBe("b");
		expect(transition.getFSM()).toBe(fsm);
		expect(typeof transition.id()).toBe("number");
		fsm.removeEventListener(listener);
		fsm.addTransition("b", "a")();
		toB();
		expect(listener).toHaveBeenCalledTimes(1);
		fsm.destroy();
	});

	test("errors", () => {
		const fsm = cjs.fsm();
		expect(() => (fsm.addTransition as unknown as () => void).call(fsm)).toThrow("at least one argument");
		expect(() => fsm.addTransition("b")).toThrow("no state to transition from");
		expect(() => fsm.on("a => b", () => {})).toThrow("Unrecognized format");
	});
});
