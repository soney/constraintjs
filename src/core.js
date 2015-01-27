// ConstraintJS Core Functionality
// -------------------------------

var Constraint, // Declare here, will be defined later
	ArrayConstraint,
	MapConstraint,
	is_constraint,
	is_array,
	is_map,
	
	// Save the previous value of the `cjs` variable.
	old_cjs = root.cjs,
	/**
	 * `cjs` is ConstraintJS's only *visible* object; every other method an property is a property of `cjs`.
	 * The `cjs` object itself can also be called to create a constraint object.
	 *
	 * @method cjs
	 * @param {object} value - A map of initial values
	 * @param {object} options - A set of options to control how the array constraint is evaluated
	 * @return {cjs.ArrayConstraint} A new array constraint
	 * @see cjs.noConflict
	 *
	 * @example Creating an array constraint
	 *
	 *     var cjs_arr = cjs([1,2,3]);
	 *         cjs_arr.item(0); // 1
	 */

	/**
	 * Input value constraint
	 *
	 * @method cjs^2
	 * @param {dom} node - The DOM node whose value to follow
	 * @return {cjs.Binding} A constraint whose value is the current value of the input
	 *
	 * @example Creating an input value constraint
	 *
	 *     var inp_elem = document.getElementById('myTextInput'),
	 *         cjs_val = cjs(inp_elem);
	 */
	/**
	 * Create a map constraint
	 *
	 * @method cjs^3
	 * @param {object} value - A map of initial values
	 * @param {object} options - A set of options to control how the map constraint is evaluated
	 * @return {cjs.MapConstraint} A new map constraint
	 *
	 * @example Creating a map constraint
	 *
	 *     var cobj_obj = cjs({
	 *         foo: 1
	 *     });
	 *     cobj.get('foo'); // 1
	 *     cobj.put('bar', 2);
	 *     cobj.get('bar') // 2
	 */
	/**
	 * Create a standard constraint
	 *
	 * @method cjs^4
	 * @param {object} value - The constraint's value
	 * @param {object} options - A set of options to control how the constraint is evaluated
	 * @return {cjs.Constraint} A new constraint
	 * 
	 * @example Creating an empty constraint
	 *
	 *     var x = cjs(),
	 *         y = cjs(1),
	 *         z = cjs(function() {
	 *             return y.get() + 1;
	 *         });
	 *     x.get(); // undefined
	 *     y.get(); // 1
	 *     z.get(); // 2
	 *
	 * @example With options
	 *
	 *     var yes_lit = cjs(function() { return 1; },
	 *                         { literal: true }),
	 *     var not_lit = cjs(function() { return 1; },
	 *                         { literal: false });
	 *     yes_lit.get(); // (function)
	 *     not_lit.get(); // 1
	 */
	cjs = function (arg0, arg1) {
		if(isArray(arg0)) {
			return new ArrayConstraint(extend({
				value: arg0
			}, arg1));
		} else if(isPolyDOM(arg0)) {
			return cjs.inputValue(arg0);
		} else if(is_constraint(arg0)) {
			return new Constraint(arg0, arg1);
		} else if(isObject(arg0) && !isFunction(arg0)) {
			return new MapConstraint(extend({
				value: arg0
			}, arg1));
		} else {
			return new Constraint(arg0, arg1);
		}
	},
	get_constraint_val = function(x) {
		return is_constraint(x) ? x.get() : x;
	};

// Constraint Solver
// -----------------
// Implements constraint solving, as described in:
// [Integrating pointer variables into one-way constraint models](http://doi.acm.org/10.1145/180171.180174)

//   Edge from A -> B means A sends data to B

