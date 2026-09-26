// Template parser
// ---------------
// Turns template source (HTML with Handlebars-style `{{...}}` tags) into a tree of nodes.
// The HTML parsing is based on John Resig's HTML parser.

import { booleanAttributes } from "../dom";
import { type Expression, parseExpression } from "./expression";

/** An attribute of an element in a template. Its value may contain `{{...}}` expressions. */
export interface Attribute {
	readonly name: string;
	readonly value: string;
}

/** One branch of an `{{#if}}`/`{{#unless}}` block (the main one, or an `{{#elif}}` or `{{#else}}`). */
export interface Branch {
	/** `undefined` for `{{#else}}` */
	readonly condition: Expression | undefined;
	/** `true` for `{{#unless}}` */
	readonly negate: boolean;
	readonly children: TemplateNode[];
}

/** A node of a parsed template. */
export type TemplateNode =
	| { readonly type: "text"; readonly text: string }
	| { readonly type: "comment"; readonly text: string }
	| {
			readonly type: "element";
			readonly tag: string;
			readonly attributes: readonly Attribute[];
			readonly children: TemplateNode[];
	  }
	/** `{{expression}}`, or `{{{expression}}}` for HTML (`literal`) */
	| { readonly type: "expression"; readonly expression: Expression; readonly literal: boolean }
	/** `{{> name args...}}` */
	| { readonly type: "partial"; readonly name: string; readonly args: readonly Expression[] }
	| { readonly type: "if"; readonly branches: Branch[] }
	| {
			readonly type: "each";
			readonly collection: Expression;
			readonly children: TemplateNode[];
			elseChildren: TemplateNode[] | undefined;
	  }
	| { readonly type: "fsm"; readonly fsm: Expression; readonly states: Map<string, TemplateNode[]> }
	| { readonly type: "with"; readonly context: Expression; readonly children: TemplateNode[] };

// Elements that never have children
const voidElements = new Set(
	"area,base,basefont,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr".split(","),
);

