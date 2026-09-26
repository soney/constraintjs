// Expression evaluation
// ---------------------

import { Constraint } from "../constraint";
import { get } from "../get";
import { MapConstraint } from "../map-constraint";
import { binaryOperators, unaryOperators } from "../operators";
import type { Expression } from "./expression";

/**
 * One level of template nesting: the value of `this`, plus special variables like `@index` and
 * `@key` (inside `{{#each}}`).
 */
export interface Scope {
	readonly self: unknown;
	readonly specials?: Readonly<Record<string, unknown>>;
}

/**
 * Evaluates an expression. Names are looked up on `context`; `this`, `./x`, `../x`, and
 * `@variables` use `scopes` (outermost first).
 *
 * Constraints that are read are unwrapped (so `{{x}}` shows the value of the constraint `x`),
 * which also makes whatever evaluates the expression depend on them.
 */
export function evaluate(expression: Expression, context: unknown, scopes: readonly Scope[]): unknown {
	const evaluateIn = (node: Expression): unknown => evaluate(node, context, scopes);
	switch (expression.type) {
		case "Literal":
			return expression.value;
		case "ThisExpression":
			return get(scopes[scopes.length - 1]?.self);
		case "Identifier":
			return expression.name.startsWith("@")
				? special(scopes, expression.name.slice(1))
				: unwrap(property(context, expression.name));
		case "MemberExpression":
			return unwrap(property(evaluateIn(expression.object), propertyKey(expression, context, scopes)));
		case "CallExpression": {
			const { callee } = expression;
			// For `a.b(...)`, `this` is `a`
			const thisArg = callee.type === "MemberExpression" ? evaluateIn(callee.object) : globalThis;
			const fn =
				callee.type === "MemberExpression"
					? unwrap(property(thisArg, propertyKey(callee, context, scopes)))
					: evaluateIn(callee);
			return typeof fn === "function" ? fn.apply(thisArg, expression.arguments.map(evaluateIn)) : undefined;
		}
		case "UnaryExpression":
			return unaryOperators[expression.operator]?.(evaluateIn(expression.argument));
		case "BinaryExpression":
			return binaryOperators[expression.operator]?.(evaluateIn(expression.left), evaluateIn(expression.right));
		case "LogicalExpression": {
			// Short-circuit, so that the right side is only evaluated (and depended on) when needed
			const left = evaluateIn(expression.left);
			if (expression.operator === "&&") return left && evaluateIn(expression.right);
			return left || evaluateIn(expression.right);
		}
		case "ConditionalExpression":
			return evaluateIn(expression.test) ? evaluateIn(expression.consequent) : evaluateIn(expression.alternate);
		case "Array":
			return expression.body.map(evaluateIn);
		case "Compound":
			// With several expressions, the first one counts
			return expression.body.length > 0 ? evaluateIn(expression.body[0]!) : undefined;
		case "CurrLevelExpression": {
			// `./x`: evaluate `x` on the current `this`
			const self = get(scopes[scopes.length - 1]?.self);
			return evaluate(expression.argument, self, scopes);
		}
		case "ParentExpression": {
			// `../x`: evaluate `x` on the enclosing `this`
			const parentScopes = scopes.slice(0, -1);
			const self = get(parentScopes[parentScopes.length - 1]?.self);
			return evaluate(expression.argument, self, parentScopes);
		}
	}
}

// Reads a property of an object or map constraint
function property(object: unknown, key: PropertyKey): unknown {
	if (object == null) return undefined;
	if (object instanceof MapConstraint) return object.get(key);
	return (object as Record<PropertyKey, unknown>)[key];
}

function propertyKey(
	expression: Extract<Expression, { type: "MemberExpression" }>,
	context: unknown,
	scopes: readonly Scope[],
): PropertyKey {
	const { property: key, computed } = expression;
	if (computed) return evaluate(key, context, scopes) as PropertyKey;
	return key.type === "Identifier" ? key.name : String(evaluate(key, context, scopes));
}

// `@name`: the innermost scope's special variable called `name`
function special(scopes: readonly Scope[], name: string): unknown {
	for (let i = scopes.length - 1; i >= 0; i--) {
		const specials = scopes[i]!.specials;
		if (specials && Object.hasOwn(specials, name)) return unwrap(specials[name]);
	}
	return undefined;
}

function unwrap(value: unknown): unknown {
	return value instanceof Constraint ? value.get() : value;
}
