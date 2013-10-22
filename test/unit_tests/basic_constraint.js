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
