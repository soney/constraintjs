(function(){
module("CJS");

test('Graph', function() {
	var graph = cjs.create("graph");

	var contains = function(arr, obj) {
		return arr.some(function(x) {
			return x == obj;
		});
	};

	var n1 = graph.create_node(); n1.name = "n1";
	var n2 = graph.create_node(); n2.name = "n2";
	var n3 = graph.create_node(); n3.name = "n3";
	var n4 = graph.create_node(); n4.name = "n4";
	var n5 = graph.create_node(); n5.name = "n5";
	
	graph.addEdge(n1, n2);
	graph.addEdge(n3, n4);
	graph.addEdge(n2, n3);

	
	ok(graph.hasNode(n1));
	
	ok(graph.hasEdge(n1, n2));
	ok(!graph.hasEdge(n1, n3));
	
	var e = graph.getEdge(n3, n4);
	ok(graph.hasEdge(n3, n4));
	ok(contains(n3.outgoingEdges, e));
	ok(contains(n4.incomingEdges, e));
	graph.removeEdge(n3, n4);
	ok(!graph.hasEdge(n3, n4));
	ok(!contains(n3.outgoingEdges, e));
	ok(!contains(n4.incomingEdges, e));

	graph.addEdge(n2,n5);
	ok(n2.pointsAt()[0]==n3 && n2.pointsAt()[1]==n5 && n2.pointsAt().length==2);
	graph.removeEdge(n2,n5);

	var n1n2 = graph.getEdge(n1,n2);
	var n2n3 = graph.getEdge(n2,n3);
	
	ok(graph.hasNode(n2));
	ok(contains(n1.outgoingEdges, n1n2));
	ok(contains(n2.incomingEdges, n1n2));
	ok(contains(n2.outgoingEdges, n2n3));
	ok(contains(n3.incomingEdges, n2n3));
	ok(graph.hasEdge(n1n2));
	ok(graph.hasEdge(n2n3));
	graph.removeNode(n2);
	//ok(!graph.hasNode(n2));
	ok(!contains(n1.outgoingEdges, n1n2));
	ok(!contains(n2.incomingEdges, n1n2));
	ok(!contains(n2.outgoingEdges, n2n3));
	ok(!contains(n3.incomingEdges, n2n3));
	ok(!graph.hasEdge(n1n2));
	ok(!graph.hasEdge(n2n3));
	/**/
});


test('Constraint Solver', function() {
	var equalSets = function (set1, set2) {
		if(set1.length!=set2.length) return false;
		for(var i = 0; i<set1.length; i++) {
			if(!cjs._.contains(set2, set1[i])) return false;
		}
		return true;
	}
	
	var constraintSolver = cjs._constraint_solver;
	
	var o1 = {name:'o1'};
	var o2 = {name:'o2'};
	var o3 = {name:'o3'};
	var o4 = {name:'o4'};
	var o5 = {name:'o5'};
	var o6 = {name:'o6'};
	
	constraintSolver.addObject(o1);
	constraintSolver.addObject(o2);
	constraintSolver.addObject(o3);
	constraintSolver.addObject(o4);
	constraintSolver.addObject(o5);
	constraintSolver.addObject(o6);
	
	constraintSolver.addDependency(o1, o2);
	constraintSolver.addDependency(o4, o5);
	
	ok(equalSets(constraintSolver.influences(o1), [o2]));
	constraintSolver.removeObject(o2);	
	ok(equalSets(constraintSolver.influences(o1), []));
	
	constraintSolver.addObject(o2);
	constraintSolver.addDependency(o1, o2);
	constraintSolver.addDependency(o2, o3);
	constraintSolver.addDependency(o2, o4);
	ok(equalSets(constraintSolver.influences(o2), [o3, o4]));
	constraintSolver.removeObject(o4);
	ok(equalSets(constraintSolver.influences(o2), [o3]));
	constraintSolver.addObject(o4);
	constraintSolver.addDependency(o2,o4);
	ok(equalSets(constraintSolver.influences(o2), [o3, o4]));
	constraintSolver.removeDependency(o2,o4);
	ok(equalSets(constraintSolver.influences(o2), [o3]));
});

test('Basic Constraints', function() {
	var c1 = cjs.constraint(1);
	var c2 = cjs.constraint(2);
	var c3 = cjs.constraint(function() { return c1.get() + c2.get(); });

	equal(c3.get(), 3);
	c1.set(4);
	equal(c3.get(), 6);
});

test('Array Constraints', function() {
	expect(0);
/*
	var c1 = cjs.constraint([1,2,3]);
	c1	.onAdd(function() {
			console.log("add", arguments);
		})
		.onRemove(function() {
			console.log("remove", arguments);
		})
		.onMove(function() {
			console.log("move", arguments);
		});
	c1.set([3,2,4]);
	*/
});

var fsm = cjs	.fsm()
				.add_state("A")
				.add_state("B")
				.add_state("C")
				.add_state("D")
				.starts_at("B");
var fsm_ab = fsm.get_transition("A", "B", false);
var fsm_bc = fsm.get_transition("B", "C", false);
var fsm_cd = fsm.get_transition("C", "D", false);
var fsm_bd = fsm.get_transition("B", "D", false);
var fsm_da = fsm.get_transition("D", "A", false);

test('FSM', function() {
	fsm.reset();
	ok(fsm.is("B"));
	fsm_bd();
	ok(fsm.is("D"));
	fsm_bc(); //Not in B, so this transition doesn't run
	ok(fsm.is("D"));
});

test('FSM Event Listeners', function() {
	fsm.reset();
	expect(2);

	var ran_post = false;
	fsm.on("B->D", function() {
		ran_post = true;
		ok(true);
	});
	fsm.on("B>-*", function() {
		ok(!ran_post);
	});
	fsm.on("D", function() {
		ok(ran_post);
	});
	fsm_bd();
});

test('FSM Constraints', function() {
	fsm.reset();
	var c = cjs.create("fsm_constraint", fsm, {
		"A": 1
		, "B": 2
		, "C": 3
		, "D": 4
	});

	var c2 = cjs.create("fsm_constraint", fsm, {
		"A,B": function() {
			return c.get();
		}
		, "C,D": function() {
			return 5;
		}
	});

	equal(c.get(), 2);
	equal(c2.get(), 2);
	fsm_bd();
	equal(c.get(), 4);
	equal(c2.get(), 5);
	fsm_da();
	equal(c.get(), 1);
	equal(c2.get(), 1);
});

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

test('Statechart Constraints', function() {
	sc.reset();
	var c = cjs.create("statechart_constraint", sc, {
		"A": 1
		, "B": 2
		, "C": 3
		, "D": 4
	});

	var c2 = cjs.create("statechart_constraint", sc, {
		"A,B": function() {
			return c.get();
		}
		, "C,D": function() {
			return 5;
		}
	});

	equal(c.get(), 2);
	equal(c2.get(), 2);
	bd.fire();
	equal(c.get(), 4);
	equal(c2.get(), 5);
	da.fire();
	equal(c.get(), 1);
	equal(c2.get(), 1);
});

asyncTest('Constraint Event Listeners', function() {
	start();
	expect(4);
	var c = cjs(1);
	equal(c.get(), 1);
	c.onChange(function(value) {
		ok(value === 2);
	});
	c.set(2);

	var d = cjs(2);
	var e = cjs(function() {
		return d.get() + 1;
	});
	equal(e.get(), 3);
	e.onChange(function(value) {
		ok(value === 4);
	});
	d.set(3);
});

asyncTest('Asyncronous Constraints', function() {
	expect(1);
	var c1 = cjs.create("async_constraint", function(success, failure) {
		window.setTimeout(function() {
			success(10);
		}, 30);
	});
	window.setTimeout(function() {
		start();
		equal(c1.get(), 10);
	}, 40);
});
}());
