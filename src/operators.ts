/* eslint-disable eqeqeq -- these implement JavaScript's own operators, including the loose ones */

// JavaScript's unary and binary operators as functions. Constraint modifiers (`x.add(y)`)
// and template expressions (`{{a + b}}`) are both evaluated with these.

export const unaryOperators: Readonly<Record<string, (a: any) => unknown>> = {
	"+": (a) => +a,
	"-": (a) => -a,
	"~": (a) => ~a,
	"!": (a) => !a,
};

export const binaryOperators: Readonly<Record<string, (a: any, b: any) => unknown>> = {
	"===": (a, b) => a === b,
	"!==": (a, b) => a !== b,
	"==": (a, b) => a == b,
	"!=": (a, b) => a != b,
	">": (a, b) => a > b,
	">=": (a, b) => a >= b,
	"<": (a, b) => a < b,
	"<=": (a, b) => a <= b,
	"+": (a, b) => a + b,
	"-": (a, b) => a - b,
	"*": (a, b) => a * b,
	"/": (a, b) => a / b,
	"%": (a, b) => a % b,
	"^": (a, b) => a ^ b,
	"&": (a, b) => a & b,
	"|": (a, b) => a | b,
	"<<": (a, b) => a << b,
	">>": (a, b) => a >> b,
	">>>": (a, b) => a >>> b,
	"&&": (a, b) => a && b,
	"||": (a, b) => a || b,
};
