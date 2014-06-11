(function(root) {
	QUnit.config.autostart = false;

	var memoryTester = getMemoryTester(function() {
		QUnit.start();
	});

	root.memoryTester = memoryTester;

	module("Debugger");
	test("Debugger Connection", function() {
		if(memoryTester.connected) {
			ok(true, "Connected to debugger");
		} else {
			ok(true, "Could not connect to debugger");
		}
	});

	root.dt = function(name, num_tests, callback) {
		asyncTest(name, function() {
			expect(num_tests + 1);
			callback();
			memoryTester.takeSnapshot(["Constraint", "MapConstraint", "ArrayConstraint", "FSM", "Binding", "CJSEvent"], function(response) {
				var message = response.illegal_strs ? "Found " + response.illegal_strs + " allocated." :
														"Nothing was allocated " + (response.checked===false ? "(did not check)" : "(checked)");
				ok(!response.illegal_strs, message);
				start();
			});
		});
	};

	root.dtAsync = function(name, num_tests, callback) {
		asyncTest(name, function() {
			expect(num_tests + 1);
			callback(function() {
				memoryTester.takeSnapshot(["Constraint", "MapConstraint", "ArrayConstraint", "FSM", "Binding", "CJSEvent"], function(response) {
					var message = response.illegal_strs ? "Found " + response.illegal_strs + " allocated." :
															"Nothing was allocated " + (response.checked===false ? "(did not check)" : "(checked)");
					ok(!response.illegal_strs, message);
					start();
				});
			});
		});
	};
}(this));
