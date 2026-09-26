// Ported from the old QUnit suite (test/unit_tests/array_test.js). Each test keeps, via `expect.assertions(n)`,
// the assertion count that the old `dt(name, n, fn)` wrapper declared. The wrapper's extra memory-leak check
// (which needed an obsolete Chrome extension) was dropped, along with `x = null` assignments that only served it.
import { describe, expect, test, vi } from "vitest";
import cjs from "../src/index";

describe("Array Constraints", () => {
	test("Basic Arrays", () => {
		expect.assertions(20);
		const arr = cjs([1, 2, 3] as any[]);
		expect(arr.toArray()).toEqual([1, 2, 3]); // simple toArray
		expect(arr.pop()).toBe(3); // Should be the item we removed
		expect(arr.push(3, 4)).toBe(4); // should be the length of the array
		expect(
			arr.map(function (x: any) {
				return x + 1;
			}),
		).toEqual([2, 3, 4, 5]); // should be an array plus 1
		expect(arr.shift()).toBe(1); // Remove the first item
		expect(arr.length()).toBe(3);
		expect(arr.unshift(0, 1)).toBe(5); // return the length
		expect(arr.concat(["other"], cjs(["more", "stuff"]))).toEqual([0, 1, 2, 3, 4, "other", "more", "stuff"]);
		expect(arr.splice(1, 2, "x")).toEqual([1, 2]);
		expect(arr.toArray()).toEqual([0, "x", 3, 4]);
		expect(arr.splice(1, 2, "x", "y", "z")).toEqual(["x", 3]);
		expect(arr.toArray()).toEqual([0, "x", "y", "z", 4]);

		arr.setValue(["A", "B", "A", "B"]);
		expect(arr.indexOf(0)).toBe(-1);
		expect(arr.indexOf("A")).toBe(0);
		expect(arr.lastIndexOf("A")).toBe(2);
		expect(
			arr.some(function (x: any) {
				return x === "B";
			}),
		).toBe(true);
		expect(
			arr.every(function (x: any) {
				return x === "B";
			}),
		).toBe(false);
		expect(arr.slice(2)).toEqual(["A", "B"]);
		expect(arr.length()).toEqual(4);
		expect(arr.join(", ")).toBe("A, B, A, B");
		arr.destroy();
	});

	test("Unsubstantiated Array Items", () => {
		expect.assertions(4);
		const arr = cjs([1, 2, 3]);
		const third_item = cjs(function () {
			return arr.item(2);
		});
		const fourth_item = cjs(function () {
			return arr.item(3);
		});
		expect(third_item.get()).toBe(3);
		expect(fourth_item.get()).toBe(undefined);
		arr.splice(0, 0, 0);
		expect(third_item.get()).toBe(2);
		expect(fourth_item.get()).toBe(3);
	});
});

describe("Array Constraints: regression tests", () => {
	test("every constraint that read a missing item is notified when it's set", () => {
		const arr = cjs<number>([]);
		const first = cjs(() => arr.item(5));
		const second = cjs(() => arr.item(5));
		expect(first.get()).toBe(undefined);
		expect(second.get()).toBe(undefined);
		arr.item(5, 42);
		expect(first.get()).toBe(42);
		expect(second.get()).toBe(42);
	});

	test("searching a sparse array doesn't throw", () => {
		const arr = cjs<string>([]);
		arr.item(2, "c");
		expect(arr.length()).toBe(3);
		expect(arr.indexOf("c")).toBe(2);
		expect(arr.lastIndexOf("c")).toBe(2);
		expect(arr.some((x) => x === "c")).toBe(true);
		expect(arr.indexWhere((x) => x === undefined)).toBe(0);
	});

	test("splice past the end appends, like Array.prototype.splice", () => {
		const arr = cjs(["a", "b"]);
		expect(arr.splice(5, 1, "c")).toEqual([]);
		expect(arr.toArray()).toEqual(["a", "b", "c"]);
	});

	test("slice() updates when items are added", () => {
		const arr = cjs([1, 2, 3]);
		const tail = cjs(() => arr.slice(1));
		expect(tail.get()).toEqual([2, 3]);
		arr.push(4);
		expect(tail.get()).toEqual([2, 3, 4]);
		expect(arr.slice(-2)).toEqual([3, 4]);
	});

	test("setValue() only notifies readers of the items that changed", () => {
		const arr = cjs([1, 2, 3]);
		const first = vi.fn(() => arr.item(0));
		const firstItem = cjs(first);
		firstItem.get();
		arr.setValue([1, 20, 30, 40]);
		firstItem.get();
		expect(first).toHaveBeenCalledTimes(1);
		expect(arr.toArray()).toEqual([1, 20, 30, 40]);
		arr.setValue([5]);
		expect(firstItem.get()).toBe(5);
		expect(arr.toArray()).toEqual([5]);
	});

	test("numeric string indices work like numbers", () => {
		const arr = cjs<string>([]);
		const second = cjs(() => arr.item("1" as unknown as number));
		expect(second.get()).toBe(undefined);
		arr.push("a", "b");
		expect(second.get()).toBe("b");
		arr.item("0" as unknown as number, "x");
		expect(arr.toArray()).toEqual(["x", "b"]);
	});

	test("destroy() empties the array", () => {
		const arr = cjs([1, 2, 3]);
		arr.destroy();
		expect(arr.length()).toBe(0);
		expect(arr.toArray()).toEqual([]);
	});
});
