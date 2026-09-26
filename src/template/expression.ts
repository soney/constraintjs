// Expression parser
// -----------------
// Parses the JavaScript-like expressions used in templates (`{{a.b + 1}}`) and parsed constraints.
// Based on jsep (https://github.com/EricSmekens/jsep), with two additions for templates:
// `./x` reads `x` from the current `this`, and `../x` reads it from the enclosing block's `this`.

/** A parsed expression. */
export type Expression =
	| { type: "Compound"; body: Expression[] } // several expressions, like `a b` or `a, b`
	| { type: "Identifier"; name: string }
	| { type: "Literal"; value: string | number | boolean | null; raw: string }
	| { type: "ThisExpression" }
	| { type: "MemberExpression"; computed: boolean; object: Expression; property: Expression }
	| { type: "CallExpression"; callee: Expression; arguments: Expression[] }
	| { type: "UnaryExpression"; operator: string; argument: Expression; prefix: true }
	| { type: "BinaryExpression"; operator: string; left: Expression; right: Expression }
	| { type: "LogicalExpression"; operator: "&&" | "||"; left: Expression; right: Expression }
	| { type: "ConditionalExpression"; test: Expression; consequent: Expression; alternate: Expression }
	| { type: "Array"; body: Expression[] }
	| { type: "CurrLevelExpression"; argument: Expression } // `./x`
	| { type: "ParentExpression"; argument: Expression }; // `../x`

/** A syntax error in an expression. */
export interface ExpressionError extends Error {
	/** Where in the expression the error is */
	index: number;
	/** What went wrong (the message without the position) */
	description: string;
}

const unaryOperators = new Set(["-", "!", "~", "+"]);

// Binary operators and their precedence (https://en.wikipedia.org/wiki/Order_of_operations#Programming_languages)
const binaryPrecedence: Readonly<Record<string, number>> = {
	"||": 1,
	"&&": 2,
	"|": 3,
	"^": 4,
	"&": 5,
	"==": 6,
	"!=": 6,
	"===": 6,
	"!==": 6,
	"<": 7,
	">": 7,
	"<=": 7,
	">=": 7,
	"<<": 8,
	">>": 8,
	">>>": 8,
	"+": 9,
	"-": 9,
	"*": 10,
	"/": 10,
	"%": 10,
};
const longestBinaryOperator = Math.max(...Object.keys(binaryPrecedence).map((op) => op.length));

const literals: Readonly<Record<string, boolean | null>> = { true: true, false: false, null: null };

const escapes: Readonly<Record<string, string>> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", 0: "\0" };

const isDigit = (ch: string): boolean => ch >= "0" && ch <= "9";
// `@` starts identifiers like `@index` and `@key`
const isIdentifierStart = (ch: string): boolean => /[A-Za-z_$@]/.test(ch);
const isIdentifierPart = (ch: string): boolean => /[\w$]/.test(ch);
const isSpace = (ch: string): boolean => ch === " " || ch === "\t" || ch === "\n" || ch === "\r";

/**
 * Parses an expression. Several expressions (separated by spaces, commas, or semicolons) are
 * returned as a `Compound` expression.
 *
 * @throws {ExpressionError} if the expression can't be parsed
 */
