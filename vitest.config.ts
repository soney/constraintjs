import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
	define: {
		__VERSION__: JSON.stringify(pkg.version),
	},
	test: {
		environment: "jsdom",
		include: ["test/**/*.test.ts"],
		// For the garbage collection tests in test/memory.test.ts
		execArgv: ["--expose-gc"],
		coverage: {
			include: ["src/**/*.ts"],
		},
	},
});
