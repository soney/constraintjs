// Smoke tests for the built files in dist/ (run `npm run build` first; skipped otherwise)
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import pkg from "../package.json" with { type: "json" };

const dist = resolve(process.cwd(), "dist");
const built = existsSync(resolve(dist, "index.js"));

type CJS = typeof import("../src/index").default;

function exercise(cjs: CJS): void {
	expect(typeof cjs).toBe("function");
	expect(cjs.version).toBe(pkg.version);
	const x = cjs(1);
	const y = cjs(() => x.get() + 1);
	x.set(10);
	expect(y.get()).toBe(11);
	const element = cjs.createTemplate("<p>{{y}}</p>", { y }) as HTMLElement;
	x.set(20);
	expect(element.textContent).toBe("21");
	cjs.destroyTemplate(element);
}

describe.skipIf(!built)("Built files", () => {
	test("ES module", async () => {
		const module = (await import(/* @vite-ignore */ pathToFileURL(resolve(dist, "index.js")).href)) as {
			default: CJS;
		};
		exercise(module.default);
	});

	test("CommonJS: require() returns cjs itself", () => {
		const require = createRequire(resolve(dist, "index.cjs"));
		exercise(require("./index.cjs") as CJS);
	});

	test("script tag: defines a global cjs, and noConflict() restores the previous one", () => {
		const global = globalThis as { cjs?: unknown };
		const previous = { previous: true };
		global.cjs = previous;
		try {
			const code = readFileSync(resolve(dist, "constraintjs.global.min.js"), "utf8");
			// Run it the way a <script> tag would: in the global scope, where `var cjs` defines a global
			(0, eval)(code);
			const cjs = global.cjs as CJS;
			exercise(cjs);
			expect(cjs.noConflict()).toBe(cjs);
			expect(global.cjs).toBe(previous);
		} finally {
			delete global.cjs;
		}
	});
});
