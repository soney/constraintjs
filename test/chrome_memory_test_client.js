// Install the extension: 
// https://chrome.google.com/webstore/detail/memory-tester/nmmiaefdogfanfjdecpabjaooihcmojj
(function(root) {
	var command_id = 0,
		callbacks = {},
		do_command = function(command_name, parameters, callback) {
			var id = command_id++,
				message = { id: id, type: "FROM_PAGE", command: command_name },
				key;

			callbacks[id] = callback;
			for(var key in parameters) {
				if(parameters.hasOwnProperty(key)) {
					message[key] = parameters[key];
				}
			}
			root.postMessage(message, "*");
		};

	root.addEventListener("message", function(event) {
		// We only accept messages from ourselves
		if (event.source != root) { return; }

		if (event.data.type && (event.data.type == "FROM_EXTENSION")) {
			var id = event.data.id;
			if(callbacks.hasOwnProperty(id)) {
				var callback = callbacks[id];
				delete callbacks[id];
				callback(event.data.response);
			}
		}
	}, false);


	root.getMemoryTester = function(onConnect, timeout) {
		if(arguments.length < 2) {
			timeout = 1000;
		}

		var timeout_id = false,
			memoryTester = {
				takeSnapshot: function(forbiddenTokens, callback) {
					if(this.connected) {
						do_command("take_snapshot", {forbidden_tokens: forbiddenTokens}, callback);
					} else {
						callback({
							ililegal_strs: false,
							checked: false
						});
					}
				},
				connected: false
			};

		if(timeout !== false) {
			timeout_id = setTimeout(function() {
				if(onConnect) {
					onConnect(false);
				}
			}, timeout);
		}

		do_command("ping", {}, function() {
			if(timeout_id) {
				clearTimeout(timeout_id);
			}

			memoryTester.connected = true;

			if(onConnect) {
				onConnect(memoryTester);
			}
		});

		return memoryTester;
	};
}(this));
