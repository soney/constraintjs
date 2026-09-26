// Ported from the old QUnit suite (test/unit_tests/example_tests.js). Each test keeps, via `expect.assertions(n)`,
// the assertion count that the old `dt(name, n, fn)` wrapper declared. The wrapper's extra memory-leak check
// (which needed an obsolete Chrome extension) was dropped, along with `x = null` assignments that only served it.
import { describe, expect, test } from "vitest";
import cjs from "../src/index";
import { emulateKeyboardEvent, emulateMouseEvent, getTextContent } from "./helpers";

describe("Examples", () => {
	test("Two Eaches", () => {
		expect.assertions(3);
		const a1 = cjs([1, 2, 3] as any[]),
			a2 = cjs(["A", "B", "C"]);
		const tmplate = cjs.createTemplate("{{#each a1}}{{this}}{{/each}}{{#each a2}}{{this}}{{/each}}", {
			a1: a1,
			a2: a2,
		});
		expect(getTextContent(tmplate)).toBe("123ABC");
		a2.splice(1, 1);
		expect(getTextContent(tmplate)).toBe("123AC");
		a1.splice(2, 1, "yo");
		expect(getTextContent(tmplate)).toBe("12yoAC");

		a1.destroy();
		a2.destroy();
		cjs.destroyTemplate(tmplate);
	});

	test("Cell", () => {
		expect.assertions(8);
		const value = cjs(""),
			tmplate = cjs.createTemplate(
				"{{#fsm edit_state}}" +
					"{{#state idle}}" +
					"{{#if value===''}}" +
					"<span class='unset_cell'>(unset)</span>" +
					"{{#else}}" +
					"<span class='cell'>{{value}}</span>" +
					"{{/if}}" +
					"{{#state editing}}" +
					"<textarea data-cjs-on-keydown=keydown_ta data-cjs-on-blur=blur_ta/>" +
					"{{/fsm}}",
			),
			edit_state = cjs
				.fsm("idle", "editing")
				.startsAt("idle")
				.on("idle->editing", function () {
					const textarea = cell.getElementsByTagName("textarea")[0];
					textarea.value = value.get();
					//textarea.select();
					textarea.focus();
				});

		const cell: any = tmplate({
			edit_state: edit_state,
			value: value,
			keydown_ta: function (event: any) {
				const keyCode = event.keyCodeVal || event.keyCode;
				if (keyCode === 27) {
					// esc
					on_cancel(event);
				} else if (keyCode === 13) {
					// enter
					value.set(event.target.value);
					on_confirm(event);
				}
			},
			blur_ta: function (event: any) {
				if (edit_state.is("editing")) {
					value.set(event.target.value);
					on_confirm(event);
				}
			},
		});

		const on_cancel = edit_state.addTransition("editing", "idle"),
			on_confirm = edit_state.addTransition("editing", "idle");
		edit_state.addTransition("idle", "editing", cjs.on("click", cell));

		expect(getTextContent(cell)).toBe("(unset)");

		emulateMouseEvent("click", cell);

		expect(cell.childNodes[0].tagName).toBe("TEXTAREA");

		cell.childNodes[0].value = "something";

		emulateKeyboardEvent("keydown", cell.childNodes[0], 13); // enter

		expect(value.get()).toBe("something");
		expect(getTextContent(cell)).toBe("something");

		emulateMouseEvent("click", cell);

		expect(cell.childNodes[0].tagName).toBe("TEXTAREA");
		expect(cell.childNodes[0].value).toBe("something");

		cell.childNodes[0].value = "other";
		emulateKeyboardEvent("keydown", cell.childNodes[0], 27); // esc

		expect(value.get()).toBe("something");
		expect(getTextContent(cell)).toBe("something");

		cjs.destroyTemplate(cell);
		edit_state.destroy();
		value.destroy();
	});

	// The example in README.md
	test("README", () => {
		const width = cjs(10);
		const height = cjs(20);
		const area = width.mul(height); // or: cjs(() => width.get() * height.get())

		expect(area.get()).toBe(200);
		width.set(15);
		expect(area.get()).toBe(300);

		const label = document.createElement("span");
		cjs.bindText(label, "Area: ", area);
		const box = cjs.createTemplate("<div>{{width}} × {{height}} = {{area}}</div>", { width, height, area });
		expect(label.textContent).toBe("Area: 300");
		expect(box.textContent).toBe("15 × 20 = 300");
		height.set(2);
		expect(label.textContent).toBe("Area: 30");
		expect(box.textContent).toBe("15 × 2 = 30");
		cjs.destroyTemplate(box);
	});
});