var constraint_solver = {
	// `stack` keeps track of the list of constraints that is currently being fetched. If constraint A is fetched while B is on the top of the stack
	// then A is added to the top of the stack and B is marked as dependent on A
	stack: [],

	check_on_nullified_ids: {},

	// node is the Constraint whose value we are fetching and auto_add_outgoing specifies whether dependencies FROM node should
	// be automatically added
	getValue: function (auto_add_outgoing, getter_arg) {
		var node = this,
			stack = constraint_solver.stack,
			stack_len = stack.length,
			demanding_var, dependency_edge, tstamp;
		
		if (stack_len > 0) { // There's a constraint that's asking for my value
			// Let's call it demanding_var
			demanding_var = stack[stack_len - 1];
			dependency_edge = node._outEdges[demanding_var._id];
			tstamp = demanding_var._tstamp+1;

			// If there's already a dependency set up, mark it as still being used by setting its timestamp to the demanding
			// variable's timestamp + `1` (because that variable's timestamp will be incrememted later on, so they will be equal)
			// 
			// Code in the this.nullify will check this timestamp and remove the dependency if it's out of date
			if(dependency_edge) {
				// Update timestamp
				dependency_edge.tstamp = tstamp;
			} else if(node !== demanding_var) {
				// Make sure that the dependency should be added
				if (node._options.auto_add_outgoing_dependencies !== false &&
						demanding_var._options.auto_add_incoming_dependencies !== false &&
						auto_add_outgoing !== false) {
					// and add it if it should
					node._outEdges[demanding_var._id] =
						demanding_var._inEdges[node._id] = {from: node, to: demanding_var, tstamp: tstamp};
				}
			}
		}

		// This node is waiting for an asyncronous value
		if(node._paused_info) {
			// So return its temporary value until then
			return node._paused_info.temporaryValue;
		} else if (!node._valid) {
			// If the node's cached value is invalid...
			// Set the timestamp before fetching in case a constraint depends on itself
			node._tstamp++;

			// Push node onto the stack to make it clear that it's being fetched
			stack[stack_len] = node;

			// Mark it as valid
			node._valid = true;

			if (node._options.cache_value !== false) {
				// Check if dynamic value. If it is, then call it. If not, just fetch it
				// set this to the node's cached value, which will be returned
				node._cached_value = node._options.literal ? node._value :
											(isFunction(node._value) ? node._value.call(node._options.context || node, node, getter_arg) :
																		get_constraint_val(node._value));

				// The node paused as if this was going to be an asyncronous value but it ended up being syncronous.
				// Use that to set the value
				if(node._sync_value) {
					node._cached_value = node._sync_value.value;
					delete node._sync_value;
				} else if(constraint_solver._paused_node && constraint_solver._paused_node.node === node) {
					// The node said it would have an asyncronous value and it did
					// Save the paused information to the node and remove it from the constraint solver
					node._paused_info = constraint_solver._paused_node;
					delete constraint_solver._paused_node;
					//Restore the stack to avoid adding a self-dependency
					stack.length = stack_len;
					// And return the temporary value
					return node._paused_info.temporaryValue;
				}
			} else if(isFunction(node._value)) {
				// if it's just a non-cached function call, just call the function
				node._value.call(node._options.context);
			}

			// Pop the item off the stack
			stack.length = stack_len;
		}

		return node._cached_value;
	},

	// Called when a constraint's getter is paused
	pauseNodeGetter: function(temporaryValue) {
		constraint_solver._paused_node = {
			temporaryValue: temporaryValue,
			node: this
		};
	},
	// Called when a constraint's getter is resumed
	resumeNodeGetter: function(value) {
		var node = this, old_stack;

		// Hey! The node said its value would be asyncronous but it ended up being syncronous
		// We know because, it paused and then resumed before the constraint solver's paused node information could even
		// be removed.
		if(constraint_solver._paused_node && constraint_solver._paused_node.node === node) {
			delete constraint_solver._paused_node;
			node._sync_value = { value: value };
		} else {
			// Nullify every dependent node and update this node's cached value
			old_stack = constraint_solver.stack;

			delete node._paused_info;
			node._tstamp++;
			node._valid = true;

			constraint_solver.stack = [node];

			if (node._options.cache_value !== false) {
				// Check if dynamic value. If it is, then call it. If not, just fetch it
				// set this to the node's cached value, which will be returned
				node._cached_value = node._options.literal ? value :
											(isFunction(value) ? value.call(node._options.context || node, node) :
																		cjs.get(value));
			} else if(isFunction(node._value)) {
				// if it's just a non-cached function call, just call the function
				value.call(node._options.context);
			}

			constraint_solver.nullify.apply(constraint_solver, map(node._outEdges, function(edge) {
				return edge.to;
			}));
			constraint_solver.stack = old_stack;
		}
	},
	
	// Utility function to mark a listener as being in the call stack. `this` refers to the constraint node here
	add_in_call_stack: function(nl) {
		var nl_priority = nl.priority;

		nl.in_call_stack++;
		nl.node._num_listeners_in_call_stack++;

		if(isNumber(nl_priority)) {
			var i = 0, len = this.nullified_call_stack.length, item, item_priority;
			while(i < len) {
				item = this.nullified_call_stack[i];
				if(item) {
					item_priority = item.priority;
					if(item_priority === false || item_priority < nl_priority) {
						this.nullified_call_stack.splice(i, 0, nl);
						return;
					}
				}
				i++;
			}
		}
		this.nullified_call_stack.push(nl);
	},
	nullify: function() {
		// Unfortunately, running nullification listeners can, in some cases cause nullify to be indirectly called by itself
		// (as in while running `nullify`). The variable is_root will prevent another call to `run_nullification_listeners` at
		// the bottom of this function
		var i, outgoingEdges, toNodeID, invalid, curr_node, equals, old_value, new_value, changeListeners,
			to_nullify = slice.call(arguments),
			to_nullify_len = to_nullify.length,
			is_root = !this._is_nullifying,curr_node_id;

		if (is_root) {
			// This variable is used to track `is_root` for any potential future calls
			this._is_nullifying = true;
		}

		// Using a list instead of a recursive call because the call stack can get tall and annoying for debugging with
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
				if (curr_node._options.cache_value !== false && curr_node._options.check_on_nullify === true &&
							// check to make sure we aren't already getting this node to avoid an infinite loop
							!this.check_on_nullified_ids[curr_node._id])  {
					this.check_on_nullified_ids[curr_node._id] = true;

					// Only mark as invalid if the old value is different from the current value.
					equals = curr_node._options.equals || eqeqeq;
					old_value = curr_node._cached_value;

					new_value = curr_node.get(undefined, true);
					if (equals(old_value, new_value)) {
						invalid = false;
					}
				}

				// If I'm still invalid, after a potential check
				if (invalid) {
					// Add all of the change listeners to the call stack, and mark each change listener
					// as being in the call stack
					changeListeners = curr_node._changeListeners;
					each(changeListeners, this.add_in_call_stack, this);

					// Then, get every outgoing edge and add it to the nullify queue
					outgoingEdges = curr_node._outEdges;
					curr_node_id = curr_node._id;
					for (toNodeID in outgoingEdges) {
						if (has(outgoingEdges, toNodeID)) {
							var outgoingEdge = outgoingEdges[toNodeID];
							var dependentNode = outgoingEdge.to;

							// If the edge's timestamp is out of date, then this dependency isn't used
							// any more and remove it
							if (outgoingEdge.tstamp < dependentNode._tstamp) {
								delete curr_node._outEdges[toNodeID];
								delete dependentNode._inEdges[curr_node_id];
							} else {
								// But if the dependency still is being used, then add it to the nullification
								// queue
								to_nullify[to_nullify_len] = dependentNode;
								to_nullify_len += 1;
							}
						}
					}
				}
			}
		}

		// If I'm the first one, then run the nullification listeners and remove the is_nullifying flag
		if (is_root) {
			this.check_on_nullified_ids = {};
			// If nobody told us to wait, then run the nullification listeners
			if (this.semaphore >= 0 && this.nullified_call_stack.length > 0) {
				this.run_nullified_listeners();
			}
			delete this._is_nullifying;
		}
	},
	
	/**
	 * 
	 * Remove the edge going from `fromNode` to `toNode`
	 * @method cjs.removeDependency
	 */
	removeDependency: function(fromNode, toNode) {
		delete fromNode._outEdges[toNode._id];
		delete toNode._inEdges[fromNode._id];
	},

	// Use a semaphore to decide when running the nullification listeners is appropriate
	semaphore: 0,

	/**
	 * Tells the constraint solver to delay before running any `onChange` listeners
	 *
	 * Note that `signal` needs to be called the same number of times as `wait` before
	 * the `onChange` listeners will run.
	 * @method cjs.wait
	 * @see cjs.signal
	 * @see cjs.onChange
	 * @example
	 *     var x = cjs(1);
	 *     x.onChange(function() {
	 *         console.log('x changed');
	 *     });
	 *     cjs.wait();
	 *     x.set(2);
	 *     x.set(3);
	 *     cjs.signal(); // output: x changed
	 */
	wait: function() {
		this.semaphore -= 1;
	},
	/**
	 * Tells the constraint solver it is ready to run any `onChange` listeners.
	 * Note that `signal` needs to be called the same number of times as `wait` before
	 * the `onChange` listeners will run.
	 * @method cjs.signal
	 * @see cjs.wait
	 * @see cjs.onChange
	 * @example
	 *     var x = cjs(1);
	 *     x.onChange(function() {
	 *         console.log('x changed');
	 *     });
	 *     cjs.wait();
	 *     cjs.wait();
	 *     x.set(2);
	 *     x.set(3);
	 *     cjs.signal();
	 *     cjs.signal(); // output: x changed
	 */
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
		var loud = silent !== true,
			node_id = node._id,
			edge, key, inEdges = node._inEdges,
			outEdges = node._outEdges;

		if(loud) { this.wait(); }

		// Clear the incoming edges
		for(key in inEdges) {
			if(has(inEdges, key)) {
				delete inEdges[key].from._outEdges[node_id];
				delete inEdges[key];
			}
		}

		// and the outgoing edges
		for(key in outEdges) {
			if(has(outEdges, key)) {
				var toNode = outEdges[key].to;
				if (loud) { constraint_solver.nullify(toNode); }
				
				delete toNode._inEdges[node_id];
				delete outEdges[key];
			}
		}

		if(loud) { this.signal(); }
	},
	run_nullified_listeners: function () {
		var nullified_info, callback, context;
		// Make sure `run_nullified_listeners` isn't indirectly called by itself
		if (!this.running_listeners) {
			this.running_listeners = true;
			while (this.nullified_call_stack.length > 0) {
				nullified_info = this.nullified_call_stack.shift();
				callback = nullified_info.callback;
				context = nullified_info.context || root;

				nullified_info.in_call_stack--;
				nullified_info.node._num_listeners_in_call_stack--;
				// If in debugging mode, then call the callback outside of a `try` statement
				if(cjs.__debug) {
					callback.apply(context, nullified_info.args);
				} else {
					try {
						// Call the nullification callback with any specified arguments
						callback.apply(context, nullified_info.args);
					} catch(e) {
						if(has(root, "console")) {
							root.console.error(e);
						}
					}
				}
			}
			this.running_listeners = false;
		}
	},
	remove_from_call_stack: function(info) {
		while(info.in_call_stack > 0) {
			remove(this.nullified_call_stack, info);
			info.in_call_stack--;
			info.node._num_listeners_in_call_stack--;
		}
	}
};

