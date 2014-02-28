module("Memoize");

dt("Basic Memoization", 8, function() {
	var x = cjs(1),
		y = cjs(function() { return x.get() + 1; }),
		map = cjs({a: 1}),
		arr = cjs([1,2,3]);

	var num_calls = 0;
	var y_plus_ma_plus_arr = function(idx) {
		num_calls++;
		return y.get() + map.item("a") + arr.item(idx);
	};
	var memoized_fn = cjs.memoize(y_plus_ma_plus_arr);
	equal(memoized_fn(0), 4);
	equal(num_calls, 1);
	equal(memoized_fn(0), 4);
	equal(num_calls, 1);

	equal(memoized_fn(1), 5);
	equal(num_calls, 2);
	x.set(2);
	equal(memoized_fn(1), 6);
	equal(num_calls, 3);

	memoized_fn.destroy();
});
