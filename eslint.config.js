import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["dist/", "coverage/", "docs/"] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
		rules: {
			eqeqeq: ["error", "always", { null: "ignore" }],
			// This library is dynamically typed by design (constraints can hold anything)
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
			// Type-only `declare namespace`s are used to expose types as `cjs.TypeName`
			"@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
			// `const self = this` is not used; aliasing `this` in arrow-heavy code is still clearer sometimes
			"@typescript-eslint/no-this-alias": "off",
		},
	},
);
