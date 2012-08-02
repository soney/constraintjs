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

test('Basic Constraints', function() {
	var c1 = cjs.constraint(1);
	var c2 = cjs.constraint(2);
	var c3 = cjs.constraint(function() { return c1.get() + c2.get(); });

	equal(c3.get(), 3);
	c1.set(4);
	equal(c3.get(), 6);
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
*/
}());
