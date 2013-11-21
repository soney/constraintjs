	//
	// ============== CJS CORE ============== 
	//

	var Constraint, // Declare here, will be defined later
		ArrayConstraint,
		MapConstraint,
		is_constraint,
		is_array,
		is_map,
		cjs = function (arg0, arg1) { // The star of the show!
			// Utility function that will look at the type of the first argument an create the proper kind of value
			if(isArray(arg0)) {
				return new ArrayConstraint(extend({
					value: arg0
				}, arg1));
			} else if(isObject(arg0) && !isFunction(arg0)) {
				return new MapConstraint(extend({
					value: arg0
				}, arg1));
			} else {
				return new Constraint(arg0, arg1);
			}
		};

	cjs.version = "<%= version %>"; // This template will be filled in by the builder
	cjs.__debug = true;

	cjs.array_diff = get_array_diff; // expose these two useful functions
	cjs.map_diff = get_map_diff;

	if(has(root, "cjs")) { // If there was a previous cjs property...
		// ...then track it and allow cjs.noConflict to restore its previous value
		var old_cjs = root.cjs;
		cjs.noConflict = function() {
			root.cjs = old_cjs;
			return cjs; // and return a reference to cjs if the user wants it
		};
	} else {
		// ...otherwise, cjs.noConflict will just delete the old value
		cjs.noConflict = function() {
			delete root.cjs;
			return cjs;
		};
	}
	//
	// ============== CONSTRAINT SOLVER ============== 
	//
	//   Edge from A -> B means A sends data to B
	//   ---

	//   Constraint Solver: Implements constraint solving, as described in:
	//   Brad Vander Zanden, Brad A. Myers, Dario A. Giuse, and Pedro Szekely. 1994. Integrating pointer variables into one-way constraint models. ACM Trans. Comput.-Hum. Interact. 1, 2 (June 1994), 161-213. DOI=10.1145/180171.180174 http://doi.acm.org/10.1145/180171.180174

	var constraint_solver = {
		stack: [],	// Keeps track of the list of constraints that is currently being fetched. If constraint A is fetched while B is on the top of the stack
					// then A is added to the top of the stack and B is marked as dependent on A

		// node is the Constraint whose value we are fetching and auto_add_outgoing specifies whether dependencies FROM node should
		// be automatically added
		getValue: function (node, auto_add_outgoing) {
			var stack_len = this.stack.length;
			
			if (stack_len > 0) { // There's a constraint that's asking for my value
				// Let's call it demanding_var
				var demanding_var = this.stack[stack_len - 1];

				var dependency_edge = node._outEdges[demanding_var._id];
				// If there's already a dependency set up, mark it as still being used by setting its timestamp to the demanding
				// variable's timestamp 1 (because that variable's timestamp will be incrememted later on, so they will be equal)
				// 
				// Code in the this.nullify will check this timestamp and remove the dependency if it's out of date
				if(dependency_edge) {
					// Update timestamp
					dependency_edge.tstamp = demanding_var._tstamp + 1;
				} else {
					// Make sure that the dependency should be added
					if (node._options.auto_add_outgoing_dependencies !== false &&
							demanding_var._options.auto_add_incoming_dependencies !== false &&
							auto_add_outgoing !== false) {
						// and add it if it should
						node._outEdges[demanding_var._id] =
							demanding_var._inEdges[node._id] = {from: node, to: demanding_var, tstamp: demanding_var._tstamp + 1};
					}
				}
			}

			// If the node's cached value is invalid...
			if (!node._valid) {
				// Push node onto the stack to make it clear that it's being fetched
				this.stack[stack_len] = node;
				// Mark it as valid
				node._valid = true;
				if (node._options.cache_value !== false) {
					// Check if dynamic value. If it is, then call it. If not, just fetch it
					// set this to the node's cached value, which will be returned
					node._cached_value = isFunction(node._value) && !node._options.literal ? node._value.call(node._options.context) : node._value;
				} else if(isFunction(node._value)) {
					// if it's just a non-cached function call, just call the function
					node._value.call(node._options.context);
				}
				// Set the timestamp down here instead of before fetching in case a constraint depends on itself
				node._tstamp += 1;
				// Pop the item off the stack
				this.stack.length = stack_len;
			}

			return node._cached_value;
		},
		
		// Utility function to mark a listener as being in the call stack
		add_in_call_stack: function(nl) {
			nl.in_call_stack = true;
		},
		nullify: function(node) {
			// Unfortunately, running nullification listeners can, in some cases cause nullify to be indirectly called by itself
			// (as in while running nullify). The variable is_root will prevent another call to run_nullification_listeners at
			// the bottom of this function
			var i, outgoingEdges, toNodeID, invalid, curr_node, equals, old_value, new_value, changeListeners,
				to_nullify = [node],
				to_nullify_len = 1,
				is_root = this._is_nullifying !== true;

			if (is_root) {
				this._is_nullifying = true; // This variable is used to track is_root for any potential future calls
			}

			// Using a list instead of a recursive call because the call stack can get tal and annoying for debugging with
			// recursive calls
			for (i = 0; i < to_nullify_len; i+= 1) {
				curr_node = to_nullify[i]; // the constraint we are currently nullifying
				to_nullify[i] = false; // To save space, stop keeping track of the object (also useful for debugging occasionally)

				// We only care to nullify if the current node is actually valid
				if (curr_node._valid) {
					curr_node._valid = false; // Mark it as invalid...
					invalid = true;

					// The user can also optionally check if the node should be nullified. This is useful if a large number of nodes
					// depend on this node, and the potential cost of nullifying/re-evaluating them is higher than the cost of
					// re-evaluating this node
					if (curr_node._options.cache_value !== false && curr_node._options.check_on_nullify === true) {
						// Only mark as invalid if the old value is different from the current value.
						equals = curr_node._options.equals || eqeqeq;
						old_value = curr_node._cached_value;
						new_value = this.getValue(curr_node);

						if (equals(old_value, new_value)) {
							invalid = false;
						}
					}

					// If I'm still invalid, after a potential check
					if (invalid) {
						// Add all of the change listeners to the call stack, and mark each change listener
						// as being in the call stack
						changeListeners = curr_node._changeListeners;
						each(changeListeners, this.add_in_call_stack);
						this.nullified_call_stack.push.apply(this.nullified_call_stack, changeListeners);

						// Then, get every outgoing edge and add it to the nullify queue
						outgoingEdges = curr_node._outEdges;
						for (toNodeID in outgoingEdges) {
							if (has(outgoingEdges, toNodeID)) {
								var outgoingEdge = outgoingEdges[toNodeID];
								var dependentNode = outgoingEdge.to;

								// If the edge's timestamp is out of date, then this dependency isn't used
								// any more and remove it
								if (outgoingEdge.tstamp < dependentNode._tstamp) {
									delete curr_node._outEdges[toNodeID];
									delete dependentNode._inEdges[node._id];
								} else {
									// But if the dependency still is being used, then add it to the nullificaiton
									// queue
									to_nullify[to_nullify_len] = dependentNode;
									to_nullify_len += 1;
								}
							}
						}
					}
				}
			}

			// If I'm the first one, then runn the nullification listeners and remove the is_nullifying flag
			if (is_root) {
				// If nobody told us to wait, then run the nullification listeners
				if (this.semaphore >= 0 && this.nullified_call_stack.length > 0) {
					this.run_nullified_listeners();
				}
				delete this._is_nullifying;
			}
		},
		
		// Remove the edge going from fromNode to toNode
		removeDependency: function(fromNode, toNode) {
			delete fromNode._outEdges[toNode._id];
			delete toNode._inEdges[fromNode._id];
		},

		// Use a semaphore-like system to decide when running the nullification listeners is appropriate
		semaphore: 0,
		wait: function() {
			this.semaphore -= 1;
		},
		signal: function () {
			this.semaphore += 1;
			// When we signal that we're ready, try running the call stack
			if (this.semaphore >= 0 && this.nullified_call_stack.length > 0) {
				this.run_nullified_listeners();
			}
		},
		// The list of nullified listeners to run
		nullified_call_stack: [],
		// Tracks whether we are in the middle of running the nullification listeners
		running_listeners: false,
		// Clear all of the dependencies
		clearEdges: function(node, silent) {
			if(silent !== true) {
				this.wait();
			}
			var node_id = node._id;
			// Clear the incoming edges
			each(node._inEdges, function (edge, key) {
				var fromNode = edge.from;
				delete fromNode._outEdges[node_id];
				delete node._inEdges[key];
			});
			// and the outgoing edges
			each(node._outEdges, function (edge, key) {
				var toNode = edge.to;
				
				if (silent !== true) {
					constraint_solver.nullify(toNode);
				}
				delete toNode._inEdges[node_id];
				delete node._outEdges[key];
			});
			if(silent !== true) {
				this.signal();
			}
		},
		run_nullified_listeners: function () {
			var nullified_info, callback, context;
			// Make sure run_nullified_listeners isn't indirectly called by itself
			if (!this.running_listeners) {
				this.running_listeners = true;
				while (this.nullified_call_stack.length > 0) {
					nullified_info = this.nullified_call_stack.shift();
					callback = nullified_info.callback;
					context = nullified_info.context || this;

					nullified_info.in_call_stack = false;
					// If in debugging mode, then call the callback outside of a try statement
					if(cjs.__debug) {
						callback.apply(context, nullified_info.args);
					} else {
						try {
							// Call the nulification callback with any specified aguments
							callback.apply(context, nullified_info.args);
						} catch(e) {
							console_error(e);
						}
					}
				}
				this.running_listeners = false;
			}
		},
		remove_from_call_stack: function(info) {
			var i = 0, len = this.nullified_call_stack.length;
			for(; i < len ; i += 1) {
				if(this.nullified_call_stack[i] === info) {
					this.nullified_call_stack.splice(i, 1);
					return;
				}
			}
		}
	};

	//
	// ============== CORE CONSTRAINTS ============== 
	//
	Constraint = function (value, options) {
		/*
		 * == OPTION DEFAULTS ==
		 *
		 * literal: if 'value' is a function, the value of the constraint should be the function itself (not its return value)
		 * context: if 'value' is a function, the value of 'this', when that function is called 
		 * cache_value: whether or not to keep track of the current value, true by default
		 * equals: the function to check if two values are equal, === by default
		 * auto_add_outgoing_dependencies: allow the constraint solver to determine when things depend on me, true by default
		 * auto_add_incoming_dependencies: allow the constraint solver to determine when things I depend on thigns, true by default
		 * check_on_nullify: when nullified, check if my value has actually changed (requires immediately re-evaluating me), false by default
		 * run_on_add_listener: when onChange is called, whether or not immediately validate the value, true by default
		*/
		// These are all hidden values that should not be referred to directly
		this._options = extend({
			context: root
		}, options); // keeps track of the above options
		this._value = value; // Constant or a function
		this._id = uniqueId(); // different for every constraint, helps with optimizing speed
		this._outEdges = {}; // The nodes that depend on me, key is link to edge object (with properties toNode, fromNode=this)
		this._inEdges = {}; // The nodes that I depend on, key is link to edge object (with properties toNode=this, fromNode)
		this._changeListeners = []; // A list of callbacks that will be called when I'm nullified
		this._tstamp = 0; // Marks the last time I was updated

		if(this._options.literal || !isFunction(this._value)) { // We already have a value that doesn't need to be computed
			this._valid = true; // Tracks whether or not the cached value if valid
			this._cached_value = this._value; // Caches the node's value
		} else {
			this._valid = false;
			this._cached_value = undefined;
		}
	};

	(function(my) {
		var proto = my.prototype;

		// This function IS meant to be called directly. It asks the constraint solver for the value,
		// which in turn can be cached
		proto.get = function(auto_add_dependency) {
			return constraint_solver.getValue(this, auto_add_dependency);
		};

		// Change the value of the constraint
		proto.set = function (new_value, options) {
			var old_value = this._value;
			this._value = new_value;

			// If it's a value
			if (this._options.literal || !isFunction(new_value)) {
				// Then use the specified equality check
				var equality_check = this._options.equal || eqeqeq;
				if(!equality_check(old_value, new_value)) {
					// And nullify if they aren't equal
					constraint_solver.nullify(this);
				}
			} else if(old_value !== new_value) { // Otherwise, check function equality
				// And if they aren't the same function, nullify
				constraint_solver.nullify(this);
			}

			return this;
		};

		// Can pass in either a string and value or an object with multiple keys and values
		proto.setOption = function(arg0, arg1) {
			if(isString(arg0)) {
				this._options[arg0] = arg1;
			} else {
				extend(this._options, arg0);
			}
			// Nullify my value regardless of what changed
			// changing context, literal, etc. might change my value
			constraint_solver.nullify(this);
			return this;
		};

		// Mark myself as invalid
		proto.invalidate = function () {
			constraint_solver.nullify(this);
			return this;
		};

		// Removes every dependency to this node
		proto.remove = function (silent) {
			constraint_solver.clearEdges(this, silent);
			this._valid = false;			// In case it gets used in the future, make sure this constraint is marked as invalid
			this._cached_value = undefined; // and remove the cached value
			return this;
		};
		
		// Tries to clean up the constraint's allocated memory
		proto.destroy = function (silent) {
			each(this._changeListeners, function(cl) {
				// remove it from the call stack
				if (cl.in_call_stack) {
					constraint_solver.remove_from_call_stack(cl);
				}
			});
			this.remove(silent);
			this._options = {};
			this._changeListeners = [];
			return this;
		};

		// Calls 'callback' when my value has changed
		// context controls the value of 'this' when callback is being called and any number of additional
		// arguments can be passed in that will be passed as parameters to 'callback'
		
		proto.onChange = function(callback, context) {
			var args = slice.call(arguments, 2); // Additional arguments
			this._changeListeners.push({
				callback: callback, // function
				context: context, // 'this' when called
				args: slice.call(arguments, 2), // arguments to pass into the callback
				in_call_stack: false // for internal tracking; keeps track of if this function will be called in the near future
			});
			if(this._options.run_on_add_listener !== false) {
				this.get(false); // Make sure my current value is up to date but don't add outgoing constraints. That way, when it changes the callback will be called
			}
			return this;
		};
		
		// Undoes the effect of onChange, removes the listener. 'context' is optional here
		// only removes the last matching callback
		proto.offChange = function (callback, context) {
			var cl, i;
			for(i = this._changeListeners.length-1; i>=0; i-=1) {
				cl = this._changeListeners[i];
				// Same callback and either the same context or context wasn't specified
				if(cl.callback === callback && (!context || cl.context === context)) {
					// Then get rid of it
					this._changeListeners.splice(i, 1);
					// And remove it if it's in the callback
					if (cl.in_call_stack) {
						constraint_solver.remove_from_call_stack(cl);
					}
					// Only searching for the last one
					break;
				}
			}
			return this;
		};
	} (Constraint));



	// Create some exposed utility functions
	is_constraint = function(obj) {
		return obj instanceof Constraint;
	};
	cjs.is_constraint = is_constraint;
	cjs.Constraint = Constraint;

	cjs.constraint = function(value, options) {
		return new Constraint(value, options);
	};

	// Gets the value of an object regardless of if it's a constraint or not
	cjs.get = function (obj, arg0) {
		if(is_constraint(obj)) {
			return obj.get(arg0);
		} else if(is_array(obj)) {
			return obj.toArray();
		} else if(is_map(obj)) {
			return obj.toObject();
		} else {
			return obj;
		}
	};

	cjs.wait = bind(constraint_solver.wait, constraint_solver); // Wait tells the constraint solver to delay before running any onChange listeners
	cjs.signal = bind(constraint_solver.signal, constraint_solver); // Signal tells the constraint solver that it can run onChange listeners
	cjs.removeDependency = constraint_solver.removeDependency;
