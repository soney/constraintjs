(function(){
/*
var sc = cjs	.statechart()
				.add_state("A")
				.add_state("B")
				.add_state("C")
				.add_state("D")
				.starts_at("B")
				.run();
var ab = cjs.create_event("manual");
var bc = cjs.create_event("manual");
var cd = cjs.create_event("manual");
var bd = cjs.create_event("manual");
var da = cjs.create_event("manual");

sc.add_transition("A", "B", ab);
sc.add_transition("B", "C", bc);
sc.add_transition("C", "D", cd);
sc.add_transition("B", "D", bd);
sc.add_transition("D", "A", da);

test('Statechart', function() {
	sc.reset();
	ok(sc.is("B"));
	bd.fire();
	ok(sc.is("D"));
	bc.fire(); //Not in B, so this transition doesn't run
	ok(sc.is("D"));
});

test('Statechart Event Listeners', function() {
	sc.reset();
	expect(3);

	var ran_post = false;
	var bd_trans = function() {
		ran_post = true;
		ok(true);
	};
	var b_star_trans = function() {
		ok(!ran_post);
	};
	var d_state = function() {
		ok(ran_post);
	};
	sc.when("B->D", bd_trans);
	sc.when("B>-*", b_star_trans);
	sc.when("D", d_state);
	

	bd.fire();

	sc.off_when("B->D", bd_trans);
	sc.off_when("B>-*", b_star_trans);
	sc.off_when("D", d_state);
});
*/

test('Radio button statechart', function() {
	var select = cjs.create_event("manual");
	var deselect = cjs.create_event("manual");

	var mouseover = cjs.create_event("manual");
	var mouseout = cjs.create_event("manual");
	var mousedown = cjs.create_event("manual");
	var mouseup = cjs.create_event("manual");

	var keyboard_focus = cjs.create_event("manual");
	var keyboard_blur = cjs.create_event("manual");

	var sc = cjs.statechart()
				.concurrent(true)

				.add_state("keyboard")
				.add_state("keyboard.not_focused")
				.add_state("keyboard.focused")
					
					.add_transition("keyboard.not_focused", "keyboard.focused", keyboard_focus)
					.add_transition("keyboard.focused", "keyboard.not_focused", keyboard_blur)

					.in_state("keyboard")
					.starts_at("not_focused")
					.parent()

				.add_state("mouse")
				.add_state("mouse.idle")
				.add_state("mouse.hover")
				.add_state("mouse.pressed")
				.add_state("mouse.pressed_out")

					.add_transition("mouse.idle", "mouse.hover", mouseover)
					.add_transition("mouse.hover", "mouse.idle", mouseout)
					.add_transition("mouse.hover", "mouse.pressed", mousedown)
					.add_transition("mouse.pressed", "mouse.hover", mouseup)
					.add_transition("mouse.pressed", "mouse.pressed_out", mouseout)
					.add_transition("mouse.pressed_out", "mouse.pressed", mouseover)
					.add_transition("mouse.pressed_out", "mouse.idle", mouseup)

					.in_state("mouse")
					.starts_at("idle")
					.parent()

				.add_state("selection")
				.add_state("selection.not_selected")
				.add_state("selection.selected")

					.add_transition("selection.not_selected", "selection.selected", select)
					.add_transition("selection.selected", "selection.not_selected", deselect)

					.in_state("selection")
					.starts_at("not_selected")
					.parent()

				.run()
				;
	var _ = cjs._;
	var array_equiv = function() {
		return _.isEmpty(_.difference.apply(_, arguments));
	};

	ok(array_equiv(sc.get_state_names(), ["keyboard.not_focused", "mouse.idle", "selection.not_selected"] ));
	mouseover.fire();
	ok(array_equiv(sc.get_state_names(), ["keyboard.not_focused", "mouse.hover", "selection.not_selected"] ));
	console.log(sc.stringify());

});
}());