// Constraint Variables
// --------------------

/**
 * ***Note***: The preferred way to create a constraint is with the `cjs.constraint` function (lower-case 'c')
 * `cjs.Constraint` is the constructor for the base constraint. Valid properties for `options` are:
 *
 * - `auto_add_outgoing_dependencies`: allow the constraint solver to determine when things depend on me. *default:* `true`
 * - `auto_add_incoming_dependencies`: allow the constraint solver to determine when things I depend on things. *default:* `true`
 * - `cache_value`: whether or not to keep track of the current value. *default:* `true`
 * - `check_on_nullify`: when nullified, check if my value has actually changed (requires immediately re-evaluating me). *default*: `false`
 * - `context`: if `value` is a function, the value of `this`, when that function is called. *default:* `window`
 * - `equals`: the function to check if two values are equal, *default:* `===`
 * - `literal`: if `value` is a function, the value of the constraint should be the function itself (not its return value). *default:* `false`
 * - `run_on_add_listener`: when `onChange` is called, whether or not immediately validate the value. *default:* `true`
 *
 * @class cjs.Constraint
 * @classdesc A constraint object communicates with the constraint solver to store and maintain constraint values
 * @param {*} value - The initial value of the constraint or a function to compute its value
 * @param {Object} [options] - A set of options to control how and when the constraint's value is evaluated:
 */
Constraint = function (value, options) {
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
	this._num_listeners_in_call_stack = 0; // the number of listeners that are in the call stack

	if(this._options.literal || (!isFunction(this._value) && !is_constraint(this._value))) {
		// We already have a value that doesn't need to be computed
		this._valid = true; // Tracks whether or not the cached value if valid
		this._cached_value = this._value; // Caches the node's value
	} else {
		this._valid = false;
		this._cached_value = undefined;
	}
};

