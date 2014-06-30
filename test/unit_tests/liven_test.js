module("Liven");

dt("Basic Liven", 7, function() {
	var x = cjs(1),
		y = cjs(function() { return x + 1; });
	var x_clone = x.get(),
		y_clone = y.get();
	var num_calls = 0;

	equal(y.get(), y_clone);

	var live_fn = cjs.liven(function() {
		x_clone = x.get();
	});

	x.set(2);
	equal(x.get(), x_clone);
	equal(y.get(), y_clone);

	live_fn.pause();

	x.set(3);
	equal(x_clone, 2);
	equal(x.get(), 3);

	live_fn.resume();

	equal(x.get(), x_clone);
	equal(y.get(), y_clone);
	live_fn.destroy();
});

dt("Liven Context", 2, function() {
	var me = {prop1: 1};
	var p1_val;
	var x = cjs(1);
	var live_fn = cjs.liven(function() {
		p1_val = this.prop1+x.get();
	}, {
		context: me
	});
	equal(p1_val, 2);
	x.set(2);
	equal(p1_val, 3);
	live_fn.destroy();
});

dt("Liven Priority", 12, function() {
	var x = cjs(1),
		counter = 0,
		is_first = false;

	var live_fns = [
		cjs.liven(function() { // fourth to run
			if(x.get() === 1) {
				equal(counter++, 0);
			} else {
				equal(counter++, 3);
			}
		}, {
		}),
		cjs.liven(function() { // second to run
			if(x.get() === 1) {
				equal(counter++, 1);
			} else {
				equal(counter++, 1);
			}
		}, {
			priority: 2
		}),
		cjs.liven(function() { // fifth to run
			if(x.get() === 1) {
				equal(counter++, 2);
			} else {
				equal(counter++, 4);
			}
		}, {
		}),
		cjs.liven(function() { // third to run
			if(x.get() === 1) {
				equal(counter++, 3);
			} else {
				equal(counter++, 2);
			}
		}, {
			priority: 1
		}),
		cjs.liven(function() { // sixth to run
			if(x.get() === 1) {
				equal(counter++, 4);
			} else {
				equal(counter++, 5);
			}
		}, {
		}),
		cjs.liven(function() { // first to run
			if(x.get() === 1) {
				equal(counter++, 5);
			} else {
				equal(counter++, 0);
			}
		}, {
			priority: 3
		}),
	];
	counter = 0;
	x.set(2);
	for(var i = 0; i<live_fns.length; i++) {
		live_fns[i].destroy();
	}
});
