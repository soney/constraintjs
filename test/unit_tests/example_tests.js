module("Examples");

dt("Two Eaches", 3, function() {
	var a1 = cjs([1,2,3]),
		a2 = cjs(["A", "B", "C"]);
	var tmplate = cjs.createTemplate("{{#each a1}}{{this}}{{/each}}{{#each a2}}{{this}}{{/each}}", {a1: a1, a2: a2});
	equal(tmplate.textContent, "123ABC");
	a2.splice(1, 1);
	equal(tmplate.textContent, "123AC");
	a1.splice(2, 1, "yo");
	equal(tmplate.textContent, "12yoAC");
});

dt("Cell", 0, function() {
	var tmplate = cjs.createTemplate(
		"{{#fsm edit_state}}" +
			"{{#state idle}}" +
				"<span class='cell'>{{value}}</span>" +
			"{{#state unset}}" +
				"<span class='unset_cell' />" +
			"{{#state editing}}" +
				"<textarea data-cjs-on-keydown=keydown_ta />" +
		"{{/fsm}}"
	);
	var edit_state = cjs.fsm("idle", "unset", "editing")
						.startsAt("idle");
	var value = cjs("hi");

	var on_cancel = edit_state.addTransition("editing", "idle");

	var cell = tmplate({
				edit_state: edit_state,
				value: value,
				keydown_ta: function(event) {
					if(event.keyCode === 27) { // esc
						on_cancel(event);
					} else if(event.keyCode === 27) { // enter
						
					}
				}
		});
	edit_state.addTransition("idle", "editing", cjs.on("click", cell));
	edit_state.on("idle->editing", function() {
		var textarea = cell.getElementsByTagName("textarea")[0];
		textarea.value = value.get();
		textarea.select();
		textarea.focus();
	});
	window.cell = cell;
	document.body.appendChild(cell);
});
