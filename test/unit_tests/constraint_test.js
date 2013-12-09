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
