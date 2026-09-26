import { describe, expect, test } from "vitest";
import { arrayDiff, type ArrayDiff } from "../src/array-diff";
import cjs from "../src/index";

// Applies an edit script the way its consumers do (removals, then additions, then moves)
function applyDiff<T>(from: readonly T[], diff: ArrayDiff<T>): T[] {
	const result = from.slice();
	for (const { from: index } of diff.removed) result.splice(index, 1);
	for (const { item, to } of diff.added) result.splice(to, 0, item);
	for (const { move_from, insert_at } of diff.moved) {
		const [item] = result.splice(move_from, 1);
		result.splice(insert_at, 0, item as T);
	}
	return result;
}

// A small seeded PRNG so failures are reproducible
function random(seed: number): () => number {
	return () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x7fffffff;
	};
}

function randomArray(next: () => number, maxLength: number, distinctValues: number): number[] {
	return Array.from({ length: Math.floor(next() * (maxLength + 1)) }, () => Math.floor(next() * distinctValues));
}

describe("arrayDiff", () => {
	test("documented example", () => {
		expect(arrayDiff(["a", "b", "c"], ["c", "b", "d"])).toEqual({
			removed: [{ from: 0, from_item: "a" }],
			added: [{ item: "d", to: 2, to_item: "d" }],
			moved: [{ item: "c", from: 2, to: 0, move_from: 1, insert_at: 0 }],
			index_changed: [{ item: "c", from: 2, to: 0, from_item: "c", to_item: "c" }],
		});
	});

	test("produces a correct edit script for random arrays (with and without duplicates)", () => {
		const next = random(42);
		for (let i = 0; i < 5000; i++) {
			const distinct = i % 3 === 0 ? 3 : i % 3 === 1 ? 8 : 50;
			const from = randomArray(next, 12, distinct);
			const to = randomArray(next, 12, distinct);
			expect(applyDiff(from, arrayDiff(from, to)), JSON.stringify({ from, to })).toEqual(to);
		}
	});

	test("produces a correct edit script with a custom equality check", () => {
		const next = random(7);
		const equals = (a: { id: number }, b: { id: number }) => a.id === b.id;
		for (let i = 0; i < 2000; i++) {
			const from = randomArray(next, 10, 6).map((id) => ({ id }));
			const to = randomArray(next, 10, 6).map((id) => ({ id }));
			const result = applyDiff(from, arrayDiff(from, to, equals));
			expect(result.map((x) => x.id)).toEqual(to.map((x) => x.id));
		}
	});

	test("treats NaN like === does", () => {
		const diff = arrayDiff([NaN], [NaN]);
		expect(diff.removed).toHaveLength(1);
		expect(diff.added).toHaveLength(1);
	});

	test("keeps unchanged prefixes and suffixes in place", () => {
		const diff = arrayDiff(["a", "b", "x", "c", "d"], ["a", "b", "c", "d"]);
		expect(diff.removed).toEqual([{ from: 2, from_item: "x" }]);
		expect(diff.added).toEqual([]);
		expect(diff.moved).toEqual([]);
	});

	test("moves as few items as possible, preferring to move new items", () => {
		// Only "d" is out of place relative to the others
		expect(arrayDiff(["d", "a", "b", "c"], ["a", "b", "c", "d"]).moved).toHaveLength(1);
		// Reversing n items needs n - 1 moves
		expect(arrayDiff([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]).moved).toHaveLength(4);
		// Two moves are needed; moving the new "x" (and "c") lets the existing "a" and "b" stay put
		const diff = arrayDiff(["a", "b", "c"], ["c", "x", "a", "b"]);
		expect(diff.moved.map((move) => move.item).sort()).toEqual(["c", "x"]);
	});
});

// Ported from the old QUnit suite (test/unit_tests/util_test.js)
describe("Utilities", () => {
	test("Array Diff", () => {
		expect.assertions(9);
		let ad = cjs.arrayDiff([1, 2, 3], [1, 2]);
		expect(ad.removed.length).toBe(1);
		expect(ad.added.length).toBe(0);
		expect(ad.moved.length).toBe(0);

		ad = cjs.arrayDiff([], [1, 2]);
		expect(ad.removed.length).toBe(0);
		expect(ad.added.length).toBe(2);
		expect(ad.moved.length).toBe(0);

		ad = cjs.arrayDiff([1, 2, 3], [3, 2]);
		expect(ad.removed.length).toBe(1);
		expect(ad.added.length).toBe(0);
		expect(ad.moved.length).toBe(1);
	});

	test("Array Diff with custom equals", () => {
		expect.assertions(3);
		const ad = cjs.arrayDiff([{ x: 1 }, { x: 2 }, { x: 3 }], [{ x: 3 }, { x: 2 }], function (a: any, b: any) {
			return a.x === b.x;
		});
		expect(ad.removed.length).toBe(1);
		expect(ad.added.length).toBe(0);
		expect(ad.moved.length).toBe(1);
	});

	test("Array Dif with empty items", () => {
		expect.assertions(1);
		const arr1: string[] = [],
			arr2: string[] = [];
		arr1[2] = arr2[1] = "hi";
		expect(cjs.arrayDiff(arr1, arr2)).toEqual(cjs.arrayDiff([undefined, undefined, "hi"], [undefined, "hi"]));
	});
});