const startTagPattern =
	/<([A-Za-z][\w:.-]*)((?:\s+[^\s"'<>/={}]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|(?:[^\s"'=<>`/]|\/(?!>))+))?)*)\s*(\/?)>/y;
const attributePattern = /([^\s"'<>/={}]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|((?:[^\s"'=<>`/]|\/(?!>))+)))?/g;
const endTagPattern = /<\/([A-Za-z][\w:.-]*)[^>]*>/y;
// `{{x}}`, `{{{x}}}`, `{{#block x}}`, `{{/block}}`, `{{> partial x}}`, `{{! comment }}`. The
// content can contain quoted strings with braces in them. (A quote can only start a string, so that
// a mismatched `{{` can't make this backtrack exponentially.)
const handlebarPattern = /\{\{([#=!>|{/])?\s*((?:"[^"]*"|'[^']*'|[^}"'])*?)\s*\/?\}?\}\}/y;
// The name at the start of a tag, like `if` in `{{#if x}}` (or a partial's name)
const tagNamePattern = /^([^\s(]*)\s*([\s\S]*)$/;

// Where parsed nodes go: the root, an element, or a block (or one of a block's branches)
interface Container {
	readonly kind: "root" | "element" | "block";
	/** The element's tag or the block's name (`if`, `elif`, `each`, `state`, ...) */
	readonly tag: string;
	readonly children: TemplateNode[];
	/** For blocks: the block node that branches (`elif`/`else`/`state`) attach to */
	readonly node?: TemplateNode;
}

/**
 * Parses a template.
 *
 * @throws {Error} if the template is malformed
 */
export function parseTemplate(source: string): TemplateNode[] {
	const root: Container = { kind: "root", tag: "", children: [] };
	const stack: Container[] = [root];
	const current = (): Container => stack[stack.length - 1]!;
	const add = (node: TemplateNode): void => {
		current().children.push(node);
	};

	// The innermost open block (ignoring elements), if any
	const innermostBlock = (): Container | undefined => {
		for (let i = stack.length - 1; i >= 0; i--) {
			if (stack[i]!.kind === "block") return stack[i];
		}
		return undefined;
	};

	// Closes everything up to and including the innermost open container matching `kind` and `tag`
	const close = (kind: Container["kind"], tag: string): void => {
		for (let i = stack.length - 1; i > 0; i--) {
			if (stack[i]!.kind === kind && stack[i]!.tag === tag) {
				stack.length = i;
				return;
			}
		}
	};

	// `elif`, `else`, and `state` belong to an enclosing block. Opening one closes the previous
	// sibling (like `{{#elif}}` closing an `{{#elif}}`), then returns the parent block.
	const openBranch = (tag: string, closes: readonly string[], parents: readonly string[]): Container => {
		const previous = innermostBlock();
		if (previous && closes.includes(previous.tag)) close("block", previous.tag);
		const parent = innermostBlock();
		if (!parent || !parents.includes(parent.tag)) {
			throw new Error(`'${tag}' must be inside of a '${parents.join("' or '")}' block`);
		}
		return parent;
	};

	const openBlock = (tag: string, args: string): void => {
		switch (tag) {
			case "if":
			case "unless": {
				const children: TemplateNode[] = [];
				const node: TemplateNode = {
					type: "if",
					branches: [{ condition: parseExpression(args), negate: tag === "unless", children }],
				};
				add(node);
				stack.push({ kind: "block", tag, children, node });
				return;
			}
			case "elif":
			case "else": {
				const parent = openBranch(tag, ["elif"], tag === "elif" ? ["if", "unless"] : ["if", "unless", "each"]);
				const children: TemplateNode[] = [];
				const block = parent.node!;
				if (block.type === "each") {
					block.elseChildren = children;
				} else if (block.type === "if") {
					block.branches.push({
						condition: tag === "else" ? undefined : parseExpression(args),
						negate: false,
						children,
					});
				}
				stack.push({ kind: "block", tag, children });
				return;
			}
			case "each": {
				const node: TemplateNode = {
					type: "each",
					collection: parseExpression(args),
					children: [],
					elseChildren: undefined,
				};
				add(node);
				stack.push({ kind: "block", tag, children: node.children, node });
				return;
			}
			case "fsm": {
				const node: TemplateNode = { type: "fsm", fsm: parseExpression(args), states: new Map() };
				add(node);
				// Anything between `{{#fsm}}` and the first `{{#state}}` is ignored
				stack.push({ kind: "block", tag, children: [], node });
				return;
			}
			case "state": {
				const parent = openBranch(tag, ["state"], ["fsm"]);
				const children: TemplateNode[] = [];
				if (parent.node?.type === "fsm") parent.node.states.set(stateName(args), children);
				stack.push({ kind: "block", tag, children });
				return;
			}
			case "with": {
				const node: TemplateNode = { type: "with", context: parseExpression(args), children: [] };
				add(node);
				stack.push({ kind: "block", tag, children: node.children, node });
				return;
			}
			default:
				throw new Error(`Unknown block helper '{{#${tag}}}'`);
		}
	};

	const parseHandlebar = (prefix: string | undefined, content: string): void => {
		const [, name = "", args = ""] = tagNamePattern.exec(content)!;
		switch (prefix) {
			case "!": // comment
				return;
			case "#":
				openBlock(name, args);
				return;
			case "/":
				close("block", name);
				return;
			case ">":
				add({ type: "partial", name, args: expressionList(parseExpression(args)) });
				return;
			default:
				// `{{x}}`, or `{{{x}}}` for HTML. (With several expressions, only the first is used.)
				add({ type: "expression", expression: firstExpression(parseExpression(content)), literal: prefix === "{" });
		}
	};

	const parseStartTag = (tagName: string, attributeSource: string, selfClosing: boolean): void => {
		const tag = tagName.toLowerCase();
		const attributes: Attribute[] = [];
		for (const [, name = "", doubleQuoted, singleQuoted, unquoted] of attributeSource.matchAll(attributePattern)) {
			const value = doubleQuoted ?? singleQuoted ?? unquoted ?? (booleanAttributes.has(name) ? name : "");
			attributes.push({ name, value });
		}
		const node: TemplateNode = { type: "element", tag, attributes, children: [] };
		add(node);
		if (!selfClosing && !voidElements.has(tag)) stack.push({ kind: "element", tag, children: node.children });
	};

	let index = 0;
	let textStart = 0;
	const flushText = (): void => {
		if (index > textStart) add({ type: "text", text: source.slice(textStart, index) });
	};
	const matchAt = (pattern: RegExp): RegExpExecArray | null => {
		pattern.lastIndex = index;
		return pattern.exec(source);
	};

	while (index < source.length) {
		if (source.startsWith("<!--", index)) {
			const end = source.indexOf("-->", index + 4);
			if (end < 0) throw new Error(`Unclosed comment at character ${index}`);
			flushText();
			add({ type: "comment", text: source.slice(index + 4, end) });
			index = textStart = end + 3;
		} else if (source.startsWith("</", index)) {
			const match = matchAt(endTagPattern) ?? fail(source, index, "Invalid end tag");
			flushText();
			close("element", match[1]!.toLowerCase());
			index = textStart = endTagPattern.lastIndex;
		} else if (source[index] === "<" && /[A-Za-z]/.test(source[index + 1] ?? "")) {
			const match = matchAt(startTagPattern) ?? fail(source, index, "Invalid tag");
			flushText();
			parseStartTag(match[1]!, match[2]!, match[3] === "/");
			index = textStart = startTagPattern.lastIndex;
		} else if (source.startsWith("{{", index)) {
			const match = matchAt(handlebarPattern) ?? fail(source, index, "Unclosed {{");
			flushText();
			parseHandlebar(match[1], match[2]!);
			index = textStart = handlebarPattern.lastIndex;
		} else {
			index++; // part of the text (including a `<` that doesn't start a tag, like in `a < b`)
		}
	}
	flushText();
	return root.children;
}

function fail(source: string, index: number, message: string): never {
	throw new Error(`Parse error: ${message} at character ${index}: ${source.slice(index, index + 30)}`);
}

function expressionList(expression: Expression): Expression[] {
	return expression.type === "Compound" ? expression.body : [expression];
}

function firstExpression(expression: Expression): Expression {
	return expression.type === "Compound" ? (expression.body[0] ?? expression) : expression;
}

// `{{#state name}}` or `{{#state "name with spaces"}}`
function stateName(args: string): string {
	const expression = firstExpression(parseExpression(args));
	if (expression.type === "Identifier") return expression.name;
	if (expression.type === "Literal") return String(expression.value);
	throw new Error(`Invalid state name '${args}'`);
}
