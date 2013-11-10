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

asyncTest("cjs.on", function() {
	expect(4);
	clear_snapshots(function() {
		take_snapshot([], function(response) {
			var fsm = cjs	.fsm()
							.addState("state_1")
							.addState("state_2")
							.startsAt("state_1")
							.addTransition("state_2", cjs.on("timeout", 50))
							.addState("state_2")
							.addTransition("state_1", cjs.on("timeout", 50));
			ok(fsm.is("state_1"));
			setTimeout(function() {
				ok(fsm.is("state_2"));
				setTimeout(function() {
					ok(fsm.is("state_1"));
					take_snapshot(["Constraint", "MapConstraint", "ArrayConstraint", "FSM"], function(response) {
						ok(!response.illegal_strs, "Make sure nothing was allocated");
						start();
					});
				}, 50);
			}, 75);
		});
	});
});

dt("FSM Constraint", 5, function() {
	var do_transition;
	var fsm = cjs	.fsm()
					.addState("state_1")
					.addState("state_2")
					.startsAt("state_1");
	var t12 = fsm.addTransition("state_1", "state_2"),
		t21 = fsm.addTransition("state_2", "state_1");
	var s2val = cjs(2);
	var fsmc = cjs.inFSM(fsm, {
		"state_1": 1,
		"state_2": function() { return s2val.get(); }
	});

	ok(fsm.is("state_1"));
	equal(fsmc.get(), 1);
	t12();
	ok(fsm.is("state_2"));
	equal(fsmc.get(), 2);
	s2val.set(3);
	equal(fsmc.get(), 3);
});
