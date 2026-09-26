import { defineConfig, type UserConfig } from "tsdown";
import pkg from "./package.json" with { type: "json" };

const shared: UserConfig = {
	define: { __VERSION__: JSON.stringify(pkg.version) },
	target: "es2022",
	sourcemap: true,
	banner: `/* ${pkg.name} v${pkg.version} (${pkg.homepage}) | ${pkg.license} License */`,
};

export default defineConfig([
	// ES module: `import cjs from "constraintjs"`
	{
		...shared,
		entry: { index: "src/index.ts" },
		format: "esm",
		platform: "neutral",
		dts: true,
	},
	// CommonJS: `const cjs = require("constraintjs")`. Built from an entry with only a default
	// export, which becomes `module.exports` (and `export =` in the type declarations).
	{
		...shared,
		entry: { index: "src/default-entry.ts" },
		format: "cjs",
		platform: "neutral",
		dts: true,
		clean: false,
	},
	// <script> tag: defines a global `cjs` variable
	...[false, true].map((minify): UserConfig => ({
		...shared,
		entry: { constraintjs: "src/default-entry.ts" },
		format: "iife",
		globalName: "cjs",
		platform: "browser",
		minify,
		outputOptions: { entryFileNames: minify ? "[name].global.min.js" : "[name].global.js" },
		clean: false,
	})),
]);
