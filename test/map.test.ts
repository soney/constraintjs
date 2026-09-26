// Ported from the old QUnit suite (test/unit_tests/map_test.js). Each test keeps, via `expect.assertions(n)`,
// the assertion count that the old `dt(name, n, fn)` wrapper declared. The wrapper's extra memory-leak check
// (which needed an obsolete Chrome extension) was dropped, along with `x = null` assignments that only served it.
import { describe, expect, test } from "vitest";
import cjs from "../src/index";

describe("Map Constraints", () => {
	test("Basic Maps", () => {
		expect.assertions(16);
		const map = cjs({ x: 1 } as Record<string, any>);
		expect(map.item("x")).toBe(1);
		map.put("x", 2);
		expect(map.item("x")).toBe(2);
		expect(map.has("y")).toBe(false);
		map.item("y", 3);
		expect(map.has("y")).toBe(true);
		expect(map.size()).toBe(2);
		map.setHash(function () {
			return "";
		});
		expect(map.size()).toBe(2);
		expect(map.toObject()).toEqual({ x: 2, y: 3 });
		map.clear();
		expect(map.isEmpty()).toBe(true);
		map.put("b", 2);
		map.put("a", 1, 0);
		map.put("c", 3);
		expect(map.keys()).toEqual(["a", "b", "c"]);
		expect(map.values()).toEqual([1, 2, 3]);
		expect(map.indexOf("a")).toBe(0);
		expect(map.indexOf("b")).toBe(1);
		map.move("a", 1);
		expect(map.indexOf("a")).toBe(1);
		expect(map.indexOf("b")).toBe(0);
		map.remove("a");
		expect(map.indexOf("c")).toBe(1);
		expect(map.keyForValue(2)).toBe("b");

		map.destroy();
	});

	test("Constraints on items", () => {
		expect.assertions(5);
		const m = cjs({} as Record<string, any>);
		const ma = cjs(function () {
			if (m.has("a")) {
				return m.get("a");
			} else {
				return "no a";
			}
		});
		expect(m.isEmpty()).toBe(true);
		expect(ma.get()).toBe("no a");
		m.put("a", 1);
		expect(ma.get()).toBe(1);
		m.put("a", 2);
		expect(ma.get()).toBe(2);
		m.remove("a");
		expect(ma.get()).toBe("no a");
		m.destroy();
		ma.destroy();
	});

	test("Map Optimization", () => {
		expect.assertions(20);
		const m = cjs({} as Record<string, any>);
		let eval_count = 0;
		const x = cjs(function () {
			eval_count++;
			if (m.has("a")) {
				return m.get("a");
			} else {
				return "no a";
			}
		});
		expect(eval_count).toBe(0);
		expect(x.get()).toBe("no a");
		expect(eval_count).toBe(1);
		m.put("b", 2);
		expect(x.get()).toBe("no a");
		expect(eval_count).toBe(1);
		m.put("a", 1);
		expect(x.get()).toBe(1);
		expect(eval_count).toBe(2);
		m.put("c", 3);
		expect(eval_count).toBe(2);
		m.put("a", 11);
		expect(x.get()).toBe(11);
		expect(eval_count).toBe(3);

		eval_count = 0;
		const m2 = cjs({} as Record<string, any>, {
			hash: function (_x: any) {
				return "nohash";
			},
		});
		x.set(function () {
			eval_count++;
			return m2.get("a") || "no a";
		});

		expect(eval_count).toBe(0);
		expect(x.get()).toBe("no a");
		expect(eval_count).toBe(1);
		m2.put("b", 2);
		expect(x.get()).toBe("no a");
		expect(eval_count).toBe(1);
		m2.put("a", 1);
		expect(x.get()).toBe(1);
		expect(eval_count).toBe(2);
		m2.put("c", 3);
		expect(eval_count).toBe(2);
		m2.put("a", 11);
		expect(x.get()).toBe(11);
		expect(eval_count).toBe(3);

		m.destroy();
		m2.destroy();
		x.destroy();
	});

	test("Item values are constraints", () => {
		expect.assertions(5);
		const m = cjs({} as Record<string, any>);
		const ma = m.itemConstraint("a");
		expect(m.isEmpty()).toBe(true);
		expect(ma.get()).toBe(undefined);
		m.put("a", cjs(1));
		expect(ma.get()).toBe(1);
		m.put("a", cjs(2));
		expect(ma.get()).toBe(2);
		m.remove("a");
		expect(ma.get()).toBe(undefined);
		m.destroy();
		ma.destroy();
	});

	test("Maps and maps and maps", () => {
		const m = cjs({} as Record<string, any>),
			sub_m = cjs({} as Record<string, any>),
			sub_m_2 = cjs({}),
			sub_m_3 = {};

		expect(m.has("sub")).toBe(false);
		m.put("sub", sub_m);
		m.put("sub2", sub_m_2);
		m.put("sub3", sub_m_3);
		expect(m.get("sub")).toBe(sub_m);
		expect(m.get("sub2")).toBe(sub_m_2);
		expect(m.get("sub3")).toBe(sub_m_3);

		// A constraint that reads through the nested maps updates when the inner one changes
		const x = cjs(() => m.get("sub").get("x"));
		expect(x.get()).toBe(undefined);
		sub_m.put("x", 1);
		expect(x.get()).toBe(1);

		x.destroy();
		m.destroy();
		sub_m.destroy();
		sub_m_2.destroy();
	});

	test("Constraints whose value is a map", () => {
		const m = cjs({}),
			x = new cjs.Constraint(m),
			y = new cjs.Constraint();

		expect(x.get()).toBe(m);
		y.set(m);
		expect(y.get()).toBe(m);

		m.destroy();
		x.destroy();
		y.destroy();
	});
});

