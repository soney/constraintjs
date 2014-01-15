(function(root) {
	QUnit.config.autostart = false;
	root.clear_snapshots = function(callback) {
		callback();
	};

	root.take_snapshot = function(forbidden_tokens, callback) {
		callback({
			ililegal_strs: false
		});
	};
	QUnit.start();
	root.dt = function(name, num_tests, callback) {
		asyncTest(name, function() {
			expect(num_tests);
			callback();
			start();
		});
	};
}(this));