export function parseExpression(source: string): Expression {
	let index = 0;
	const char = (at = index): string => source.charAt(at);

	const fail = (description: string): never => {
		const error = new Error(`${description} at character ${index}`) as ExpressionError;
		error.index = index;
		error.description = description;
		throw error;
	};

	const skipSpaces = (): void => {
		while (isSpace(char())) index++;
	};

	// The main entry point for a single expression (handles `test ? consequent : alternate`)
	const parseConditional = (): Expression | undefined => {
		const test = parseBinary();
		skipSpaces();
		if (!test || char() !== "?") return test;
		index++;
		const consequent = parseConditional() ?? fail("Expected expression");
		skipSpaces();
		if (char() !== ":") fail("Expected :");
		index++;
		const alternate = parseConditional() ?? fail("Expected expression");
		return { type: "ConditionalExpression", test, consequent, alternate };
	};

	// The longest binary operator at the current position (e.g. `===` rather than `==`)
	const parseBinaryOperator = (): string | undefined => {
		skipSpaces();
		for (let length = longestBinaryOperator; length > 0; length--) {
			const candidate = source.substr(index, length);
			if (Object.hasOwn(binaryPrecedence, candidate)) {
				index += length;
				return candidate;
			}
		}
		return undefined;
	};

	// Binary expressions, like `1 + 2 * a`, respecting operator precedence
	const parseBinary = (): Expression | undefined => {
		const first = parseToken();
		if (!first) return undefined;
		const operands: Expression[] = [first];
		const operators: string[] = [];
		const reduce = (): void => {
			const right = operands.pop()!;
			const left = operands.pop()!;
			operands.push(binaryExpression(operators.pop()!, left, right));
		};
		let operator: string | undefined;
		while ((operator = parseBinaryOperator())) {
			const precedence = binaryPrecedence[operator]!;
			while (operators.length > 0 && precedence <= binaryPrecedence[operators[operators.length - 1]!]!) reduce();
			operators.push(operator);
			operands.push(parseToken() ?? fail(`Expected expression after ${operator}`));
		}
		while (operators.length > 0) reduce();
		return operands[0];
	};

	// A single operand: a literal, variable (with property accesses and calls), group, array,
	// unary expression, or `./x` / `../x`
	const parseToken = (): Expression | undefined => {
		skipSpaces();
		const ch = char();
		if (source.startsWith("./", index)) {
			index += 2;
			return { type: "CurrLevelExpression", argument: parseToken() ?? fail("Expected expression after ./") };
		}
		if (source.startsWith("../", index)) {
			index += 3;
			return { type: "ParentExpression", argument: parseToken() ?? fail("Expected expression after ../") };
		}
		if (isDigit(ch) || (ch === "." && isDigit(char(index + 1)))) return parseNumber();
		if (ch === '"' || ch === "'") return parseString();
		if (ch === "[") {
			index++;
			return parsePostfix({ type: "Array", body: parseList("]") });
		}
		if (isIdentifierStart(ch) || ch === "(") return parseVariable();
		if (unaryOperators.has(ch)) {
			index++;
			return {
				type: "UnaryExpression",
				operator: ch,
				argument: parseToken() ?? fail(`Expected expression after ${ch}`),
				prefix: true,
			};
		}
		return undefined;
	};

	// Numbers like `12`, `3.4`, `.5`, and `1e10`
	const parseNumber = (): Expression => {
		const start = index;
		while (isDigit(char())) index++;
		if (char() === ".") {
			index++;
			while (isDigit(char())) index++;
		}
		if (char() === "e" || char() === "E") {
			index++;
			if (char() === "+" || char() === "-") index++;
			if (!isDigit(char())) fail(`Expected exponent (${source.slice(start, index + 1)})`);
			while (isDigit(char())) index++;
		}
		const raw = source.slice(start, index);
		if (isIdentifierStart(char())) fail(`Variable names cannot start with a number (${raw}${char()})`);
		return { type: "Literal", value: parseFloat(raw), raw };
	};

	// Strings in single or double quotes, with the usual escape sequences
	const parseString = (): Expression => {
		const quote = char();
		const start = index++;
		let value = "";
		while (index < source.length) {
			const ch = char(index++);
			if (ch === quote) return { type: "Literal", value, raw: source.slice(start, index) };
			if (ch !== "\\") {
				value += ch;
				continue;
			}
			const escaped = char(index++);
			const hexLength = escaped === "x" ? 2 : escaped === "u" ? 4 : 0;
			const hex = source.substr(index, hexLength);
			if (hexLength > 0 && /^[\da-f]+$/i.test(hex) && hex.length === hexLength) {
				value += String.fromCharCode(parseInt(hex, 16));
				index += hexLength;
			} else {
				value += escapes[escaped] ?? escaped;
			}
		}
		return fail(`Unclosed quote after "${value}"`);
	};

	// A name like `foo`, `_value`, or `$x1`; or the literals `true`, `false`, `null`, and `this`
	const parseIdentifier = (): Expression => {
		const start = index;
		if (!isIdentifierStart(char())) fail(`Unexpected ${char()}`);
		index++;
		while (index < source.length && isIdentifierPart(char())) index++;
		const name = source.slice(start, index);
		if (Object.hasOwn(literals, name)) return { type: "Literal", value: literals[name]!, raw: name };
		if (name === "this") return { type: "ThisExpression" };
		return { type: "Identifier", name };
	};

	// Expressions separated by commas, up to `terminator` (for function arguments and arrays)
	const parseList = (terminator: string): Expression[] => {
		const items: Expression[] = [];
		for (;;) {
			skipSpaces();
			if (index >= source.length) fail(`Expected ${terminator}`);
			const ch = char();
			if (ch === terminator) {
				index++;
				return items;
			}
			if (ch === ",") {
				index++;
				continue;
			}
			items.push(parseConditional() ?? fail("Expected comma"));
		}
	};

	// A variable or parenthesized group, followed by any property accesses and calls:
	// `foo`, `bar.baz`, `foo['bar'].baz`, `Math.acos(obj.angle)`, `(a + b).c`
	const parseVariable = (): Expression => {
		if (char() !== "(") return parsePostfix(parseIdentifier());
		index++;
		const group = parseConditional() ?? fail("Expected expression");
		skipSpaces();
		if (char() !== ")") fail("Unclosed (");
		index++;
		return parsePostfix(group);
	};

	const parsePostfix = (object: Expression): Expression => {
		let node = object;
		for (;;) {
			skipSpaces();
			const ch = char();
			if (ch === ".") {
				index++;
				skipSpaces();
				node = { type: "MemberExpression", computed: false, object: node, property: parseIdentifier() };
			} else if (ch === "[") {
				index++;
				const property = parseConditional() ?? fail("Expected expression");
				skipSpaces();
				if (char() !== "]") fail("Unclosed [");
				index++;
				node = { type: "MemberExpression", computed: true, object: node, property };
			} else if (ch === "(") {
				index++;
				node = { type: "CallExpression", callee: node, arguments: parseList(")") };
			} else {
				return node;
			}
		}
	};

	// Several expressions can be separated by commas, semicolons, or just spaces
	const expressions: Expression[] = [];
	while (index < source.length) {
		const ch = char();
		if (ch === ";" || ch === "," || isSpace(ch)) {
			index++;
			continue;
		}
		const expression = parseConditional();
		if (expression) expressions.push(expression);
		else if (index < source.length) fail(`Unexpected "${char()}"`);
	}
	return expressions.length === 1 ? expressions[0]! : { type: "Compound", body: expressions };
}

function binaryExpression(operator: string, left: Expression, right: Expression): Expression {
	return operator === "&&" || operator === "||"
		? { type: "LogicalExpression", operator, left, right }
		: { type: "BinaryExpression", operator, left, right };
}