(function(My) {
	var proto = My.prototype;
	/** @lends cjs.Constraint.prototype */

	/**
	 * Get the current value of this constraint. For computed constraints, if the constraint is invalid, its value will be re-computed.
	 *
	 *
	 * @method get
	 * @param {boolean} [autoAddOutgoing=true] - Whether to automatically add a dependency from this constraint to ones that depend on it.
	 * @return {*} The current constraint value
	 * @see set
	 *
	 * @example
	 *     var x = cjs(1);
	 *     x.get(); // 1
	 */
	proto.get = constraint_solver.getValue;

	/**
	 * Change the current value of the constraint. Other constraints that depend on its value will be invalidated.
	 *
	 * @method set
	 * @see cjs.Constraint
	 * @param {*} value - The initial value of the constraint or a function to compute its value
	 * @param {Object} [options] - A set of options to control how and when the constraint's value is evaluated:
	 * @return {cjs.Constraint} - `this`
	 * @see get
	 * @see invalidate
	 *
	 * @example
	 *    var x = cjs(1);
	 *    x.get(); // 1
	 *    x.set(function() { return 2; });
	 *    x.get(); // 2
	 *    x.set('c');
	 *    x.get(); // 'c'
	 */
	proto.set = function (value, options) {
		var old_value = this._value;
		this._value = value;

		if(options && options.silent === true) {
			return this;
		} else if (this._options.literal || (!isFunction(value) && !is_constraint(value))) {
 // If it's a value
			// Then use the specified equality check
			var equality_check = this._options.equal || eqeqeq;
			if(!equality_check(old_value, value)) {
				// And nullify if they aren't equal
				constraint_solver.nullify(this);
			}
		} else if(old_value !== value) { // Otherwise, check function equality
			// And if they aren't the same function, nullify
			constraint_solver.nullify(this);
		}

		return this;
	};

	/**
	 * Change how this constraint is computed (see Constraint options)
	 *
	 * @method setOption
	 * @see cjs.Constraint
	 * @param {Object} options - An object with the options to change
	 * @return {cjs.Constraint} - `this`
	 *
	 * @example
	 *     var x = cjs(function() { return 1; });
	 *     x.get(); // 1
	 *     x.setOption({
	 *         literal: true,
	 *         auto_add_outgoing_dependencies: false
	 *     });
	 *     x.get(); // (function)
	 */
	/**
	 * @method setOption^2
	 * @see cjs.Constraint
	 * @param {String} key - The name of the option to set
	 * @param {*} value - The option's new value
	 * @return {cjs.Constraint} - `this`
	 *
	 * @example
	 *     var x = cjs(function() { return 1; });
	 *     x.get(); // 1
	 *     x.setOption("literal", true);
	 *     x.get(); // (function)
	 */
	var invalidation_arguments = ["context", "literal"];
	proto.setOption = function(arg0, arg1) {
		var to_invalidate;
		if(isString(arg0)) {
			this._options[arg0] = arg1;
			to_invalidate = indexOf(invalidation_arguments, arg0) >= 0;
		} else {
			var keys = keys(arg0);
			extend(this._options, arg0);
			to_invalidate = any(invalidation_arguments, function(ia) {
				return keys.indexOf(ia) >= 0;
			});
		}

		// Nullify my value regardless of what changed
		// changing context, literal, etc. might change my value
		return to_invalidate ? this.invalidate() : this;
	};

	/**
	 * Mark this constraint's value as invalid. This signals that the next time its value is fetched,
	 * it should be recomputed, rather than returning the cached value.
	 *
	 * An invalid constraint's value is only updated when it is next requested (for example, via `.get()`).
	 *
	 * @method invalidate
	 * @return {cjs.Constraint} - `this`
	 * @see isValid
	 *
	 * @example Tracking the window height
	 *     var height = cjs(window.innerHeight);
	 *     window.addEventListener("resize", function() {
	 *         height.invalidate();
	 *     });
	 */
	proto.invalidate = function () {
		constraint_solver.nullify(this);
		return this;
	};

	/**
	 * Find out if this constraint's value needs to be recomputed (i.e. whether it's invalid).
	 *
	 * An invalid constraint's value is only updated when it is next requested (for example, via `.get()`).
	 *
	 * @method isValid
	 * @return {boolean} - `true` if this constraint's current value is valid. `false` otherwise.
	 * @see invalidate
	 *
	 * @example
	 *     var x = cjs(1),
	 *         y = x.add(2);
	 *     y.get();     // 3
	 *     y.isValid(); // true
	 *     x.set(2);
	 *     y.isValid(); // false
	 *     y.get();     // 4
	 *     y.isValid(); //true
	 */
	proto.isValid = function () {
		return this._valid;
	};

	/**
	 * Removes every dependency to this node
	 *
	 * @method remove
	 * @param {boolean} [silent=false] - If set to `true`, avoids invalidating any dependent constraints.
	 * @return {cjs.Constraint} - `this`
	 * @see destroy
	 */
	proto.remove = function (silent) {
		constraint_solver.clearEdges(this, silent);
		this._valid = false;			// In case it gets used in the future, make sure this constraint is marked as invalid
		this._cached_value = undefined; // and remove the cached value
		return this;
	};
	
	/**
	 * Removes any dependent constraint, clears this constraints options, and removes every change listener. This is
	 * useful for making sure no memory is deallocated
	 *
	 * @method destroy
	 * @param {boolean} [silent=false] - If set to `true`, avoids invalidating any dependent constraints.
	 * @return {cjs.Constraint} - `this`
	 * @see remove
	 *
	 * @example
	 *     var x = cjs(1);
	 *     x.destroy(); // ...x is no longer needed
	 */
	proto.destroy = function (silent) {
		if(this._num_listeners_in_call_stack > 0) {
			each(this._changeListeners, function(cl) {
				// remove it from the call stack
				if (cl.in_call_stack>0) {
					constraint_solver.remove_from_call_stack(cl);
					if(this._num_listeners_in_call_stack === 0) {
						return breaker;
					}
				}
			}, this);
		}
		this.remove(silent);
		this._changeListeners = [];
		return this;
	};

	/**
	 * Signal that this constraint's value will be computed later. For instance, for asyncronous values.
	 *
	 * @method pauseGetter
	 * @param {*} temporaryValue - The temporary value to use for this node until it is resumed
	 * @return {cjs.Constraint} - `this`
	 * @see resumeGetter
	 */
	proto.pauseGetter  = function () {
		constraint_solver.pauseNodeGetter.apply(this, arguments);
		return this;
	};
	/**
	 * Signal that this Constraint, which has been paused with `pauseGetter` now has a value.
	 *
	 * @method resumeGetter
	 * @param {*} value - This node's value
	 * @return {cjs.Constraint} - `this`
	 * @see pauseGetter
	 *
	 */
	proto.resumeGetter = function () {
		constraint_solver.resumeNodeGetter.apply(this, arguments);
		return this;
	};

	/**
	 * Call `callback` as soon as this constraint's value is invalidated. Note that if the constraint's value
	 * is invalidated multiple times, `callback` is only called once.
	 *
	 * @method onChange
	 * @param {function} callback
	 * @param {*} [thisArg=window] - The context to use for `callback`
	 * @param {*} ...args - The first `args.length` arguments to `callback`
	 * @return {cjs.Constraint} - `this`
	 * @see offChange
	 *
	 * @example
	 *     var x = cjs(1);
	 *     x.onChange(function() {
	 *         console.log("x is " + x.get());
	 *     });
	 *     x.set(2); // x is 2
	 */
	proto.onChange = function(callback, thisArg) {
		return this.onChangeWithPriority.apply(this, ([false]).concat(toArray(arguments)));
	};
	proto.onChangeWithPriority = function(priority, callback, thisArg) {
		var args = slice.call(arguments, 3); // Additional arguments
		if(!isNumber(priority)) {
			priority = false;
		}
		this._changeListeners.push({
			callback: callback, // function
			context: thisArg, // 'this' when called
			args: args, // arguments to pass into the callback
			in_call_stack: 0, // internally keeps track of if this function will be called in the near future
			node: this,
			priority: priority
		});
		if(this._options.run_on_add_listener !== false) {
			// Make sure my current value is up to date but don't add outgoing constraints.
			// That way, when it changes the callback will be called
			this.get(false);
		}
		return this;
	};
	
	/**
	 * Removes the first listener to `callback` that was created by `onChange`. `thisArg` is optional and
	 * if specified, it only removes listeners within the same context. If thisArg is not specified,
	 * the first `callback` is removed. 
	 *
	 * @method offChange
	 * @param {function} callback
	 * @param {*} [thisArg] - If specified, only remove listeners that were added with this context
	 * @return {cjs.Constraint} - `this`
	 * @see onChange
	 *
	 *     var x = cjs(1),
	 *         callback = function(){};
	 *     x.onChange(callback);
	 *     // ...
	 *     x.offChange(callback);
	 */
	proto.offChange = function (callback, thisArg) {
		var cl, i;
		for(i = this._changeListeners.length-1; i>=0; i-=1) {
			cl = this._changeListeners[i];
			// Same callback and either the same context or context wasn't specified
			if(cl.callback === callback && (!thisArg || cl.context === thisArg)) {
				// Then get rid of it
				removeIndex(this._changeListeners, i);
				// And remove it if it's in the callback
				if (cl.in_call_stack>0) {
					constraint_solver.remove_from_call_stack(cl);
				}
				delete cl.node;
				// Only searching for the last one
				break;
			}
		}
		return this;
	};

	/**
	 * Change this constraint's value in different states
	 *
	 * @method inFSM
	 * @param {cjs.FSM} fsm - The finite-state machine to depend on
	 * @param {Object} values - Keys are the state specifications for the FSM, values are the value for those specific states
	 * @return {cjs.Constraint} - `this`
	 *
	 * @example
	 *     var fsm = cjs.fsm("state1", "state2")
	 *                  .addTransition("state1", "state2",
	 *                        cjs.on("click"));
	 *     var x = cjs().inFSM(fsm, {
	 *         state1: 'val1',
	 *         state2: function() { return 'val2'; }
	 *     });
	 */
	proto.inFSM = function(fsm, values) {
		each(values, function(v, k) {
			// add listeners to the fsm for that state that will set my getter's value
			fsm.on(k, function() {
				this.set(v);
			}, this);

			if(fsm.is(k)) {
				this.set(v);
			}
		}, this);
		
		return this;
	};

	/**
	 * Returns the last value in the array `[this].concat(args)` if every value is truthy. Otherwise, returns `false`.
	 * Every argument won't necessarily be evaluated. For instance:
	 *
	 * - `x = cjs(false); cjs.get(x.and(a))` does not evaluate `a`
	 *
	 * @method and
	 * @param {*} ...args - Any number of constraints or values to pass the "and" test
	 * @return {cjs.Constraitnboolean|*} - A constraint whose value is `false` if this or any passed in value is falsy. Otherwise, the last value passed in.
	 *
	 * @example
	 *
	 *     var x = c1.and(c2, c3, true);
	 */
	proto.and = function() {
		var args = ([this]).concat(toArray(arguments)),
			len = args.length;

		return new My(function() {
			var i = 0, val;
			for(;i<len; i++) {
				// If any value is falsy, return false
				if(!(val = cjs.get(args[i]))) {
					return false;
				}
			}
			// Otherwise, return the last value fetched
			return val;
		});
	};

	/**
	 * Inline if function: similar to the javascript a ? b : c expression
	 *
	 * @method iif
	 * @param {*} true_val - The value to return if `this` is truthy
	 * @param {*} other_val - The value to return if `this` is falsy
	 * @return {cjs.Constraint} - A constraint whose value is `false` if this or any passed in value is falsy. Otherwise, the last value passed in.
	 *
	 * @example
	 *
	 *     var x = is_selected.iif(selected_val, nonselected_val);
	 */
	proto.iif = function(true_val, other_val) {
		var me = this;
		return new My(function() {
			return me.get() ? cjs.get(true_val) : cjs.get(other_val);
		});
	};

	/**
	 * Returns the first truthy value in the array `[this].concat(args)`. If no value is truthy, returns `false`.
	 * Every argument won't necessarily be evaluated. For instance:
	 *
	 * - `y = cjs(true); cjs.get(y.or(b))` does not evaluate `b`
	 *
	 * @method or
	 * @param {*} ...args - Any number of constraints or values to pass the "or" test
	 * @return {cjs.Constraint} - A constraitn whose value is the first truthy value or `false` if there aren't any
	 *
	 * @example
	 *
	 *     var x = c1.or(c2, c3, false);
	 */
	proto.or = function() {
		var args = ([this]).concat(toArray(arguments)),
			len = args.length;

		return new My(function() {
			var i = 0, val;
			for(;i<len; i++) {
				// Return the first value (including this) that is truthy
				if((val = cjs.get(args[i]))) {
					return val;
				}
			}
			//Nothing was truthy, so return false
			return false;
		});
	};

	/**
	 * @ignore
	 * Creates a new function that takes in any number of arguments and creates a constraint whose result
	 * is calling `modifier_fn` on `this` plus every argument
	 */
	var createConstraintModifier = function(modifier_fn) {
		return function() {
			var args = ([this]).concat(toArray(arguments));
			return new My(function() {
				return modifier_fn.apply(this, map(args, cjs.get));
			});
		};
	};

	var get_prop = function(a, b) { return a ? a[b] : undefined; };
	/**
	 * Property constraint modifier.
	 *
	 * @method prop
	 * @param {strings} ...args - Any number of properties to fetch
	 * @return {*} - A constraint whose value is `this[args[0]][args[1]]...`
	 * @example
	 * 
	 *     w = x.prop("y", "z"); // means w <- x.y.z
	 */
	proto.prop = createConstraintModifier(function(me) { return reduce(rest(arguments), get_prop, me); });

	/**
	 * Integer conversion constraint modifier.
	 * @method toInt
	 * @return {*} - A constrant whose value is parseInt(this)
	 * @example Given `<input />` element `inp_elem`
	 *
	 *     var inp_val = cjs(inp_elem).toInt();
	 */
	proto.toInt = createConstraintModifier(function(me) { return parseInt.apply(this, arguments); });

	/**
	 * Float conversion constraint modifier.
	 * @method toFloat
	 * @return {*} - A constraint whose value is parseFloat(this)
	 * @example Given `<input />` element `inp_elem`
	 *
	 *     var inp_val = cjs(inp_elem).toFloat();
	 */
	proto.toFloat = createConstraintModifier(function(me) { return parseFloat.apply(this, arguments); });

	// For all the arithmetic operators, allow any number of arguments to be passed in. For example:
	/**
	 * Addition constraint modifier
	 * @method add
	 * @param {number} ...args - Any number of constraints or numbers
	 * @return {number} - A constraint whose value is `this.get() + args[0].get() + args[1].get() + ...`
	 * @example
	 *
	 *     x = y.add(1,2,z); // x <- y + 1 + 2 + z
	 * @example The same method can also be used to add units to values
	 *
	 *     x = y.add("px"); // x <- ypx
	 */
	proto.add = createConstraintModifier(function() { return reduce(arguments, binary_operators["+"], 0); });
	/**
	 * Subtraction constraint modifier
	 * @method sub
	 * @param {number} ...args - Any number of constraints or numbers
	 * @return {number} - A constraint whose value is `this.get() - args[0].get() - args[1].get() - ...`
	 * @example
	 *
	 *     x = y.sub(1,2,z); // x <- y - 1 - 2 - z
	 */
	proto.sub = createConstraintModifier(function(me) { return reduce(rest(arguments), binary_operators["-"], me); });
	/**
	 * Multiplication constraint modifier
	 * @method mul
	 * @param {number} ...args - Any number of constraints or numbers
	 * @return {number} - A constraint whose value is `this.get() * args[0].get() * args[1].get() * ...`
	 * @example
	 *
	 *     x = y.mul(1,2,z); //x <- y * 1 * 2 * z
	 */
	proto.mul = createConstraintModifier(function(me) { return reduce(rest(arguments), binary_operators["*"], me); });
	/**
	 * Division constraint modifier
	 * @method div
	 * @param {number} ...args - Any number of constraints or numbers
	 * @return {number} - A constraint whose value is `this.get() / args[0].get() / args[1].get() / ...`
	 * @example
	 *
	 *     x = y.div(1,2,z); // x <- y / 1 / 2 / z
	 */
	proto.div = createConstraintModifier(function(me) { return reduce(rest(arguments), binary_operators["/"], me); });

	/**
	 * Absolute value constraint modifier
	 * @method abs
	 * @return {number} - A constraint whose value is `Math.abs(this.get())`
	 * @example
	 *
	 *     x = c1.abs(); // x <- abs(c1)
	 */
	/**
	 * Floor
	 * @method floor
	 * @return {number} - A constraint whose value is `Math.floor(this.get())`
	 * @example
	 *
	 *     x = c1.floor(); // x <- floor(c1)
	 */
	/**
	 * Ceil
	 * @method ceil
	 * @return {number} - A constraint whose value is `Math.ceil(this.get())`
	 * @example
	 *
	 *     x = c1.ceil(); // x <- ceil(c1)
	 */
	/**
	 * Round
	 * @method round
	 * @return {number} - A constraint whose value is `Math.round(this.get())`
	 * @example
	 *
	 *     x = c1.round(); // x <- round(c1)
	 */
	/**
	 * Square root
	 * @method sqrt
	 * @return {number} - A constraint whose value is `Math.sqrt(this.get())`
	 * @example
	 *
	 *     x = c1.sqrt(); // x <- sqrt(c1)
	 */
	/**
	 * Arccosine
	 * @method acos
	 * @return {number} - A constraint whose value is `Math.acos(this.get())`
	 * @example
	 *
	 *     angle = r.div(x).acos()
	 */
	/**
	 * Arcsin
	 * @method asin
	 * @return {number} - A constraint whose value is `Math.asin(this.get())`
	 * @example
	 *
	 *     angle = r.div(y).asin()
	 */
	/**
	 * Arctan
	 * @method atan
	 * @return {number} - A constraint whose value is `Math.atan(this.get())`
	 * @example
	 *
	 *     angle = y.div(x).atan()
	 */
	/**
	 * Arctan2
	 * @method atan2
	 * @param {number|cjs.Constraint} x
	 * @return {number} - A constraint whose value is `Math.atan2(this.get()/x.get())`
	 * @example
	 *
	 *     angle = y.atan2(x)
	 */
	/**
	 * Cosine
	 * @method cos
	 * @return {number} - A constraint whose value is `Math.cos(this.get())`
	 * @example
	 *
	 *     dx = r.mul(angle.cos())
	 */
	/**
	 * Sine
	 * @method sin
	 * @return {number} - A constraint whose value is `Math.sin(this.get())`
	 * @example
	 *
	 *     dy = r.mul(angle.sin())
	 */
	/**
	 * Tangent
	 * @method tan
	 * @return {number} - A constraint whose value is `Math.tan(this.get())`
	 * @example
	 *
	 *     dy = r.mul(angle.sin())
	 */
	/**
	 * Max
	 * @method max
	 * @param {number} ...args - Any number of constraints or numbers
	 * @return {number} - A constraint whose value is the **highest** of `this.get()`, `args[0].get()`, `args[1].get()`...
	 * @example
	 *
	 *     val = val1.max(val2, val3);
	 */
	/**
	 * Min
	 * @method min
	 * @param {number} ...args - Any number of constraints or numbers
	 * @return {number} - A constraint whose value is the **lowest** of `this.get()`, `args[0].get()`, `args[1].get()`...
	 * @example
	 *
	 *     val = val1.min(val2, val3);
	 */
	/**
	 * Power
	 * @method pow
	 * @param {number} x - The exponent
	 * @return {number} - A constraint whose value is `Math.pow(this.get(), x.get())`
	 * @example
	 *
	 *     d = dx.pow(2).add(dy.pow(2)).sqrt()
	 */
	/**
	 * Natural Log (base e)
	 * @method log
	 * @return {number} - A constraint whose value is `Math.log(this.get())`
	 * @example
	 *
	 *     num_digits = num.max(2).log().div(Math.log(10)).ceil()
	 */
	/**
	 * Exp (E^x)
	 * @method exp
	 * @return {number} - A constraint whose value is `Math.exp(this.get())`
	 * @example
	 *
	 *     neg_1 = cjs(i*pi).exp()
	 */
	each(["abs", "acos", "asin", "atan", "atan2", "cos", "max", "min", "sin", "tan",
			"pow", "round", "floor", "ceil", "sqrt", "log", "exp"], function(op_name) {
		proto[op_name] = createConstraintModifier(bind(Math[op_name], Math));
	});

	/**
	 * Coerce an object to a number
	 * @method pos
	 * @return {number} - A constraint whose value is `+(this.get())`
	 * @example
	 *
	 *     numeric_val = val.pos()
	 */
	/**
	 * Negative operator
	 * @method neg
	 * @return {number} - A constraint whose value is `-(this.get())`
	 * @example
	 *
	 *     neg_val = x.neg()
	 */
	/**
	 * Not operator
	 * @method not
	 * @return {boolean} - A constraint whose value is `!(this.get())`
	 * @example
	 *
	 *     opposite = x.not()
	 */
	/**
	 * Bitwise not operator
	 * @method bitwiseNot
	 * @return {number} - A constraint whose value is `~(this.get())`
	 * @example
	 *
	 *     inverseBits = val.bitwiseNot()
	 */
	/**
	 * Equals unary operator
	 * @method eq
	 * @param {*} other - A constraint or value to compare against
	 * @return {boolean} - A constraint whose value is `this.get() == other.get()`
	 *
	 * @example
	 *
	 *     isNull = val.eq(null)
	 */
	/**
	 * Not equals operator
	 * @method neq
	 * @param {*} other - A constraint or value to compare against
	 * @return {boolean} - A constraint whose value is `this.get() != other.get()`
	 *
	 * @example
	 *
	 *     notNull = val.neq(null)
	 */
	/**
	 * Strict equals operator
	 * @method eqStrict
	 * @param {*} other - A constraint or value to compare against
	 * @return {boolean} - A constraint whose value is `this.get() === other.get()`
	 *
	 * @example
	 *
	 *     isOne = val.eqStrict(1)
	 */
	/**
	 * Not strict equals binary operator
	 * @method neqStrict
	 * @param {*} other - A constraint or value to compare against
	 * @return {boolean} - A constraint whose value is `this.get() !== other.get()`
	 *
	 * @example
	 *
	 *     notOne = val.neqStrict(1)
	 */
	/**
	 * @method gt
	 * @param {*} other - A constraint or value to compare against
	 * @return {boolean} - A constraint whose value is `this.get() > other.get()`
	 *
	 * @example
	 *
	 *     isPositive = val.gt(0)
	 */
	/**
	 * @method lt
	 * @param {*} other - A constraint or value to compare against
	 * @return {boolean} - A constraint whose value is `this.get() < other.get()`
	 * 
	 * @example
	 *
	 *     isNegative = val.lt(0)
	 */
	/**
	 * @method ge
	 * @param {*} other - A constraint or value to compare against
	 * @return {boolean} - A constraint whose value is `this.get() >= other.get()`
	 *
	 * @example
	 *
	 *     isBig = val.ge(100)
	 */
	/**
	 * @method le
	 * @param {*} other - A constraint or value to compare against
	 * @return {boolean} - A constraint whose value is `this.get() <= other.get()`
	 *
	 * @example
	 *
	 *     isSmall = val.le(100)
	 */
	/**
	 * @method xor
	 * @param {*} other - A constraint or value to compare against
	 * @return {number} - A constraint whose value is `this.get() ^ other.get()`
	 */
	/**
	 * @method bitwiseAnd
	 * @param {*} other - A constraint or value to compare against
	 * @return {number} - A constraint whose value is `this.get() & other.get()`
	 */
	/**
	 * @method bitwiseOr
	 * @param {*} other - A constraint or value to compare against
	 * @return {number} - A constraint whose value is `this.get() | other.get()`
	 */
	/**
	 * @method mod
	 * @param {*} other - A constraint or value to compare against
	 * @return {number} - A constraint whose value is `this.get() % other.get()`
	 * @example
	 *		isEven = x.mod(2).eq(0);
	 *
	 */
	/**
	 * @method rightShift
	 * @param {*} other - A constraint or value to compare against
	 * @return {number} - A constraint whose value is `this.get() >> other.get()`
	 */
	/**
	 * @method leftShift
	 * @param {*} other - A constraint or value to compare against
	 * @return {number} - A constraint whose value is `this.get() << other.get()`
	 */
	/**
	 * @method unsignedRightShift
	 * @param {*} other - A constraint or value to compare against
	 * @return {number} - A constraint whose value is `this.get() >>> other.get()`
	 */
	each({
		u: { // Unary operators
			pos: "+", neg: "-", not: "!", bitwiseNot: "~"
		},
		bi: { // Binary operators
			eqStrict: "===",neqStrict:  "!==",	eq:        "==",neq: "!=",
			gt:      ">",	ge:         ">=",	lt:        "<",	le: "<=",
			xor:     "^",	bitwiseAnd: "&",	bitwiseOr: "|",	mod: "%",
			rightShift:">>",leftShift:  "<<",	unsignedRightShift: ">>>"
		}
	},	function(ops, operator_prefix) {
		var op_list = operator_prefix === "u" ? unary_operators : binary_operators;
		each(ops, function(key, op_name) {
			proto[op_name] = createConstraintModifier(op_list[key]);
		});
	});

	/**
	 * Object type modifier
	 * @method typeOf
	 * @param {*} other - a constraint or value to compare against
	 * @return {*} - a constraint whose value is `typeof this.get()`
	 * @example
	 *
	 *     var valIsNumber = val.typeOf().eq('[object Number]')
	 */
	proto.typeOf = createConstraintModifier(function(a) { return typeof a;});

	/**
	 * Object instance check modifier
	 * @method instanceOf
	 * @param {*} other - a constraint or value to compare against
	 * @return {boolean} - a constraint whose value is `this.get() instanceof other.get()`
	 * @example
	 *
	 *     var valIsArray = val.instanceof(Array)
	 */
	proto.instanceOf = createConstraintModifier(function(a, b) { return a instanceof b;});

} (Constraint));
/** @lends */

