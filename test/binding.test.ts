// Ported from the old QUnit suite (test/unit_tests/binding_tests.js). Each test keeps, via `expect.assertions(n)`,
// the assertion count that the old `dt(name, n, fn)` wrapper declared. The wrapper's extra memory-leak check
// (which needed an obsolete Chrome extension) was dropped, along with `x = null` assignments that only served it.
import { afterEach, describe, expect, test, vi } from "vitest";
import cjs from "../src/index";
import { getTextContent } from "./helpers";

describe("Bindings", () => {
	// The old suite contained this exact test twice; it is kept once.
	test("Basic Text Bindings", () => {
		expect.assertions(2);
		const x = cjs("Hello"),
			y = cjs("World");
		const dom_elem = document.createElement("div");
		cjs.bindText(dom_elem, x, y);
		expect(getTextContent(dom_elem)).toBe("HelloWorld");
		x.set("Goodbye");
		expect(getTextContent(dom_elem)).toBe("GoodbyeWorld");
	});

	test("Dynamic Text Bindings", () => {
		expect.assertions(6);
		const x = cjs("Hello"),
			y = cjs("World");

		const dom_elem1 = document.createElement("div");
		const dom_elem2 = document.createElement("div");

		const elems = cjs([dom_elem1, dom_elem2]);
		cjs.bindText(elems, x, y);

		expect(getTextContent(dom_elem1)).toBe("HelloWorld");
		expect(getTextContent(dom_elem2)).toBe("HelloWorld");

		x.set("Goodbye");

		expect(getTextContent(dom_elem1)).toBe("GoodbyeWorld");
		expect(getTextContent(dom_elem2)).toBe("GoodbyeWorld");

		elems.pop();

		y.set("Pittsburgh");

		expect(getTextContent(dom_elem1)).toBe("GoodbyePittsburgh");
		expect(getTextContent(dom_elem2)).toBe("GoodbyeWorld");
	});

	test("CSS Bindings", () => {
		expect.assertions(1);
		const dom_elem = document.createElement("div");
		const curr_map = cjs({} as Record<string, any>);
		cjs.bindCSS(dom_elem, curr_map);
		curr_map.put("color", "red");
		expect(dom_elem.style.color).toBe("red");
	});

	test("Class Bindings", () => {
		expect.assertions(15);
		const dom_elem = document.createElement("div");
		const classes = cjs([] as string[]);
		dom_elem.className = "existing_class";
		expect(dom_elem.classList.contains("class1"), "No class 1").toBe(false);
		expect(dom_elem.classList.contains("class2"), "No class 2").toBe(false);
		expect(dom_elem.classList.contains("existing_class"), "Old class still there").toBe(true);
		cjs.bindClass(dom_elem, classes);
		expect(dom_elem.classList.contains("class1"), "No class 1").toBe(false);
		expect(dom_elem.classList.contains("class2"), "No class 2").toBe(false);
		expect(dom_elem.classList.contains("existing_class"), "Old class still there").toBe(true);
		classes.push("class1");
		expect(dom_elem.classList.contains("class1"), "Has class 1").toBe(true);
		expect(dom_elem.classList.contains("class2"), "No class 2").toBe(false);
		expect(dom_elem.classList.contains("existing_class"), "Old class still there").toBe(true);
		classes.push("class2");
		expect(dom_elem.classList.contains("class1"), "Has class 1").toBe(true);
		expect(dom_elem.classList.contains("class2"), "Has class 2").toBe(true);
		expect(dom_elem.classList.contains("existing_class"), "Old class still there").toBe(true);
		classes.pop();
		expect(dom_elem.classList.contains("class1"), "Has class 1").toBe(true);
		expect(dom_elem.classList.contains("class2"), "No class 2").toBe(false);
		expect(dom_elem.classList.contains("existing_class"), "Old class still there").toBe(true);
	});

	test("Attr Bindings", () => {
		expect.assertions(2);
		const dom_elem = document.createElement("div");
		const attr_val = cjs("abc");
		cjs.bindAttr(dom_elem, "id", attr_val);
		expect(dom_elem.id).toBe("abc");
		attr_val.set("def");
		expect(dom_elem.id).toBe("def");
	});
});

