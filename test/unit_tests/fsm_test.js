module("Finite State Machines");

dt("Basic FSM", 1, function() {
	var fsm = cjs	.fsm()
					.addState("state_1")
					.addState("state_2")
					.startsAt("state_1");

	ok(fsm.is("state_1"))
});
