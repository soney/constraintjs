module("Finite State Machines");

dt("Basic FSM", 2, function() {
	var do_transition;
	var fsm = cjs	.fsm()
					.addState("state_1")
					.addState("state_2")
					.startsAt("state_1")
					.addTransition("state_2", function(dt) {
						do_transition = dt;
					})
					;

	ok(fsm.is("state_1"));
	do_transition();
	ok(fsm.is("state_2"));
});

dt("addTransition Types", 5, function() {
	var do_transition;
	var fsm = cjs	.fsm()
					.addState("state_1")
					.addState("state_2")
					.startsAt("state_1");
	var t12_1 = fsm.addTransition("state_2"),
		t12_2 = fsm.addTransition("state_1", "state_2");
	var t21_1, t21_2;
	fsm.addState("state_2")
		.addTransition("state_1", function(dt) { t21_1 = dt; })
		.addTransition("state_2", "state_1", function(dt) { t21_2 = dt; });
	ok(fsm.is("state_1"));
	t12_1();
	ok(fsm.is("state_2"));
	t21_1();
	ok(fsm.is("state_1"));
	t12_2();
	ok(fsm.is("state_2"));
	t21_2();
	ok(fsm.is("state_1"));
});
