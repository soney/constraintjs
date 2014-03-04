module("Constraints");

dt("Basic Constraints", 6, function() {
	var x = cjs(1);
	var y = cjs(function() { return x.get() + 1; });
	var z = cjs(function() { return y.get() * 2; });
	equal(x.get(), 1);
	equal(y.get(), 2);
	equal(z.get(), 4);
	x.set(10);
	equal(x.get(), 10);
	equal(y.get(), 11);
	equal(z.get(), 22);
	x.destroy();
	y.destroy();
	z.destroy();
	x = y = z = null;
});

dt("Invalidation and change listening", 10, function() {
	var x_change_counter = 0,
		y_change_counter = 0;
	var x = cjs("Hello");
	var x_is_hello = cjs(10);
	var x_isnt_hello = cjs(20);
	var y = cjs(function() {
		if(x.get() === "Hello") {
			return x_is_hello.get();
		} else {
			return x_isnt_hello.get();
		}
	});
	x.onChange(function() {
		x_change_counter++;
	});
	y.onChange(function() {
		y_change_counter++;
	});
	equal(x_change_counter, 0);
	equal(y_change_counter, 0);
	equal(y.get(), x_is_hello.get());
	x.set("World");
	equal(x_change_counter, 1);
	equal(y_change_counter, 1);
	equal(y.get(), x_isnt_hello.get());
	x_isnt_hello.set(200);
	equal(y.get(), x_isnt_hello.get());
	equal(x_change_counter, 1);
	equal(y_change_counter, 2);
	x.invalidate();
	equal(x.get(), "World");
});

dt("Constraint context", 1, function() {
	var x = cjs(function() {
		return this.prop1;
	}, {
		context: {prop1: 1}
	});
	equal(x.get(), 1);
});

dt("Self Referring", 3, function() {
	var x = cjs(1);
	equal(x.get(), 1);
	x.set(function() {
		return x.get() + 1;
	});
	equal(x.get(), 2);
	equal(x.get(), 2);
});

dt("Modifiers", 21, function() {
	var x = cjs(1),
		y = cjs(2),
		sum_plus_one = x.add(y, 1);
	equal(sum_plus_one.get(), 4);
	y.set(3);
	equal(sum_plus_one.get(), 5);
	x.set(2);
	equal(sum_plus_one.get(), 6);
		
	var times_a_evaled = 0,
		times_b_evaled = 0,
		a = cjs(function() {
			times_a_evaled++;
			return false;
		}),
		b = cjs(function() {
			times_b_evaled++;
			return false;
		}),
		and_val = a.and(b),
		or_val = a.or(b);
	equal(times_a_evaled, 0);
	equal(times_b_evaled, 0);
	equal(and_val.get(), false);
	equal(times_a_evaled, 1);
	equal(times_b_evaled, 0);
	a.invalidate();
	b.invalidate();
	equal(or_val.get(), false);
	equal(times_a_evaled, 2);
	equal(times_b_evaled, 1);

	a.set(function() {
		times_a_evaled++;
		return true;
	});

	a.invalidate();
	b.invalidate();
	equal(and_val.get(), false);
	equal(times_a_evaled, 3);
	equal(times_b_evaled, 2);
	a.invalidate();
	b.invalidate();
	equal(or_val.get(), true);
	equal(times_a_evaled, 4);
	equal(times_b_evaled, 2);

	var negx = x.neg(),
		not_3 = negx.neq(3);

	equal(not_3.get(), true);
	equal(negx.get(), -x.get());
	x.set(-3);
	equal(negx.get(), -x.get());
	equal(not_3.get(), false);
});

dt("Setting as constraint", 7, function() {
	var x = cjs(1);
	var y = cjs(x);
	var z = cjs(3);
	equal(x.get(), 1);
	equal(y.get(), 1);
	x.set(2);
	equal(x.get(), 2);
	equal(y.get(), 2);
	y.set(z);
	equal(x.get(), 2);
	equal(y.get(), 3);
	equal(z.get(), 3);
});

dt("Parsed Constraints", 2, function() {
	 var a = cjs(1);
	 var x = cjs.createParsedConstraint("a+b", {a: a, b: cjs(2)})
	 equal(x.get(), 3);
	 a.set(2);
	 equal(x.get(), 4);
});

dt("Parsed Constraints", 2, function() {
	 var a = cjs(1);
	 var x = cjs.createParsedConstraint("a+b", {a: a, b: cjs(2)})
	 equal(x.get(), 3);
	 a.set(2);
	 equal(x.get(), 4);
});

dt("Pause Syncronous Getter", 5, function() {
	var eval_count = 0;
	var a = cjs(function(node) {
		node.pauseGetter(1);
		node.resumeGetter(10);
	});
	var live_fn = cjs.liven(function() {
		eval_count++;
		a.get();
	});
	var b = a.add(1);
	equal(eval_count, 1);
	equal(a.get(), 10);
	equal(eval_count, 1);
	equal(b.get(), 11);
	equal(eval_count, 1);

	a.destroy();
	b.destroy();
	live_fn.destroy();
});
dtAsync("Pause Asyncronous Getter", 25, function(ready_callback) {
	var x = 0;
	var a = cjs(function(node) {
		node.pauseGetter(1);
		x++;
		setTimeout(function() {
			x++;
			node.resumeGetter(10);
		}, 50);
	});
	equal(x, 0);
	var b = a.add(1);
	equal(a.get(), 1);
	equal(x, 1);
	equal(b.get(), 2);
	equal(x, 1);

	setTimeout(function() {
		equal(x, 1); 
		equal(a.get(), 1);
		equal(x, 1); 
		equal(b.get(), 2);
		equal(x, 1); 
	}, 25);
	setTimeout(function() {
		equal(x, 2); 
		equal(a.get(), 10);
		equal(x, 2); 
		equal(b.get(), 11);
		equal(x, 2); 
	}, 100);
	setTimeout(function() {
		equal(x, 2); 
		equal(a.get(), 10);
		equal(x, 2); 
		equal(b.get(), 11);
		equal(x, 2); 
	}, 150);
	setTimeout(function() {
		equal(x, 2); 
		equal(a.get(), 10);
		equal(x, 2); 
		equal(b.get(), 11);
		equal(x, 2); 
		a.destroy();
		b.destroy();
		ready_callback();
	}, 200);
});
