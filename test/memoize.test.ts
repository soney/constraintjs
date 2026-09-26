// Ported from the old QUnit suite (test/unit_tests/memoize_test.js). Each test keeps, via `expect.assertions(n)`,
// the assertion count that the old `dt(name, n, fn)` wrapper declared. The wrapper's extra memory-leak check
// (which needed an obsolete Chrome extension) was dropped, along with `x = null` assignments that only served it.
import { describe, expect, test } from "vitest";
import cjs from "../src/index";

describe("Memoize", () => {
	test("Basic Memoization", () => {
		expect.assertions(8);
		const x = cjs(1),
			y = cjs(function () {
				return x.get() + 1;
			}),
			map = cjs({ a: 1 }),
			arr = cjs([1, 2, 3]);

		let num_calls = 0;
		const y_plus_ma_plus_arr = function (idx: number) {
			num_calls++;
			return y.get() + map.item("a")! + arr.item(idx)!;
		};
		const memoized_fn = cjs.memoize(y_plus_ma_plus_arr);
		expect(memoized_fn(0)).toBe(4);
		expect(num_calls).toBe(1);
		expect(memoized_fn(0)).toBe(4);
		expect(num_calls).toBe(1);

		expect(memoized_fn(1)).toBe(5);
		expect(num_calls).toBe(2);
		x.set(2);
		expect(memoized_fn(1)).toBe(6);
		expect(num_calls).toBe(3);

		memoized_fn.destroy();
	});
});
