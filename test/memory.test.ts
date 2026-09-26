// Checks that destroyed objects can be garbage collected: nothing global (or long-lived, like a
// constraint or element they depended on) should keep a reference to them. Needs --expose-gc
// (see vitest.config.ts).
import { describe, expect, test } from "vitest";
import cjs from "../src/index";

const gc = (globalThis as { gc?: () => void }).gc;

// Whether the object made by `create` is garbage collected once `create` returns
async function isCollected(create: () => object): Promise<boolean> {
	const ref = new WeakRef(create());
	// WeakRef targets are kept alive until the current job finishes, so wait a tick before collecting
	for (let i = 0; i < 3 && ref.deref(); i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		gc!();
	}
	return ref.deref() === undefined;
}

describe.skipIf(!gc)("Memory", () => {
	test("a destroyed constraint isn't kept alive by its dependencies", async () => {
		const source = cjs(1);
		const make = (destroy: boolean) => () => {
			const dependent = cjs(() => source.get() + 1);
			dependent.onChange(() => {});
			dependent.get();
			if (destroy) dependent.destroy();
			return dependent;
		};
		expect(await isCollected(make(false))).toBe(false);
		expect(await isCollected(make(true))).toBe(true);
	});

	test("a destroyed live function isn't kept alive", async () => {
		const source = cjs(1);
		const make = (destroy: boolean) => () => {
			const live = cjs.liven(() => source.get());
			if (destroy) live.destroy();
			return live._constraint;
		};
		expect(await isCollected(make(false))).toBe(false);
		expect(await isCollected(make(true))).toBe(true);
	});

	test("destroyed array and map constraints aren't kept alive", async () => {
		const source = cjs(1);
		expect(
			await isCollected(() => {
				const arr = cjs([1, 2, 3]);
				const sum = cjs(() => arr.toArray().reduce((a, b) => a + b, source.get()));
				sum.get();
				arr.destroy();
				sum.destroy();
				return arr;
			}),
		).toBe(true);
		expect(
			await isCollected(() => {
				const map = cjs({ a: 1 });
				const value = cjs(() => (map.get("a") ?? 0) + (map.get("missing") ?? 0) + source.get());
				value.get();
				map.destroy();
				value.destroy();
				return map;
			}),
		).toBe(true);
	});

	test("a destroyed template isn't kept alive", async () => {
		const title = cjs("hello");
		const items = cjs([1, 2]);
		const make = (destroy: boolean) => () => {
			const element = cjs.createTemplate(
				"<div title={{title}}>{{title}} {{#each items}}<b>{{this}}</b>{{/each}}</div>",
				{ title, items },
			);
			if (destroy) cjs.destroyTemplate(element);
			return element;
		};
		expect(await isCollected(make(false))).toBe(false);
		expect(await isCollected(make(true))).toBe(true);
	});

	test("a destroyed FSM isn't kept alive by the elements it listened to", async () => {
		const button = document.createElement("button");
		const make = (destroy: boolean) => () => {
			const fsm = cjs.fsm("a", "b");
			fsm.addTransition("a", "b", cjs.on("click", button));
			if (destroy) fsm.destroy();
			return fsm;
		};
		expect(await isCollected(make(false))).toBe(false);
		expect(await isCollected(make(true))).toBe(true);
	});

	test("a destroyed memoized function isn't kept alive", async () => {
		const source = cjs(1);
		expect(
			await isCollected(() => {
				const add = cjs.memoize((x: number) => x + source.get());
				add(1);
				add(2);
				add.destroy();
				return add;
			}),
		).toBe(true);
	});
});