describe("Map Constraints: regression tests", () => {
	test("keys that are also Object.prototype property names work", () => {
		const map = cjs<unknown>({});
		for (const key of ["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"]) {
			expect(map.has(key)).toBe(false);
			expect(map.get(key)).toBe(undefined);
			map.put(key, key.length);
			expect(map.get(key)).toBe(key.length);
		}
		expect(map.keys()).toEqual(["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"]);
	});

	test("setHash works when lookups of missing keys are pending", () => {
		const map = cjs({ a: 1 });
		const b = cjs(() => map.get("b"));
		expect(b.get()).toBe(undefined);
		map.setHash((key: string) => key.toUpperCase());
		map.put("b", 2);
		expect(b.get()).toBe(2);
		expect(map.get("a")).toBe(1);
	});

	test("put() at an index past the end appends", () => {
		const map = cjs({ a: 1, b: 2 });
		map.put("c", 3, 10);
		expect(map.keys()).toEqual(["a", "b", "c"]);
		expect(map.indexOf("c")).toBe(2);
	});

	test("value hashing can be turned on and off", () => {
		const map = cjs({ a: 1, b: 2 });
		map.setValueHash(true);
		expect(map.keyForValue(2)).toBe("b");
		map.setValueHash(false);
		map.put("c", 3);
		expect(map.keyForValue(3)).toBe("c");
		map.setValueHash((value: number) => value % 2);
		map.put("d", 4);
		expect(map.keyForValue(4)).toBe("d");
		expect(map.keyForValue(1)).toBe("a");
	});

	test("objects with a `length` property aren't treated as arrays", () => {
		const map = cjs({ length: 2, x: 1 });
		expect(map.keys()).toEqual(["length", "x"]);
		expect(map.toObject()).toEqual({ length: 2, x: 1 });
	});

	test("moveIndex() ignores indices that are out of range", () => {
		const map = cjs({ a: 1, b: 2, c: 3 });
		map.moveIndex(5, 0);
		expect(map.keys()).toEqual(["a", "b", "c"]);
		map.moveIndex(0, 10); // moves to the end
		expect(map.keys()).toEqual(["b", "c", "a"]);
		expect(map.values()).toEqual([2, 3, 1]);
	});

	test("getOrPut() handles a create function that changes the map", () => {
		const map = cjs<number>({});
		const value = map.getOrPut("a", () => {
			map.put("b", 2);
			map.put("a", 0);
			return 1;
		});
		expect(value).toBe(1);
		expect(map.toObject()).toEqual({ b: 2, a: 1 });
		expect(map.keys()).toEqual(["b", "a"]);
	});
});
