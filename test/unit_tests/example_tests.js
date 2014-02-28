module("Examples");

dt("Two Eaches", 3, function() {
	var a1 = cjs([1,2,3]),
		a2 = cjs(["A", "B", "C"]);
	var tmplate = cjs.createTemplate("{{#each a1}}{{this}}{{/each}}{{#each a2}}{{this}}{{/each}}", {a1: a1, a2: a2});
	equal(getTextContent(tmplate), "123ABC");
	a2.splice(1, 1);
	equal(getTextContent(tmplate), "123AC");
	a1.splice(2, 1, "yo");
	equal(getTextContent(tmplate), "12yoAC");

	a1.destroy();
	a2.destroy();
	cjs.destroyTemplate(tmplate);
});

var emulate_mouse_event = function(event_type, target) {
		if(document.createEvent) {
			var ev = document.createEvent("MouseEvent");
			ev.initMouseEvent(event_type, true, true, window,
    0, 0, 0, 80, 20, false, false, false, false, 0, null);
			target.dispatchEvent(ev);
		} else if(document.createEventObject) {
			var evObj = document.createEventObject();
			target.fireEvent('on' + event_type, evObj);
		}
	}
	emulate_keyboard_event = function(event_class, target, key_code) {
		if(document.createEvent) {
			var keyboardEvent = document.createEvent("KeyboardEvent");

			var initMethod = typeof keyboardEvent.initKeyboardEvent !== 'undefined' ? "initKeyboardEvent" : "initKeyEvent";


			keyboardEvent[initMethod](
				event_class,
				true,      // bubbles oOooOOo0
				true,      // cancelable   
				window,    // view
				false,     // ctrlKeyArg
				false,     // altKeyArg
				false,     // shiftKeyArg
				false,     // metaKeyArg
				key_code, 
				key_code   // charCode   
			);
			keyboardEvent.keyCode = key_code;
			keyboardEvent.keyCodeVal = key_code;
			keyboardEvent.which = key_code;
			

			target.dispatchEvent(keyboardEvent); 
		} else if(document.createEventObject) {
			var evObj = document.createEventObject();
			evObj.keyCode = key_code;
			evObj.target = target;
			target.fireEvent('on'+event_class, evObj);
		}
	};

dt("Cell", 8, function() {
	var value = cjs(""),
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
			"{{/fsm}}"
		),
		edit_state = cjs.fsm("idle", "editing")
						.startsAt("idle")
						.on("idle->editing", function() {
							var textarea = cell.getElementsByTagName("textarea")[0];
							textarea.value = value.get();
							//textarea.select();
							textarea.focus();
						});


	var cell = tmplate({
				edit_state: edit_state,
				value: value,
				keydown_ta: function(event) {
					var keyCode = event.keyCodeVal || event.keyCode;
					if(keyCode === 27) { // esc
						on_cancel(event);
					} else if(keyCode === 13) { // enter
						value.set(event.target.value);
						on_confirm(event);
					}
				},
				blur_ta: function(event) {
					if(edit_state.is("editing")) {
						value.set(event.target.value);
						on_confirm(event);
					}
				}
		});

	var on_cancel = edit_state.addTransition("editing", "idle"),
		on_confirm = edit_state.addTransition("editing", "idle");
	edit_state.addTransition("idle", "editing", cjs.on("click", cell))

	equal(getTextContent(cell), "(unset)");

	emulate_mouse_event("click", cell);

	equal(cell.childNodes[0].tagName, "TEXTAREA");

	cell.childNodes[0].value = "something";

	emulate_keyboard_event("keydown", cell.childNodes[0], 13); // enter

	equal(value.get(), "something");
	equal(getTextContent(cell), "something");

	emulate_mouse_event("click", cell);

	equal(cell.childNodes[0].tagName, "TEXTAREA");
	equal(cell.childNodes[0].value, "something");

	cell.childNodes[0].value = "other";
	emulate_keyboard_event("keydown", cell.childNodes[0], 27); // esc

	equal(value.get(), "something");
	equal(getTextContent(cell), "something");

	cjs.destroyTemplate(cell);
	edit_state.destroy();
	value.destroy();
});
