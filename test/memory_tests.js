(function(root) {
	QUnit.config.autostart = false;
	QUnit.start();
	root.dt = function(name, num_tests, callback) {
		asyncTest(name, function() {
			expect(num_tests);
			callback();
			start();
		});
	};
}(this));