describe("Bindings: regression tests", () => {
	test("bindValue sets an input's value", () => {
		const input = document.createElement("input");
		const value = cjs("hello");
		cjs.bindValue(input, value);
		expect(input.value).toBe("hello");
		value.set("world");
		expect(input.value).toBe("world");
	});

	test("bindChildren keeps children in order when they're rearranged", () => {
		const parent = document.createElement("div");
		const [a, b, c] = ["a", "b", "c"].map((id) => Object.assign(document.createElement("span"), { id }));
		const children = cjs([a, b, c]);
		cjs.bindChildren(parent, children);
		const ids = () => Array.from(parent.children, (child) => child.id).join("");
		expect(ids()).toBe("abc");
		children.setValue([c, a, b]);
		expect(ids()).toBe("cab");
		children.setValue([b, c]);
		expect(ids()).toBe("bc");
		children.setValue([c, a, b]);
		expect(ids()).toBe("cab");
		expect(parent.children[0]).toBe(c);
	});

	test("bindChildren keeps the element's existing children after the bound ones", () => {
		const parent = document.createElement("div");
		const existing = document.createElement("hr");
		parent.append(existing);
		const [a, b] = [document.createElement("i"), document.createElement("b")];
		const children = cjs([a]);
		cjs.bindChildren(parent, children);
		expect(Array.from(parent.childNodes)).toEqual([a, existing]);
		children.setValue([b, a]);
		expect(Array.from(parent.childNodes)).toEqual([b, a, existing]);
		children.setValue([]);
		expect(Array.from(parent.childNodes)).toEqual([existing]);
	});

	test("bindAttr removes attributes that are no longer given", () => {
		const element = document.createElement("div");
		const attributes = cjs<unknown>({ title: "hello", "data-x": "1" });
		cjs.bindAttr(element, attributes);
		expect(element.getAttribute("title")).toBe("hello");
		attributes.remove("data-x");
		expect(element.hasAttribute("data-x")).toBe(false);
		attributes.put("title", null);
		expect(element.hasAttribute("title")).toBe(false);
		attributes.put("hidden", false);
		expect(element.hasAttribute("hidden")).toBe(false);
		attributes.put("hidden", true);
		expect(element.hasAttribute("hidden")).toBe(true);
	});

	test("bindCSS removes styles that are no longer given, and supports custom properties", () => {
		const element = document.createElement("div");
		const styles = cjs<unknown>({ color: "red", "--size": "2px" });
		cjs.bindCSS(element, styles);
		expect(element.style.color).toBe("red");
		expect(element.style.getPropertyValue("--size")).toBe("2px");
		styles.remove("color");
		styles.remove("--size");
		expect(element.style.color).toBe("");
		expect(element.style.getPropertyValue("--size")).toBe("");
	});

	test("bindClass splits space-separated class names", () => {
		const element = document.createElement("div");
		element.className = "existing";
		const classes = cjs("a b");
		cjs.bindClass(element, classes, ["c", "c"]);
		expect(element.className).toBe("existing a b c");
		classes.set("b d");
		expect(element.className).toBe("existing b c d");
		classes.set(undefined as unknown as string);
		expect(element.className).toBe("existing c");
	});

	describe("throttling", () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		test("a destroyed binding doesn't update later", () => {
			vi.useFakeTimers();
			const element = document.createElement("div");
			const text = cjs("a");
			const binding = cjs.bindText(element, text).throttle(50);
			text.set("b");
			binding.destroy();
			vi.advanceTimersByTime(100);
			expect(element.textContent).toBe("a");
		});

		test("turning throttling off applies the pending update", () => {
			vi.useFakeTimers();
			const element = document.createElement("div");
			const text = cjs("a");
			const binding = cjs.bindText(element, text).throttle(50);
			text.set("b");
			expect(element.textContent).toBe("a");
			binding.throttle(0);
			expect(element.textContent).toBe("b");
		});
	});

	test("destroying an input value constraint silently leaves dependents alone", () => {
		const input = document.createElement("input");
		const value = cjs.inputValue(input);
		const dependent = cjs(() => value.get());
		dependent.get();
		value.destroy(true);
		expect(dependent.isValid()).toBe(true);
	});
});
