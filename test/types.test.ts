// Type-level tests: these are checked by `npm run typecheck` (tsc), not at runtime
import { describe, expectTypeOf, test } from "vitest";
import cjs, { type ArrayConstraint, type Binding, type Constraint, type MapConstraint } from "../src/index";

describe("Types", () => {
	test("cjs() infers the kind of constraint and its value type", () => {
		expectTypeOf(cjs(1)).toEqualTypeOf<Constraint<number>>();
		expectTypeOf(cjs("a")).toEqualTypeOf<Constraint<string>>();
		expectTypeOf(cjs(() => 1)).toEqualTypeOf<Constraint<number>>();
		expectTypeOf(cjs(cjs(true))).toEqualTypeOf<Constraint<boolean>>();
		expectTypeOf(cjs()).toEqualTypeOf<Constraint<unknown>>();
		expectTypeOf(cjs([1, 2])).toEqualTypeOf<ArrayConstraint<number>>();
		expectTypeOf(cjs({ a: 1 })).toEqualTypeOf<MapConstraint<string, number>>();
		expectTypeOf(cjs(new Date())).toEqualTypeOf<Constraint<Date>>();
	});

	test("values that don't say what they hold give `any`", () => {
		expectTypeOf(cjs([])).toEqualTypeOf<ArrayConstraint<any>>();
		expectTypeOf(cjs({})).toEqualTypeOf<MapConstraint<string, any>>();
		expectTypeOf(cjs(null)).toEqualTypeOf<Constraint<any>>();
		expectTypeOf(cjs(JSON.parse("{}"))).toBeAny();
		// An input element (which might not exist) gives a constraint for its value
		expectTypeOf(cjs(document.getElementById("name"))).toEqualTypeOf<Constraint<any>>();
	});

	test("constraints are covariant", () => {
		expectTypeOf<Constraint<number>>().toExtend<Constraint<unknown>>();
		expectTypeOf<ArrayConstraint<number>>().toExtend<ArrayConstraint<unknown>>();
		expectTypeOf<MapConstraint<string, number>>().toExtend<MapConstraint<string, unknown>>();
	});

	test("modifiers and helpers", () => {
		const x = cjs(1);
		expectTypeOf(x.add(1)).toEqualTypeOf<Constraint<any>>();
		expectTypeOf(x.gt(0)).toEqualTypeOf<Constraint<boolean>>();
		expectTypeOf(x.sqrt()).toEqualTypeOf<Constraint<number>>();
		expectTypeOf(cjs.get(x)).toEqualTypeOf<number>();
		expectTypeOf(cjs.get(cjs(["a"]))).toEqualTypeOf<string[]>();
		expectTypeOf(cjs.bindAttr(document.body, "title", x)).toExtend<Binding>();
		expectTypeOf(cjs.bindCSS(document.body, { color: "red" })).toExtend<Binding>();
		expectTypeOf(cjs.createTemplate("{{x}}")).returns.toEqualTypeOf<Node>();
		expectTypeOf(cjs.createTemplate("{{x}}", {})).toEqualTypeOf<Node>();
		expectTypeOf(cjs.memoize((a: number, b: string) => a + b)).parameters.toEqualTypeOf<[number, string]>();
	});

	test("types are also available as cjs.TypeName", () => {
		expectTypeOf<cjs.Constraint<number>>().toEqualTypeOf<Constraint<number>>();
		expectTypeOf<cjs.MapConstraint<string, number>>().toEqualTypeOf<MapConstraint<string, number>>();
	});
});
