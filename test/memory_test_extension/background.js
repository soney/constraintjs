chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {   
    if(request.command) {
		var command = request.command;
		if(command === "take_snapshot") {
			var debuggerId = {tabId: sender.tab.id};
			console.log("Attached to tab with id " + sender.tab.id);
			chrome.debugger.attach(debuggerId, "1.0", function() {
				if(chrome.runtime.lastError) { console.error(chrome.runtime.lastError); return; }
				var snapshot_str = "";
				var illegal_strs = false;
				var listener = function(source, method, params) {
					if(source.tabId === debuggerId.tabId) {
						if(method === "HeapProfiler.addProfileHeader") {
							var uid = params.header.uid;
							//https://code.google.com/p/chromium/issues/detail?id=260749
							chrome.debugger.sendCommand(debuggerId,"Debugger.enable", { }, function() {
								chrome.debugger.sendCommand(debuggerId, "HeapProfiler.collectGarbage", { uid: uid }, function() {
									chrome.debugger.sendCommand(debuggerId, "HeapProfiler.getHeapSnapshot", { uid: uid }, function() {
										chrome.debugger.sendCommand(debuggerId,"Debugger.disable", { }, function() {
											chrome.debugger.onEvent.removeListener(listener);
											chrome.debugger.detach(debuggerId, function() {
												if(chrome.runtime.lastError) { console.error(chrome.runtime.lastError);  return;}
												sendResponse({uid: uid, illegal_strs: illegal_strs});
											});
											console.log("Took snapshot");
										});
									});
								});
							});
						}
						if(request.forbidden_tokens.length > 0) {
							if(method === "HeapProfiler.addHeapSnapshotChunk") {
								var chunk = params.chunk;
								snapshot_str += chunk;
							} else if(method === "HeapProfiler.finishHeapSnapshot") {
								var check_for_strings = request.forbidden_tokens;
								var cfslen = check_for_strings.length;

								var snapshot = JSON.parse(snapshot_str);
								var meta = snapshot.snapshot.meta;
								var strings = snapshot.strings;
								var	nodes = snapshot.nodes,
									edges = snapshot.edges,
									node_types = meta.node_types,
									node_types_0 = node_types[0],
									edge_types = meta.edge_types,
									edge_types_0 = edge_types[0],
									node_fields = meta.node_fields,
									node_field_len = node_fields.length,
									edge_fields = meta.edge_fields,
									edge_field_len = edge_fields.length;

								var edge_index = 0;
								var num_nodes = snapshot.snapshot.node_count;
								var cfs,to_node, i, node, j, edge_count, k, edge, edge_field_value, node_field_value, name;
								var computed_nodes = [];
								var bad_nodes = [];
								for(i = 0; i<num_nodes; i++) {
									node = computed_nodes[i] = {outgoing_edges: [], incoming_edges: []};
									for(j = 0; j<node_field_len; j++) {
										node_field_value = nodes[node_field_len * i + j]
										if(j === 0) {
											node[node_fields[j]] = node_types_0[node_field_value];
										} else if(j === 1) {
											node[node_fields[j]] = strings[node_field_value];
										} else {
											node[node_fields[j]] = node_field_value;
										}
									}
									edge_count = node.edge_count;
									for(j = 0; j<edge_count; j++) {
										edge = node.outgoing_edges[j] = {from_node: node};
										for(k = 0; k<edge_field_len; k++) {
											edge_field_value = edges[edge_index];
											if(k === 0) {
												edge[edge_fields[k]] = edge_types_0[edge_field_value];
											} else if(k === 1) {
												edge[edge_fields[k]] = strings[edge_field_value];
											} else {
												edge[edge_fields[k]] = edge_field_value;
											}

											edge_index++;
										}
									}
									if(node.type === "object") {
										name = node.name;
										for(j = 0; j<cfslen; j++) {
											cfs = check_for_strings[j];
											if(name.substring(0, cfs.length) === cfs) {
												illegal_strs = true;
												bad_nodes.push(node);
											}
										}
									}
								}
								for(i = 0; i<num_nodes; i++) {
									node = computed_nodes[i];
									edge_count = node.edge_count;
									for(j = 0; j<edge_count; j++) {
										edge = node.outgoing_edges[j];
										to_node = edge.to_node = computed_nodes[edge.to_node / node_field_len];

										edge.to_node.incoming_edges.push(edge);
									}
								}

								bad_nodes = null;

								chunk = check_for_strings = cfslen = snapshot = snapshot_str = meta = strings = nodes = edges = node_types = node_types_0 =
									edge_types = edge_types_0 = node_fields = node_fields_len = edge_fields = edge_fields_len = edge_index = num_nodes =
									cfs = i = node = j = edge_count = k = edge = edge_field_value = node_field_value = name = to_node = computed_nodes = null;
							}
						}
					}
				};
				chrome.debugger.onEvent.addListener(listener);
				chrome.debugger.sendCommand(debuggerId, "HeapProfiler.takeHeapSnapshot", { reportProgress: false }, function() {
					if(chrome.runtime.lastError) { console.error(chrome.runtime.lastError); }
				});
			});
		} else if(command === "clear_snapshots") {
			var debuggerId = {tabId: sender.tab.id};

			chrome.debugger.attach(debuggerId, "1.0", function() {
				if(chrome.runtime.lastError) { console.error(chrome.runtime.lastError); return; }
				chrome.debugger.sendCommand(debuggerId, "HeapProfiler.clearProfiles", { reportProgress: false }, function() {
					if(chrome.runtime.lastError) { console.error(chrome.runtime.lastError); }
					chrome.debugger.detach(debuggerId, function() {
						if(chrome.runtime.lastError) { console.error(chrome.runtime.lastError);  return;}
						sendResponse("done");
						console.log("Cleared Snapshots");
					});
				});
			});
		} else if(command === "ping") {
			var debuggerId = {tabId: sender.tab.id};

			chrome.debugger.attach(debuggerId, "1.0", function() {
				if(chrome.runtime.lastError) { console.error(chrome.runtime.lastError); }
				chrome.debugger.detach(debuggerId, function() {
					if(chrome.runtime.lastError) { console.error(chrome.runtime.lastError);  return;}
					sendResponse("ack");
				});
			});
		}
    }
});
