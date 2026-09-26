// Ported from the old QUnit suite (test/unit_tests/template_test.js). Each test keeps, via `expect.assertions(n)`,
// the assertion count that the old `dt(name, n, fn)` wrapper declared. The wrapper's extra memory-leak check
// (which needed an obsolete Chrome extension) was dropped, along with `x = null` assignments that only served it.
import { describe, expect, test, vi } from "vitest";
import cjs from "../src/index";
import { getTextContent, hasAttr } from "./helpers";

describe("Templates", () => {
	test("Static Templates", () => {
		expect.assertions(7);
		const empty_template = cjs.createTemplate("", {});
		expect(getTextContent(empty_template)).toBe("");
		cjs.destroyTemplate(empty_template);

		const hello_template = cjs.createTemplate("hello world", {});
		expect(getTextContent(hello_template)).toBe("hello world");
		cjs.destroyTemplate(hello_template);

		const div_template: any = cjs.createTemplate("<div>hi</div>", {});
		expect(div_template.tagName.toLowerCase()).toBe("div");
		expect(getTextContent(div_template)).toBe("hi");
		cjs.destroyTemplate(div_template);

		const nested_div_template: any = cjs.createTemplate("<div>hi <strong>world</strong></div>", {});
		expect(nested_div_template.tagName.toLowerCase()).toBe("div");
		const strong_content = nested_div_template.getElementsByTagName("strong")[0];
		expect(getTextContent(strong_content)).toBe("world");
		cjs.destroyTemplate(nested_div_template);

		const classed_template: any = cjs.createTemplate("<div class='my_class'>yo</div>", {});
		expect(classed_template.className || classed_template["class"]).toBe("my_class");
		cjs.destroyTemplate(classed_template);
	});

	test("Dynamic Templates", () => {
		expect.assertions(5);
		const t1 = cjs.createTemplate("{{x}}", { x: "hello world" });
		expect(getTextContent(t1)).toBe("hello world");
		cjs.destroyTemplate(t1);

		const greet = cjs("hello");
		const city = cjs("pittsburgh");
		const tlate = document.createElement("div");
		tlate.setAttribute("type", "cjs/template");
		tlate.innerText = tlate.textContent = "{{greeting}}, {{city}}";
		const t2 = cjs.createTemplate(tlate, { greeting: greet, city: city });
		expect(getTextContent(t2)).toBe("hello, pittsburgh");
		greet.set("bye");
		expect(getTextContent(t2)).toBe("bye, pittsburgh");
		city.set("world");
		expect(getTextContent(t2)).toBe("bye, world");
		cjs.destroyTemplate(t2);
		greet.destroy();
		city.destroy();

		const create_template_fn = cjs.createTemplate("{{x}}");
		const template_instance = create_template_fn({ x: 1 });
		expect(getTextContent(template_instance)).toBe("1");
		cjs.destroyTemplate(template_instance);
	});

	test("HTMLized Templates", () => {
		expect.assertions(10);
		const x = cjs("X"),
			y = cjs("Y");
		const t1: any = cjs.createTemplate("{{{x}}}, {{y}}", { x: x, y: y });
		expect(getTextContent(t1)).toBe("X, Y");
		x.set("<strong>X</strong>");
		let strong_content = t1.getElementsByTagName("strong")[0];
		expect(getTextContent(t1)).toBe("X, Y");
		expect(getTextContent(strong_content)).toBe("X");
		y.set("<b>Y</b>");
		expect(getTextContent(t1)).toBe("X, <b>Y</b>");

		const t2: any = cjs.createTemplate("<div>{{{x}}}, {{y}}</div>", { x: x, y: y });
		expect(getTextContent(t2)).toBe("X, <b>Y</b>");
		strong_content = t2.getElementsByTagName("strong")[0];
		expect(getTextContent(strong_content)).toBe("X");
		expect(t2.tagName.toLowerCase()).toBe("div");

		const t3: any = cjs.createTemplate("<div>something<span>{{{x}}}</span></div>", { x: x });
		expect(getTextContent(t3)).toBe("somethingX");
		strong_content = t3.getElementsByTagName("span")[0];
		expect(getTextContent(strong_content)).toBe("X");
		expect(t3.tagName.toLowerCase()).toBe("div");

		cjs.destroyTemplate(t1);
		cjs.destroyTemplate(t2);
		cjs.destroyTemplate(t3);
	});

	test("Attributes", () => {
		expect.assertions(4);
		const the_class = cjs("class1");
		const t1: any = cjs.createTemplate("<span class={{x}}>yo</span>", { x: the_class });

		expect(t1.className).toBe("class1");
		the_class.set("classX");
		expect(t1.className).toBe("classX");

		const second_class = cjs("class2");
		const t2: any = cjs.createTemplate("<span class='{{x}} {{y}} another_class'>yo</span>", {
			x: the_class,
			y: second_class,
		});
		expect(t2.className).toBe("classX class2 another_class");
		second_class.set("classY");
		expect(t2.className).toBe("classX another_class classY");

		cjs.destroyTemplate(t1);
		cjs.destroyTemplate(t2);
		the_class.destroy();
		second_class.destroy();
	});

	test("Each", () => {
		expect.assertions(3);
		const elems = cjs([1, 2, 3]);
		const t1: any = cjs.createTemplate("<div>" + "{{#each elems}}" + "<span>{{this}}</span>" + "{{/each}}" + "</div>", {
			elems: elems,
		});
		expect(t1.childNodes.length).toBe(3);
		const elem0 = t1.childNodes[0];
		elems.push(4);
		expect(t1.childNodes.length).toBe(4);
		expect(elem0).toBe(t1.childNodes[0]);

		cjs.destroyTemplate(t1);
		elems.destroy();
	});

	test("Conditionals", () => {
		expect.assertions(21);
		const cond = cjs(true);
		let t1 = cjs.createTemplate("<div>" + "{{#if cond}}" + "1" + "{{#else}}" + "2" + "{{/if}}" + "</div>", {
			cond: cond,
		});
		expect(getTextContent(t1)).toBe("1");
		cond.set(false);
		expect(getTextContent(t1)).toBe("2");
		cond.set(true);
		expect(getTextContent(t1)).toBe("1");

		cjs.destroyTemplate(t1);
		const cond2 = cjs(true);
		t1 = cjs.createTemplate("<div>" + "{{#if cond}}" + "1" + "{{#elif cond2}}" + "2" + "{{/if}}" + "</div>", {
			cond: cond,
			cond2: cond2,
		});
		expect(getTextContent(t1)).toBe("1");
		cond.set(false);
		expect(getTextContent(t1)).toBe("2");
		cond.set(true);
		expect(getTextContent(t1)).toBe("1");
		cond2.set(true);
		expect(getTextContent(t1)).toBe("1");
		cond.set(false);
		expect(getTextContent(t1)).toBe("2");
		cond2.set(false);
		expect(getTextContent(t1)).toBe("");
		cond2.set(true);
		expect(getTextContent(t1)).toBe("2");
		cond.set(true);
		expect(getTextContent(t1)).toBe("1");

		const t2: any = cjs.createTemplate(
			"<div>" +
				"{{#if cond}}" +
				"<span>A</span>" +
				"{{#elif cond2}}" +
				"<span>B</span>" +
				"{{#else}}" +
				"<span>C</span>" +
				"{{/if}}" +
				"</div>",
			{ cond: cond, cond2: cond2 },
		);
		const cna1 = t2.childNodes[0];
		expect(getTextContent(cna1)).toBe("A");
		cond.set(false);
		const cnb1 = t2.childNodes[0];
		expect(getTextContent(cnb1)).toBe("B");
		cond.set(true);
		const cna2 = t2.childNodes[0];
		expect(getTextContent(cna2)).toBe("A");
		cond.set(false);
		const cnb2 = t2.childNodes[0];
		expect(getTextContent(cnb2)).toBe("B");
		expect(cna1).toBe(cna2);
		expect(cnb1).toBe(cnb2);
		cond2.set(false);
		const cnc2 = t2.childNodes[0];
		expect(getTextContent(cnc2)).toBe("C");

		const cond3 = cjs(true);
		const t3 = cjs.createTemplate("<div>" + "{{#unless cond}}" + "1" + "{{/unless}}" + "</div>", { cond: cond3 });
		expect(getTextContent(t3)).toBe("");
		cond3.set(false);
		expect(getTextContent(t3)).toBe("1");
		cond3.set(true);
		expect(getTextContent(t3)).toBe("");

		cjs.destroyTemplate(t1);
		cjs.destroyTemplate(t2);
		cjs.destroyTemplate(t3);
		cond.destroy();
		cond2.destroy();
		cond3.destroy();
	});

	test("FSM", () => {
		expect.assertions(3);
		const my_fsm = cjs.fsm("s1", "s2").startsAt("s1");
		const s1s2 = my_fsm.addTransition("s1", "s2");
		const s2s1 = my_fsm.addTransition("s2", "s1");
		const t1 = cjs.createTemplate(
			"<div>" + "{{#fsm my_fsm}}" + "{{#state s1}}" + "1" + "{{#state s2}}" + "2" + "{{/fsm}}" + "</div>",
			{ my_fsm: my_fsm },
		);
		expect(getTextContent(t1)).toBe("1");
		s1s2();
		expect(getTextContent(t1)).toBe("2");
		s2s1();
		expect(getTextContent(t1)).toBe("1");

		cjs.destroyTemplate(t1);
		my_fsm.destroy();
	});

	test("Provided Parent", () => {
		expect.assertions(4);
		const elem = document.createElement("div");
		const x = cjs(1);
		const template = cjs.createTemplate("{{this}}", x, elem);
		expect(template).toBe(elem);
		expect(getTextContent(template)).toBe("1");
		x.set(2);
		expect(getTextContent(template)).toBe("2");
		expect(template).toBe(elem);

		x.destroy();
		cjs.destroyTemplate(template);
	});

	test("FN Calls", () => {
		expect.assertions(2);
		const abc: any = cjs.createTemplate("{{#each x}}{{plus_one(this)}}{{/each}}", {
			x: [1, 2, 3],
			plus_one: function (x: number) {
				return x + 1;
			},
		});
		expect(abc.childNodes.length).toBe(3);
		expect(getTextContent(abc)).toBe("234");

		cjs.destroyTemplate(abc);
	});

	test("Nested Templates", () => {
		const hi_template = cjs.createTemplate("Hello, {{this}}");
		cjs.registerPartial("hello", hi_template);
		const abc: any = cjs.createTemplate("{{> hello this}}", "world");
		expect(abc.childNodes.length).toBe(1);
		expect(getTextContent(abc)).toBe("Hello, world");

		// Pausing and resuming the outer template reaches the nested one
		cjs.registerPartial("hello_name", cjs.createTemplate("Hello, {{name}}"));
		const name = cjs("world");
		const def: any = cjs.createTemplate("{{> hello_name person}}", { person: { name } });
		expect(getTextContent(def)).toBe("Hello, world");
		cjs.pauseTemplate(def);
		name.set("there");
		expect(getTextContent(def)).toBe("Hello, world");
		cjs.resumeTemplate(def);
		expect(getTextContent(def)).toBe("Hello, there");

		cjs.destroyTemplate(abc);
		cjs.destroyTemplate(def);
		cjs.unregisterPartial("hello");
		cjs.unregisterPartial("hello_name");
	});

	// `createNode` asserts on its argument. Assertions that run inside library callbacks use `expect.soft`,
	// which records a failure without throwing, like QUnit's `equal`. A throwing `expect` would either unwind
	// through the library's listener loop (in the original, with `cjs.__debug` on, that leaves the solver's
	// `running_listeners` flag stuck so later tests in this file break too) or be swallowed by it (with
	// `__debug` off the original only logs listener errors) while still counting towards expect.assertions().
	// expect.assertions(8) also checks that `createNode` is called exactly once.
	test("Custom Partials", () => {
		expect.assertions(8);
		let add_count = 0,
			remove_count = 0,
			destroy_count = 0;
		const a = cjs(1);

		cjs.registerCustomPartial("my_custom_partial", {
			createNode: function (arg: any) {
				expect.soft(arg).toBe(a.get());
				return document.createElement("span");
			},
			onAdd: function () {
				add_count++;
			},
			onRemove: function () {
				remove_count++;
			},
			destroyNode: function () {
				destroy_count++;
			},
		});
		const is_showing = cjs(true);
		const my_template = cjs.createTemplate("{{#if is_showing}}" + "{{> my_custom_partial a}}" + "{{/if}}", {
			is_showing: is_showing,
			a: a,
		});
		expect(add_count).toBe(1);
		expect(remove_count).toBe(0);
		is_showing.set(false);
		expect(add_count).toBe(1);
		expect(remove_count).toBe(1);
		a.set(2);
		is_showing.set(true);
		expect(add_count).toBe(2);
		expect(remove_count).toBe(1);

		cjs.destroyTemplate(my_template);
		is_showing.destroy();
		a.destroy();
		cjs.unregisterPartial("my_custom_partial");
		expect(destroy_count).toBe(1);
	});

	test("Template Comments", () => {
		expect.assertions(2);
		const tmplate: any = cjs.createTemplate(
			"{{! comment 1 }}{{!comment2}}{{#each num}}<!--some html comment-->{{/each}}",
			{ num: [1, 2, 3] },
		);
		expect(tmplate.childNodes.length).toBe(3);
		expect(tmplate.childNodes[0].nodeType).toBe(8);
		cjs.destroyTemplate(tmplate);
	});

	test("With", () => {
		expect.assertions(1);
		const tmplate = cjs.createTemplate("{{#with x}}{{a}}{{b}}{{../y}}{{/with}}", { x: { a: "a", b: "b" }, y: "y" });
		expect(getTextContent(tmplate)).toBe("aby");
		cjs.destroyTemplate(tmplate);
	});

	test("Each/Else", () => {
		expect.assertions(5);
		const x = cjs([1, 2]);
		const tmplate = cjs.createTemplate("{{#each x}}{{this}}{{#else}}nothing{{/each}}", { x: x });
		expect(getTextContent(tmplate)).toBe("12");
		x.splice(0, 1);
		expect(getTextContent(tmplate)).toBe("2");
		x.splice(0, 1);
		expect(getTextContent(tmplate)).toBe("nothing");
		x.splice(0, 0, 2, 3);
		expect(getTextContent(tmplate)).toBe("23");
		x.splice(0, 2);
		expect(getTextContent(tmplate)).toBe("nothing");
		cjs.destroyTemplate(tmplate);

		x.destroy();
	});

	test("Parser test", () => {
		expect.assertions(1);
		const tmplate = cjs.createTemplate("{{'{}'}}{{\"}{\"}}", {});
		expect(getTextContent(tmplate)).toBe("{}}{");
		cjs.destroyTemplate(tmplate);
	});

	// `func` asserts on its arguments; see "Custom Partials" for why `expect.soft` is used there.
	test("Each key/index", () => {
		expect.assertions(6);
		const arr = cjs(["a", "b"]);
		const obj = cjs({ x: "x_val", y: "y_val" });
		let tmplate = cjs.createTemplate("{{#each arr}}{{@index}}{{/each}}", { arr: arr });
		expect(getTextContent(tmplate)).toBe("01");
		arr.splice(0, 1);
		expect(getTextContent(tmplate)).toBe("0");
		cjs.destroyTemplate(tmplate);

		cjs.destroyTemplate(tmplate);
		tmplate = cjs.createTemplate("{{#each obj}}{{@key}}{{/each}}", { obj: obj });
		expect(getTextContent(tmplate)).toBe("xy");

		const key1 = {},
			key2 = {};
		const dynamic_map = cjs.map({
			keys: [key1, key2],
			values: [1, 2],
		});
		const func = function (key: any, val: any) {
			expect.soft(dynamic_map.get(key)).toBe(val);
			return val;
		};
		cjs.destroyTemplate(tmplate);

		tmplate = cjs.createTemplate("{{#each obj}}{{ this }}{{ func(@key, this) }}{{/each}}", {
			obj: dynamic_map,
			func: func,
		});
		expect(getTextContent(tmplate)).toBe("1122");
		cjs.destroyTemplate(tmplate);
		dynamic_map.destroy();
		arr.destroy();
		obj.destroy();
	});

	test("Template out", () => {
		expect.assertions(2);
		const context: any = {};
		const tmplate: any = cjs.createTemplate("<input type='text' data-cjs-out='x' />", context);
		expect(context.x.get()).toBe("");
		tmplate.value = "hello";
		context.x.invalidate();
		expect(context.x.get()).toBe("hello");
		cjs.destroyTemplate(tmplate);
	});

	test("Pause/Resume/Destroy templates", () => {
		expect.assertions(7);
		const x = cjs(1);
		const tmplate = cjs.createTemplate("{{x}}", { x: x });
		expect(getTextContent(tmplate)).toBe("1");
		x.set(2);
		expect(getTextContent(tmplate)).toBe("2");
		cjs.pauseTemplate(tmplate);
		expect(getTextContent(tmplate)).toBe("2");
		x.set(3);
		cjs.resumeTemplate(tmplate);
		expect(getTextContent(tmplate)).toBe("3");
		x.set(4);
		expect(getTextContent(tmplate)).toBe("4");
		cjs.destroyTemplate(tmplate);
		expect(getTextContent(tmplate)).toBe("4");
		x.set(5);
		expect(getTextContent(tmplate)).toBe("4");
		cjs.destroyTemplate(tmplate);
		x.destroy();
	});

	test("Condition/State Combo", () => {
		expect.assertions(7);
		const cond = cjs(false),
			fsm = cjs.fsm("state1", "state2").startsAt("state1");
		const onetwo = fsm.addTransition("state1", "state2"),
			twoone = fsm.addTransition("state2", "state1");
		const tmplate = cjs.createTemplate(
			"{{#fsm my_fsm}}" +
				"{{#state state1}}" +
				"{{#if cond}}" +
				"A" +
				"{{/if}}" +
				"{{#state state2}}" +
				"{{#unless cond}}" +
				"B" +
				"{{/unless}}" +
				"{{/fsm}}",
			{
				cond: cond,
				my_fsm: fsm,
			},
		);

		expect(getTextContent(tmplate)).toBe("");
		cond.set(true);
		expect(getTextContent(tmplate)).toBe("A");
		onetwo();
		expect(getTextContent(tmplate)).toBe("");
		cond.set(false);
		expect(getTextContent(tmplate)).toBe("B");
		cond.set(true);
		expect(getTextContent(tmplate)).toBe("");
		twoone();
		expect(getTextContent(tmplate)).toBe("A");
		cond.set(false);
		expect(getTextContent(tmplate)).toBe("");

		cjs.destroyTemplate(tmplate);
		fsm.destroy();
		cond.destroy();
	});

	test("If within else", () => {
		expect.assertions(7);
		const arr = cjs([] as string[]),
			cond = cjs(false);

		const tmplate = cjs.createTemplate(
			"{{#each arr}}" + "{{@index}}" + "{{#else}}" + "{{#if cond}}" + "nothing" + "{{/if}}" + "{{/each}}",
			{
				arr: arr,
				cond: cond,
			},
		);
		expect(getTextContent(tmplate)).toBe("");
		cond.set(true);
		expect(getTextContent(tmplate)).toBe("nothing");
		arr.push("a");
		expect(getTextContent(tmplate)).toBe("0");
		cond.set(false);
		expect(getTextContent(tmplate)).toBe("0");
		cond.set(true);
		expect(getTextContent(tmplate)).toBe("0");
		arr.splice(0, 1);
		expect(getTextContent(tmplate)).toBe("nothing");
		cond.set(false);
		expect(getTextContent(tmplate)).toBe("");

		cjs.destroyTemplate(tmplate);
		arr.destroy();
		cond.destroy();
	});

	test("Ternary", () => {
		expect.assertions(5);
		const cond = cjs(false);

		const tmplate = cjs.createTemplate("{{cond ? 'a'+'b' : 'b'+'c'}}", {
			cond: cond,
		});
		expect(getTextContent(tmplate)).toBe("bc");
		cond.set(true);
		expect(getTextContent(tmplate)).toBe("ab");
		cond.set(false);
		expect(getTextContent(tmplate)).toBe("bc");
		cond.set(false);
		expect(getTextContent(tmplate)).toBe("bc");
		cond.set(true);
		expect(getTextContent(tmplate)).toBe("ab");

		cjs.destroyTemplate(tmplate);
		cond.destroy();
	});

	// Both custom partials assert on their arguments; see "Custom Partials" for why `expect.soft` is used
	// there. expect.assertions(19) also checks how many times each `createNode` runs (3 times each).
	test("Templateducken", () => {
		expect.assertions(19);
		let sub_destroy_count = 0,
			destroy_count = 0;
		cjs.registerCustomPartial("my_custom_sub_template", {
			createNode: function (x: number, y: number) {
				const node = document.createElement("span");
				expect.soft(x, "x is 3").toBe(3);
				expect.soft(y, "y is 13").toBe(13);
				node.textContent = node.innerText = String(x + y);
				return node;
			},
			destroyNode: function () {
				sub_destroy_count++;
			},
		});
		const custom_template_content = cjs.createTemplate("{{>my_custom_sub_template x+2 y+2}}");
		cjs.registerCustomPartial("my_custom_template", {
			createNode: function (x: number, y: number) {
				const node = document.createElement("span");
				custom_template_content({ x: x, y: y }, node);
				expect.soft(x, "x is 1").toBe(1);
				expect.soft(y, "y is 11").toBe(11);
				return node;
			},
			destroyNode: function (node: any) {
				destroy_count++;
				cjs.destroyTemplate(node);
			},
		});
		const arr = cjs([1, 2] as any[]);
		const cond = cjs(true);
		const ct2 = cjs.createTemplate("{{#if cond}}{{#each arr}}{{>my_custom_template x+1 y+1}}{{/each}}{{/if}}", {
			x: 0,
			y: 10,
			arr: arr,
			cond: cond,
		});

		expect(getTextContent(ct2), "textContent right").toBe("1616");
		cond.set(false);
		expect(getTextContent(ct2), "textContent right").toBe("");
		cond.set(true);
		expect(getTextContent(ct2), "textContent right").toBe("1616");
		arr.splice(0, 1);
		expect(destroy_count, "proper destroy count").toBe(1);
		expect(sub_destroy_count, "proper subdestroy count").toBe(1);
		arr.splice(0, 0, "x");
		cjs.destroyTemplate(ct2);
		expect(destroy_count, "proper destroy count").toBe(3);
		expect(sub_destroy_count, "proper subdestroy count").toBe(3);

		cjs.destroyTemplate(ct2);
		cond.destroy();
		arr.destroy();
		cjs.unregisterPartial("my_custom_template");
		cjs.unregisterPartial("my_custom_sub_template");
	});

	test("Dyn Class", () => {
		expect.assertions(5);
		const is_active = cjs(false);
		const tlate: any = cjs.createTemplate('<div class=\'class1 {class2 {{is_active ? "active" : ""}}\'>hi!</div>', {
			is_active: is_active,
		});
		expect(getTextContent(tlate)).toBe("hi!");
		expect(tlate.className || tlate["class"]).toBe("class1 {class2");
		is_active.set(true);
		expect(tlate.className || tlate["class"]).toBe("class1 {class2 active");
		is_active.set(false);
		expect(tlate.className || tlate["class"]).toBe("class1 {class2");
		expect(getTextContent(tlate)).toBe("hi!");

		cjs.destroyTemplate(tlate);
		is_active.destroy();
	});

	test("Fill Attribute", () => {
		expect.assertions(5);
		const is_disabled = cjs(false);
		const tlate = cjs.createTemplate("<button disabled={{is_disabled}}>my_button</button>", {
			is_disabled: is_disabled,
		});
		expect(hasAttr(tlate, "disabled")).toBe(false);
		is_disabled.set(true);
		expect(hasAttr(tlate, "disabled")).toBe(true);
		is_disabled.set(false);
		expect(hasAttr(tlate, "disabled")).toBe(false);
		is_disabled.set(true);
		expect(hasAttr(tlate, "disabled")).toBe(true);
		is_disabled.set(false);
		expect(hasAttr(tlate, "disabled")).toBe(false);

		cjs.destroyTemplate(tlate);
		is_disabled.destroy();
	});
});