// Create some exposed utility functions
/**
 * Determine whether an object is a constraint
 * @method cjs.isConstraint
 * @param {*} obj - An object to check
 * @return {boolean} - `obj instanceof cjs.Constraint`
 */
is_constraint = function(obj) { return obj instanceof Constraint; };

// Expore core functions
// -------------------------
extend(cjs, {
	/**
	 * Constraint constructor
	 *
	 * @method cjs.constraint
	 * @constructs cjs.Constraint
	 * @param {*} value - The initial value of the constraint or a function to compute its value
	 * @param {Object} [options] - A set of options to control how and when the constraint's value is evaluated
	 * @return {cjs.Constraint} - A new constraint object
	 * @see cjs.Constraint
	 */
	constraint: function(value, options) { return new Constraint(value, options); },
	/** @expose cjs.Constraint */
	Constraint: Constraint,
	/** @expose cjs.isConstraint */
	isConstraint: is_constraint,

	/**
	 * Create a new constraint whose value changes by state
	 *
	 * @method cjs.inFSM
	 * @param {cjs.FSM} fsm - The finite-state machine to depend on
	 * @param {Object} values - Keys are the state specifications for the FSM, values are the value for those specific states
	 * @return {cjs.Constraint} - A new constraint object
	 * @see cjs.Constraint.prototype.inFSM
	 *
	 * @example
	 *
	 *     var fsm = cjs.fsm("state1", "state2")
	 *                  .addTransition("state1", "state2",
	 *                       cjs.on("click"));
	 *     var x = cjs.inFSM(fsm, {
	 *         state1: 'val1',
	 *         state2: function() { return 'val2'; }
	 *     });
	 */
	inFSM: function(fsm, values) {
		return (new Constraint()).inFSM(fsm, values);
	},

	/**
	 * Gets the value of an object regardless of if it's a constraint (standard, array, or map) or not.
	 *
	 * @method cjs.get
	 * @param {*} obj - The object whose value to return
	 * @param {boolean} [autoAddOutgoing=true] - Whether to automatically add a dependency from this constraint to ones that depend on it.
	 * @return {*} - The value
	 *
	 * @see cjs.isConstraint
	 * @see cjs.Constraint.prototype.get
	 * @see cjs.isArrayConstraint
	 * @see cjs.ArrayConstraint.prototype.toArray
	 * @see cjs.isMapConstraint
	 * @see cjs.MapConstraint.prototype.toObject
	 *
	 * @example
	 *     var w = 1,
	 *         x = cjs(2),
	 *         y = cjs(['a','b']),
	 *         z = cjs({c: 2});
	 *
	 *     cjs.get(w); // 1
	 *     cjs.get(x); // 2
	 *     cjs.get(y); // ['a','b'] 
	 *     cjs.get(z); // {c: 2}
	 */
	get: function (obj, arg0) {
		if(is_constraint(obj))	{ return obj.get(arg0); }
		else if(is_array(obj))	{ return obj.toArray(); }
		else if(is_map(obj))	{ return obj.toObject(); }
		else					{ return obj; }
	},

	/** @expose cjs.wait */
	wait: bind(constraint_solver.wait, constraint_solver),
	/** @expose cjs.signal */
	signal: bind(constraint_solver.signal, constraint_solver),
	/** @expose cjs.removeDependency */
	removeDependency: constraint_solver.removeDependency,

	/** @expose cjs.arrayDiff */
	arrayDiff: get_array_diff, // expose this useful function

	/**
	 * The version number of ConstraintJS
	 * @property {string} cjs.version
	 * @see cjs.toString
	 */
	version: "<%= version %>", // This template will be filled in by the builder

	/**
	 * Print out the name and version of ConstraintJS
	 *
	 * @method cjs.toString
	 * @return {string} - `ConstraintJS v(version#)`
	 * @see cjs.version
	 */
	toString: function() { return "ConstraintJS v" + cjs.version; },

	/** @private */
	__debug: true,

	/**
	 * Restore the previous value of `cjs`
	 *
	 * @method cjs.noConflict
	 * @return {object} - `cjs`
	 *
	 * @example Renaming `cjs` to `ninjaCJS`
	 *
	 *     var ninjaCJS = cjs.noConflict();
	 *     var x = ninjaCJS(1);
	 * @see cjs
	 */
	noConflict: has(root, "cjs") ?  function() {
										// If there was a previous `cjs` property then track it
										// and allow `cjs.noConflict` to restore its previous value
										if(root.cjs === cjs) { root.cjs = old_cjs; }
										// and return a reference to `cjs` if the user wants it
										return cjs;
									} :
									// ...otherwise, `cjs.noConflict` will just delete the old value
									function() {
										delete root.cjs;
										return cjs;
									}
});
