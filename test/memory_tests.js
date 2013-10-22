(function(root) {
	QUnit.config.autostart = false;
	var command_id = 0;
	var callbacks = {};
	var do_command = function(command_name, parameters, callback) {
		var id = command_id++;
		callbacks[id] = callback;
		var message = { id: id, type: "FROM_PAGE", command: command_name };
		for(var key in parameters) {
			if(parameters.hasOwnProperty(key)) {
				message[key] = parameters[key];
			}
		}
		window.postMessage(message, "*");
	};
	window.addEventListener("message", function(event) {
		// We only accept messages from ourselves
		if (event.source != window) { return; }

		if (event.data.type && (event.data.type == "FROM_EXTENSION")) {
			var id = event.data.id;
			if(callbacks.hasOwnProperty(id)) {
				var callback = callbacks[id];
				delete callbacks[id];
				callback(event.data.response);
			}
		}
	}, false);

	var connected;
	var timeout_id = setTimeout(function() {
		root.clear_snapshots = function(callback) {
			callback();
		};

		root.take_snapshot = function(forbidden_tokens, callback) {
			callback({
				ililegal_strs: false
			});
		};

		connected = false;
		QUnit.start();
	}, 1000);

	do_command("ping", {}, function() {
		clearTimeout(timeout_id);
		root.clear_snapshots = function(callback) {
			do_command("clear_snapshots", {}, callback);
		};

		root.take_snapshot = function(forbidden_tokens, callback) {
			do_command("take_snapshot", {forbidden_tokens: forbidden_tokens}, callback);
		};

		connected = true;
		QUnit.start();
	});

	module("Debugger");
	test("Debugger Connection", function() {
		if(connected) {
			ok(true, "Connected to debugger");
		} else {
			ok(true, "Could not connect to debugger");
		}
	});

	root.dt = function(name, num_tests, callback) {
		asyncTest(name, function() {
			expect(num_tests + 1);
			clear_snapshots(function() {
				take_snapshot([], function(response) {
					callback();
					take_snapshot(["Constraint", "MapConstraint", "ArrayConstraint"], function(response) {
						ok(!response.illegal_strs, "Make sure nothing was allocated");
						start();
					});
				});
			});
		});
	};
}(this));
