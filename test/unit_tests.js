var dt = function(name, num_tests, callback) {
	asyncTest(name, function() {
		expect(num_tests + 1);
		clear_snapshots(function() {
			take_snapshot([], function(response) {
				callback();
				take_snapshot(["Constraint"], function(response) {
					ok(!response.illegal_strs, "Make sure nothing was allocated");
					start();
				});
			});
		});
	});
};

module("Constraints");
dt("Constraint allocation", 4, function() {
	var x = cjs(1);
	var y = cjs(function() { return x.get() + 1; });
	equal(y.get(), 2);
	equal(x.get(), 1);
	x.set(10);
	equal(y.get(), 11);
	equal(x.get(), 10);
	x.destroy();
	x = null;
	y = null;
});