const render = (template: string, context: unknown): HTMLElement =>
	cjs.createTemplate(template, context) as HTMLElement;

describe("Templates: regression tests", () => {
	test("{{#each}} handles items being rearranged, and reuses their nodes", () => {
		const items = cjs(["a", "b", "c"]);
		const element = render("<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>", { items });
		const texts = () => Array.from(element.children, (child) => child.textContent).join("");
		const [a, b, c] = Array.from(element.children);
		items.setValue(["c", "a", "b"]);
		expect(texts()).toBe("cab");
		expect(Array.from(element.children)).toEqual([c, a, b]);
		items.setValue(["b", "c", "a"]);
		expect(texts()).toBe("bca");
		cjs.destroyTemplate(element);
	});

	test("{{@index}} stays correct as items are removed", () => {
		const items = cjs(["a", "b", "c"]);
		const element = render("{{#each items}}{{@index}}{{/each}}", { items });
		expect(element.textContent).toBe("012");
		items.shift();
		expect(element.textContent).toBe("01");
		items.shift();
		expect(element.textContent).toBe("0");
		cjs.destroyTemplate(element);
	});

	test("a template keeps updating after an expression throws", () => {
		const user = cjs.constraint<{ name: string } | null>({ name: "Ann" });
		const element = render("<p>{{fmt(user)}}</p>", { user, fmt: (u: { name: string }) => u.name.toUpperCase() });
		expect(element.textContent).toBe("ANN");
		expect(() => user.set(null)).toThrow(TypeError);
		user.set({ name: "Bob" });
		expect(element.textContent).toBe("BOB");
		cjs.destroyTemplate(element);
	});

	test("rendering into a parent keeps the parent's existing children", () => {
		const parent = document.createElement("div");
		parent.innerHTML = "<p>existing</p>";
		const x = cjs("hi");
		const result = cjs.createTemplate("<b>{{x}}</b>", { x }, parent);
		expect(result).toBe(parent);
		expect(parent.innerHTML).toBe("<b>hi</b><p>existing</p>");
		x.set("there");
		expect(parent.innerHTML).toBe("<b>there</b><p>existing</p>");
		cjs.destroyTemplate(parent);
	});

	test("pausing a template pauses its attribute bindings", () => {
		const title = cjs("a");
		const element = render("<div title={{title}}>x</div>", { title });
		cjs.pauseTemplate(element);
		title.set("b");
		expect(element.title).toBe("a");
		cjs.resumeTemplate(element);
		expect(element.title).toBe("b");
		cjs.destroyTemplate(element);
		title.set("c");
		expect(element.title).toBe("b");
	});

	test("{{#with}} updates the blocks inside it", () => {
		const show = cjs(false);
		const element = render("{{#with obj}}{{#if show}}yes{{#else}}no{{/if}}{{/with}}", { obj: { show } });
		expect(element.textContent).toBe("no");
		show.set(true);
		expect(element.textContent).toBe("yes");
		cjs.destroyTemplate(element);
	});

	test("{{#with}} renders again when its value changes", () => {
		const obj = cjs.constraint({ name: "a" });
		const element = render("{{#with obj}}{{name}}{{/with}}", { obj });
		expect(element.textContent).toBe("a");
		obj.set({ name: "b" });
		expect(element.textContent).toBe("b");
		cjs.destroyTemplate(element);
	});

	test("destroying a template cleans up every state of an {{#fsm}}", () => {
		const destroyed = vi.fn();
		cjs.registerCustomPartial("counted", {
			createNode: () => document.createElement("span"),
			destroyNode: destroyed,
		});
		const fsm = cjs.fsm("a", "b");
		const toB = fsm.addTransition("a", "b");
		const element = render("{{#fsm fsm}}{{#state a}}{{>counted}}{{#state b}}{{>counted}}{{/fsm}}", { fsm });
		toB();
		cjs.destroyTemplate(element);
		expect(destroyed).toHaveBeenCalledTimes(2);
		cjs.unregisterPartial("counted");
		fsm.destroy();
	});

	test("{{{html}}} works next to elements, which keep their bindings", () => {
		const html = cjs("<i>1</i>");
		const text = cjs("x");
		const element = render("<div>{{{html}}}<b>{{text}}</b></div>", { html, text });
		expect(element.innerHTML).toBe("<i>1</i><b>x</b>");
		text.set("y");
		expect(element.innerHTML).toBe("<i>1</i><b>y</b>");
		html.set("<u>2</u>");
		expect(element.innerHTML).toBe("<u>2</u><b>y</b>");
		cjs.destroyTemplate(element);
	});

	test("{{{html}}} works inside blocks", () => {
		const show = cjs(true);
		const element = render("<div>{{#if show}}{{{html}}}{{/if}}</div>", { show, html: "<b>hi</b>" });
		expect(element.innerHTML).toBe("<b>hi</b>");
		show.set(false);
		expect(element.innerHTML).toBe("");
		cjs.destroyTemplate(element);
	});

	test("class attributes can have non-string values", () => {
		const cls = cjs<unknown>(undefined);
		const element = render("<div class={{cls}}></div>", { cls });
		expect(element.className).toBe("");
		cls.set(42);
		expect(element.className).toBe("42");
		cjs.destroyTemplate(element);
	});

	test("properties that are constraints are unwrapped", () => {
		const obj = { x: cjs(1), flag: cjs(false) };
		const element = render("{{obj.x}} {{#if false}}a{{#elif obj.flag}}b{{#else}}c{{/if}}", { obj });
		expect(element.textContent).toBe("1 c");
		obj.x.set(2);
		obj.flag.set(true);
		expect(element.textContent).toBe("2 b");
		cjs.destroyTemplate(element);
	});

	test("a < that doesn't start a tag is text", () => {
		const element = render("<p>1 < 2</p>", {});
		expect(element.textContent).toBe("1 < 2");
	});

	test("an unclosed {{ is reported quickly, even after many strings", () => {
		const start = performance.now();
		expect(() => cjs.createTemplate("{{" + '"a" '.repeat(40))).toThrow("Unclosed {{");
		expect(performance.now() - start).toBeLessThan(1000);
	});

	test("unknown block helpers are reported", () => {
		expect(() => cjs.createTemplate("{{#nope x}}{{/nope}}")).toThrow("Unknown block helper");
	});

	test("{{#each}} shows {{#else}} for empty objects and maps", () => {
		const map = cjs({});
		const element = render("{{#each map}}{{@key}}{{#else}}empty{{/each}}", { map });
		expect(element.textContent).toBe("empty");
		map.put("a", 1);
		expect(element.textContent).toBe("a");
		cjs.destroyTemplate(element);
		expect(render("{{#each obj}}x{{#else}}empty{{/each}}", { obj: {} }).textContent).toBe("empty");
	});

	test("{{#each}} over an object with a `length` property uses its keys", () => {
		const element = render("{{#each obj}}{{@key}}={{this}};{{/each}}", { obj: { length: 2, x: 1 } });
		expect(element.textContent).toBe("length=2;x=1;");
	});

	test("{{#unless}} can have an {{#else}}", () => {
		const cond = cjs(true);
		const element = render("{{#unless cond}}a{{#else}}b{{/unless}}", { cond });
		expect(element.textContent).toBe("b");
		cond.set(false);
		expect(element.textContent).toBe("a");
		cjs.destroyTemplate(element);
	});

	test("data-cjs-out works with a map constraint context", () => {
		const context = cjs<unknown>({});
		render("<input data-cjs-out=name />", context);
		expect(cjs.isConstraint(context.get("name"))).toBe(true);
	});

	test("data-cjs-on listeners are removed when the template is destroyed", () => {
		const onClick = vi.fn();
		const element = render("<button data-cjs-on-click=onClick>go</button>", { onClick });
		element.click();
		expect(onClick).toHaveBeenCalledTimes(1);
		cjs.destroyTemplate(element);
		element.click();
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	test("undefined values render as empty text", () => {
		const element = render("<p>[{{missing}}]</p>", {});
		expect(element.textContent).toBe("[]");
	});

	test("partials can be registered as template strings", () => {
		cjs.registerPartial("greeting", "Hi, {{this}}!");
		const element = render("{{>greeting name}}", { name: "Ada" });
		expect(element.textContent).toBe("Hi, Ada!");
		cjs.unregisterPartial("greeting");
	});

	test("expressions can span several lines", () => {
		const element = render("{{a +\n b}}", { a: 1, b: 2 });
		expect(element.textContent).toBe("3");
	});
});

describe("Parsed Constraints: regression tests", () => {
	test("`this`, ./, and member access work", () => {
		const context = { a: { b: cjs(1) }, c: 2 };
		expect(cjs.createParsedConstraint("this.c + ./c", context).get()).toBe(4);
		expect(cjs.createParsedConstraint("a.b + 1", context).get()).toBe(2);
	});

	test("string escapes", () => {
		expect(cjs.createParsedConstraint(String.raw`'it\'s'`, {}).get()).toBe("it's");
		expect(cjs.createParsedConstraint(String.raw`"a\\b"`, {}).get()).toBe("a\\b");
		expect(cjs.createParsedConstraint(String.raw`"\x41B\n"`, {}).get()).toBe("AB\n");
	});

	test("array literals", () => {
		expect(cjs.createParsedConstraint("[1, 2][1]", {}).get()).toBe(2);
		expect(cjs.createParsedConstraint("[a, 2]", { a: cjs(1) }).get()).toEqual([1, 2]);
	});

	test("&& and || short-circuit", () => {
		const go = vi.fn(() => 1);
		expect(cjs.createParsedConstraint("ready && go()", { ready: false, go }).get()).toBe(false);
		expect(cjs.createParsedConstraint("ready || go()", { ready: true, go }).get()).toBe(true);
		expect(go).not.toHaveBeenCalled();
	});

	test("the expression itself can be a constraint", () => {
		const expression = cjs("a + 1");
		const parsed = cjs.createParsedConstraint(expression, { a: 1 });
		expect(parsed.get()).toBe(2);
		expression.set("a * 10");
		expect(parsed.get()).toBe(10);
	});

	test("syntax errors are logged and produce undefined", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(cjs.createParsedConstraint("1 +", {}).get()).toBe(undefined);
		expect(error).toHaveBeenCalledTimes(1);
		error.mockRestore();
	});
});

describe("Expressions", () => {
	const evaluate = (expression: string, context: object = {}) => cjs.createParsedConstraint(expression, context).get();

	test("operator precedence and associativity", () => {
		expect(evaluate("1 + 2 * 3")).toBe(7);
		expect(evaluate("2 * 3 + 1")).toBe(7);
		expect(evaluate("10 - 3 - 2")).toBe(5);
		expect(evaluate("2 * (3 + 4)")).toBe(14);
		expect(evaluate("1 + 2 === 3 && 4 > 3")).toBe(true);
		expect(evaluate("false || 1 && 2")).toBe(2);
		expect(evaluate("1 << 2 + 1")).toBe(8);
		expect(evaluate("7 & 3 | 8")).toBe(11);
		expect(evaluate("-2 * -3")).toBe(6);
		expect(evaluate("!0 === true")).toBe(true);
		expect(evaluate("a ? b ? 1 : 2 : 3", { a: true, b: false })).toBe(2);
	});

	test("literals", () => {
		expect(evaluate("1.5e2")).toBe(150);
		expect(evaluate(".5")).toBe(0.5);
		expect(evaluate("'single' + \"double\"")).toBe("singledouble");
		expect(evaluate("[true, false, null]")).toEqual([true, false, null]);
	});

	test("property access and calls", () => {
		const context = { obj: { list: [10, 20], key: "list", add: (a: number, b: number) => a + b }, name: "Ada" };
		expect(evaluate("obj.list[1]", context)).toBe(20);
		expect(evaluate("obj[obj.key][0]", context)).toBe(10);
		expect(evaluate("obj.add(1, obj.list[0])", context)).toBe(11);
		expect(evaluate("name.toUpperCase().length", context)).toBe(3);
		expect(evaluate("(name + '!').length", context)).toBe(4);
		expect(evaluate("missing.property", context)).toBe(undefined);
		expect(evaluate("notAFunction()", { notAFunction: 1 })).toBe(undefined);
	});

	test("map constraints as contexts and values", () => {
		const context = cjs({ a: 1, inner: cjs({ b: 2 }) as unknown });
		expect(evaluate("a + inner.b", context)).toBe(3);
	});

	test("syntax errors", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		for (const bad of ["'unclosed", "(1 + 2", "a[1", "f(1", "1 ? 2", "1e", "2x", "#"]) {
			expect(cjs.createParsedConstraint(bad, {}).get(), bad).toBe(undefined);
		}
		expect(error).toHaveBeenCalledTimes(8);
		for (const [bad, description] of error.mock.calls.map((call, i) => [i, (call[0] as Error).message])) {
			expect(description, String(bad)).toMatch(/at character \d+/);
		}
		error.mockRestore();
	});
});
