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
	var fsm = cjs	.fsm()
					.addState("state_1")
					.addState("state_2")
					.startsAt("state_1")
					.addTransition("state_2", cjs.on("timeout", 50))
					.addTransition("state_2", cjs.on("timeout", 0).guard(function() {
						return false;
					}))
					.addState("state_2")
					.addTransition("state_1", cjs.on("timeout", 50).guard(function() {
						return true;
					}));
	ok(fsm.is("state_1"));
	setTimeout(function() {
		ok(fsm.is("state_2"));
		setTimeout(function() {
			ok(fsm.is("state_1"));
			fsm.destroy();
			fsm = null;
			take_snapshot(["Constraint", "MapConstraint", "ArrayConstraint", "FSM", "Binding", "CJSEvent"], function(response) {
				ok(!response.illegal_strs, "Make sure nothing was allocated");
				start();
			});
		}, 50);
	}, 75);
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

	fsmc.destroy();
	fsm.destroy();
});

dt("FSM on", 42, function() {
	var do_transition;
	var fsm = cjs	.fsm()
					.addState("state_1")
					.addState("state_2")
					.startsAt("state_1");
	var t12 = fsm.addTransition("state_1", "state_2"),
		t21 = fsm.addTransition("state_2", "state_1");
	
	var c01,c02,c03,c04,c05,c06,c07,c08,c09,c10,c11,c12,c13,c14;
	c01=c02=c03=c04=c05=c06=c07=c08=c09=c10=c11=c12=c13=c14=0;
	fsm.on("state_1 -> state_2",  function() { c01++; });
	fsm.on("state_1 >- state_2",  function() { c02++; });
	fsm.on("state_2 <- state_1",  function() { c03++; });
	fsm.on("state_2 -< state_1",  function() { c04++; });
	fsm.on("* -> state_2",        function() { c05++; });
	fsm.on("state_1 -> *",        function() { c06++; });
	fsm.on("*",                   function() { c07++; });
	fsm.on("state_1 <-> state_2", function() { c08++; });
	fsm.on("state_1 >-< state_2", function() { c09++; });
	fsm.on("* -> state_1",        function() { c10++; });
	fsm.on("state_2 -> state_1",  function() { c11++; });
	fsm.on("state_2 >- state_1",  function() { c12++; });
	fsm.on("state_1 <- state_2",  function() { c13++; });
	fsm.on("state_1 -< state_2",  function() { c14++; });

	equal(c01, 0); equal(c02, 0); equal(c03, 0);
	equal(c04, 0); equal(c05, 0); equal(c06, 0);
	equal(c07, 0); equal(c08, 0); equal(c09, 0);
	equal(c10, 0); equal(c11, 0); equal(c12, 0);
	equal(c13, 0); equal(c14, 0);

	t12();

	equal(c01, 1); equal(c02, 1); equal(c03, 1);
	equal(c04, 1); equal(c05, 1); equal(c06, 1);
	equal(c07, 1); equal(c08, 1); equal(c09, 1);
	equal(c10, 0); equal(c11, 0); equal(c12, 0);
	equal(c13, 0); equal(c14, 0);

	t21();

	equal(c01, 1); equal(c02, 1); equal(c03, 1);
	equal(c04, 1); equal(c05, 1); equal(c06, 1);
	equal(c07, 2); equal(c08, 2); equal(c09, 2);
	equal(c10, 1); equal(c11, 1); equal(c12, 1);
	equal(c13, 1); equal(c14, 1);

	fsm.destroy();
});

dt("FSM startsAt bug", 2, function() {
	var fsm = cjs	.fsm()
					.addState("state_1");
	ok(fsm.is("state_1"));
	fsm.startsAt("state_2");
	ok(fsm.is("state_2"));

	fsm.destroy();
});
