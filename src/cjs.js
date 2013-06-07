	//
	// ============== CJS CORE ============== 
	//
	var SECRET_NODE_NAME = "__cjs_cs_node__";

	//
	// ============== UTILITY FUNCTIONS ============== 
	//
	var construct = function (constructor, args) {
		var F = function () { return constructor.apply(this, args); };
		F.prototype = constructor.prototype;
		return new F();
	};
	var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;
	var slice = ArrayProto.slice,
		toString = ObjProto.toString,
		nativeForEach      = ArrayProto.forEach,
		nativeMap          = ArrayProto.map;

	// Establish the object that gets returned to break out of a loop iteration.
	var breaker = {};

	// Return a unique id when called
	var uniqueId = (function () {
		var id = -1;
		return function () { id += 1; return id; };
	}());

	//Bind a function to a context
	var bind = function (func, context) {
		return function () { return func.apply(context, arguments); };
	};

	var console_error = root.console && root.console.error ? bind(root.console.error, root.console) : function(){};

	// Is a given value a number?
	var isNumber = function (obj) {
		return toString.call(obj) === '[object Number]';
	};

	// Is a given value an array?
	// Delegates to ECMA5's native Array.isArray
	var isArray = Array.isArray || function (obj) {
		return toString.call(obj) === '[object Array]';
	};

	// Is a given value a function?
	var isFunction = function (obj) {
		return toString.call(obj) === '[object Function]';
	};

	var isString = function (obj) {
		return toString.call(obj) === '[object String]';
	};

	var the_o = Object;
	// Is a given variable an object?
	var isObject = function (obj) {
		return obj === the_o(obj);
	};

	// Is a given variable an arguments object?
	var isArguments = function (obj) {
		return toString.call(obj) === '[object Arguments]';
	};
	 
	// Keep the identity function around for default iterators.
	var identity = function (value) {
		return value;
	};

    // Safely convert anything iterable into a real, live array.
    var toArray = function (obj) {
        if (!obj) { return []; }
        if (isArray(obj)) { return slice.call(obj); }
        if (isArguments(obj)) { return slice.call(obj); }
        if (obj.toArray && isFunction(obj.toArray)) { return obj.toArray(); }
        return map(obj, identity);
    };

	// Set a constructor's prototype
	var proto_extend = function (subClass, superClass) {
		var F = function () {};
		F.prototype = superClass.prototype;
		subClass.prototype = new F();
		subClass.prototype.constructor = subClass;
		
		subClass.superclass = superClass.prototype;
		if (superClass.prototype.constructor === Object.prototype.constructor) {
			superClass.prototype.constructor = superClass;
		}
	};

	var hOP = Object.prototype.hasOwnProperty;
	var has = function (obj, key) {
		return hOP.call(obj, key);
	};

	var each = function (obj, iterator, context) {
		var i, key, l;
		if (!obj) { return; }
		if (nativeForEach && obj.forEach === nativeForEach) {
			obj.forEach(iterator, context);
		} else if (obj.length === +obj.length) {
			for (i = 0, l = obj.length; i < l; i += 1) {
				if (has(obj, i) && iterator.call(context, obj[i], i, obj) === breaker) { return; }
			}
		} else {
			for (key in obj) {
				if (has(obj, key)) {
					if (iterator.call(context, obj[key], key, obj) === breaker) { return; }
				}
			}
		}
	};
	var map = function (obj, iterator, context) {
		var results = [];
		if (!obj) { return results; }
		if (nativeMap && obj.map === nativeMap) { return obj.map(iterator, context); }
		each(obj, function (value, index, list) {
			results[results.length] = iterator.call(context, value, index, list);
		});
		if (obj.length === +obj.length) { results.length = obj.length; }
		return results;
	};

	var extend = function (obj) {
		var i, prop, len = arguments.length;
		var on_each_func = function (val, prop) {
			obj[prop] = val;
		};
		for (i = 1; i < len; i += 1) {
			each(arguments[i], on_each_func);
		}
		return obj;
	};
		
	// Return the first item in arr where test is true
	var index_where = function (arr, test, start_index) {
		var i, len = arr.length;
		if (isNumber(start_index)) {
			start_index = Math.round(start_index);
		} else {
			start_index = 0;
		}
		for (i = start_index; i < len; i += 1) {
			if (test(arr[i], i)) { return i; }
		}
		return -1;
	};
		
	var eqeqeq = function (a, b) { return a === b; };
	// Return the first item in arr equal to item (where equality is defined in equality_check)
	var index_of = function (arr, item, start_index, equality_check) {
		equality_check = equality_check || eqeqeq;
		return index_where(arr, function (x) { return equality_check(item, x); }, start_index);
	};
		
	// Remove an item in an array
	var remove = function (arr, obj) {
		var index = index_of(arr, obj);
		if (index >= 0) { arr.splice(index, 1); }
		return index;
	};
	// Clone
	var clone = function (obj) {
		if (!isObject(obj)) { return obj; }
		return isArray(obj) ? obj.slice() : extend({}, obj);
	};

	// The star of the show!
	var cjs = function () {
		return cjs.$.apply(cjs, arguments);
	};

	cjs.version = "<%= version %>"; // This template will be filled in by the builder

	if(hOP.call(root, "cjs")) { // If there was a previous cjs property...
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

	var constraint_solver = (function () {
		var constraint_node_id = 1; // This variable will be incremented to produce a unique ID for every constraint node

		var ConstraintNode = function (cs_eval, options) {
			this.id = constraint_node_id++; // Create a unique ID for this constraint node
			this.outgoingEdges = {}; // The nodes that depend on me, key is link to edge object (with properties toNode, fromNode=this)
			this.incomingEdges = {}; // The nodes that I depend on, key is link to edge object (with properties toNode=this, fromNode)
			this.nullificationListeners = []; // A list of callbacks that will be called when I'm nullified
			this.cs_eval = cs_eval; // My getter

			/*
			 * == OPTION DEFAULTS ==
			 *
			 * cache_value: whether or not to keep track of the current value, true by default
			 * equals: the function to check if two values are equal, === by default
			 * auto_add_outgoing_dependencies: allow the constraint solver to determine when things depend on me, true by default
			 * auto_add_incoming_dependencies: allow the constraint solver to determine when things I depend on thigns, true by default
			 * check_on_nullify: when nullified, check if my value has actually changed (requires immediately re-evaluating me), false by default
			*/
			this.options = extend({}, options); // keeps track of the above options

			this.valid = false; // Tracks whether or not the cached value if valid
			this.timestamp = 0; // Marks the last time I was updated
		};
		(function (my) {
			var proto = my.prototype;

			proto.update_value = function () {
				if (this.options.cache_value !== false) {
					this.set_cached_value(this.cs_eval());
				} else {
					this.cs_eval();
				}
			};
			proto.setOption = function (key, value) {
				this.options[key] = value;
			};

			proto.addOutgoingEdge = function (edge) { this.outgoingEdges[edge.toNode.id] = edge; };
			proto.addIncomingEdge = function (edge) { this.incomingEdges[edge.fromNode.id] = edge; };

			proto.removeOutgoingEdge = function (edge) { delete this.outgoingEdges[edge.toNode.id]; };
			proto.removeIncomingEdge = function (edge) { delete this.incomingEdges[edge.fromNode.id]; };

			proto.getOutgoing = function () { return this.outgoingEdges; };

			proto.onNullify = function (callback) {
				this.nullificationListeners.push(callback);
			};
			proto.offNullify = function (callback) {
				var ri;
				for(var i = this.nullificationListeners.length-1; i>=0; i-=1) {
					if(this.nullificationListeners[i] === callback) {
						this.nullificationListeners.splice(i, 1);
					}
				}
			};
			proto.set_cached_value = function (value) {
				this.value = value;
			};

			//Take out the incoming & outgoing edges
			proto.destroy = function (silent) {
				cjs.wait();
				each(this.incomingEdges, function (edge) {
					var fromNode = edge.fromNode;
					fromNode.removeOutgoingEdge(edge);
				});
				each(this.outgoingEdges, function (edge) {
					var toNode = edge.toNode;
					if (silent !== true) {
						constraint_solver.nullifyNode(toNode);
					}
					toNode.removeIncomingEdge(edge);
				});
				delete this.value; // To avoid some leaks, let go of the value in case someone doesn't let go of me
				cjs.signal();
			};

			proto.getEdgeTo = function (toNode) {
				return this.outgoingEdges[toNode.id];
			};
			proto.hasEdgeTo = function (toNode) { return has(this.outgoingEdges, toNode.id); };
		}(ConstraintNode));

		var ConstraintSolver = function () {
			this.stack = [];
			this.nullified_call_stack = [];
			this.running_nullified_listeners = false;
			this.semaphore = 0;
		};
		(function (my) {
			var proto = my.prototype;

			proto.getNode = function (obj) { return obj[SECRET_NODE_NAME]; };
			proto.add = function (obj, options) {
				if(hOP.call(obj, SECRET_NODE_NAME)) {
					return obj[SECRET_NODE_NAME];
				} else {
					return obj[SECRET_NODE_NAME] = new ConstraintNode(bind(obj.cjs_getter, obj), options);
				}
			};

			proto.removeObject = function (obj, silent) {
				if(hOP.call(obj, SECRET_NODE_NAME)) {
					var node = obj[SECRET_NODE_NAME];
					node.destroy(silent);
					delete obj[SECRET_NODE_NAME];
				}
			};

			proto.addNodeDependency = function (fromNode, toNode) {
				return this.addEdge({fromNode: fromNode, toNode: toNode, timestamp: 0});
			};

			proto.nullifyNode = function (node) {
				var is_root = this._is_nullifying !== true;

				if (is_root) {
					this._is_nullifying = true;
				}

				var i, j, outgoingEdges, toNodeID;
				var to_nullify = [node];
				var to_nullify_len = 1, invalid;
				var nullify_listener = function (nl) {
					nl.__in_cjs_call_stack__ = true;
				};
				var get_curr_node = function (curr_node) { return curr_node; };
				for (i = 0; i < to_nullify.length; i += 1) {
					var curr_node = to_nullify[i];

					if (curr_node.valid) {
						curr_node.valid = false;
						invalid = true;
						if (curr_node.options.cache_value !== false && curr_node.options.check_on_nullify === true) {
							var equals = curr_node.options.equals || eqeqeq;
							var old_value = curr_node.value;
							var new_value = this.getNodeValue(curr_node);

							if (equals(old_value, new_value)) {
								invalid = false;
							}
						}

						if (invalid) {
							var nullification_listeners = this.get_nullification_listeners(curr_node);
							each(nullification_listeners, nullify_listener);
							this.nullified_call_stack.push.apply(this.nullified_call_stack, nullification_listeners);

							outgoingEdges = curr_node.getOutgoing();
							for (toNodeID in outgoingEdges) {
								if (has(outgoingEdges, toNodeID)) {
									var outgoingEdge = outgoingEdges[toNodeID];
									var dependentNode = outgoingEdge.toNode;
									if (outgoingEdge.timestamp < dependentNode.timestamp) {
										this.removeEdge(outgoingEdge);
										j -= 1;
									} else {
										to_nullify[to_nullify_len] = dependentNode;
										to_nullify_len += 1;
									}
								}
							}
						}
					}
				}
				if (is_root) {
					delete this._is_nullifying;
				}
				if (is_root && this.semaphore >= 0 && this.nullified_call_stack.length > 0) {
					this.run_nullified_listeners();
				}
			};

			proto.run_nullified_listeners = function () {
				if (!this.running_nullified_listeners) {
					this.running_nullified_listeners = true;
					while (this.nullified_call_stack.length > 0) {
						var nullified_callback = this.nullified_call_stack.shift();
						delete nullified_callback.__in_cjs_call_stack__;
						//try {
							nullified_callback();
						//} catch(e) {
							//console_error(e);
						//}
					}
					this.running_nullified_listeners = false;
				}
			};

			proto.getValue = function (obj) { return this.getNodeValue(this.getNode(obj)); };

			proto.getNodeValue = function (node) {
				var stack_len = this.stack.length;


				if (stack_len > 0) {
					var demanding_var = this.stack[stack_len - 1];
					var dependency_edge = this.getEdge(node, demanding_var);
					if (!dependency_edge) {
						if (node.options.auto_add_outgoing_dependencies !== false && demanding_var.options.auto_add_incoming_dependencies !== false) {
							dependency_edge = this.addNodeDependency(node, demanding_var);
						}
					}
					if (dependency_edge !== undefined) {
						dependency_edge.timestamp = demanding_var.timestamp + 1;
					}
				}

				if (!node.valid) {
					this.stack[stack_len] = node;
					this.doEvalNode(node);
					this.stack.length = stack_len;
				}

				return node.value;
			};
			
			proto.doEvalNode = function (node) {
				node.valid = true;
				node.update_value();
				node.timestamp += 1;
			};
			proto.doEval = function (obj) { return this.doEvalNode(this.getNode(obj)); };

			proto.on_nullify = function (node, callback) {
				node.onNullify(callback);
			};

			proto.off_nullify = function (node, callback) {
				node.offNullify(callback);

				if (callback.__in_cjs_call_stack__) {
					delete callback.__in_cjs_call_stack__;
					remove(this.nullified_call_stack, callback);
				}
			};

			proto.get_nullification_listeners = function (node) {
				return node.nullificationListeners;
			};

			proto.getEdge = function (fromNode, toNode) {
				return fromNode.getEdgeTo(toNode);
			};

			proto.addEdge = function (edge) {
				edge.fromNode.addOutgoingEdge(edge);
				edge.toNode.addIncomingEdge(edge);
				return edge;
			};

			proto.removeEdge = function (edge) {
				edge.fromNode.removeOutgoingEdge(edge);
				edge.toNode.removeIncomingEdge(edge);
			};

			proto.wait = function () {
				this.semaphore -= 1;
			};
			proto.signal = function () {
				this.semaphore += 1;
				if (this.semaphore >= 0 && this.nullified_call_stack.length > 0) {
					this.run_nullified_listeners();
				}
			};
		}(ConstraintSolver));

		return new ConstraintSolver();
	}());

	cjs.wait = bind(constraint_solver.wait, constraint_solver);
	cjs.signal = bind(constraint_solver.signal, constraint_solver);

	//
	// ============== CORE CONSTRAINTS ============== 
	//

	var Constraint = function (value, literal, options) {
		var node = constraint_solver.add(this, options);
		this.value = value;
		this.literal = literal === true;
		this._change_listeners = [];
	};

	(function (my) {
		var proto = my.prototype;
		proto.destroy = function (silent) { constraint_solver.removeObject(this, silent); };
		proto.cjs_getter = function () {
			if (has(this, "value")) {
				if (isFunction(this.value) && !this.literal) {
					return this.value();
				} else {
					return this.value;
				}
			}
			return undefined;
		};
		proto.get = proto.update = function () { return constraint_solver.getValue(this); };
		proto.onChange = function (callback) {
			var listener = {
				callback: callback
			};
			var node = constraint_solver.getNode(this);
			constraint_solver.on_nullify(node, listener.callback);
			this._change_listeners.push(listener);
			return this;
		};
		proto.offChange = function (callback) {
			var node = constraint_solver.getNode(this);
			for (var i = this._change_listeners.length-1; i >= 0; i -= 1) {
				var listener = this._change_listeners[i];
				if (listener === callback) {
					constraint_solver.off_nullify(node, listener.callback);
					this._change_listeners.splice(i, 1);
				}
			}
			return this;
		};
		proto.setOption = function () {
			var node = constraint_solver.getNode(this);
			if (node) {
				node.setOption.apply(node, arguments);
			}
			return this;
		};
		proto.invalidate = function () {
			constraint_solver.nullifyNode(constraint_solver.getNode(this));
		};
		proto.set_cached_value = function (value) {
			var node = constraint_solver.getNode(this);
			if (node) {
				node.set_cached_value(value);
			}
			return this;
		};
		proto.is_valid = function () {
			var node = constraint_solver.getNode(this);
			return node.valid;
		};
	}(Constraint));
	cjs.Constraint = Constraint;

	var SettableConstraint = function () {
		SettableConstraint.superclass.constructor.apply(this, arguments);
	};

	(function (my) {
		proto_extend(my, Constraint);
		var proto = my.prototype;
		proto.get_equality_check = function () { return this._equality_check || eqeqeq; };
		proto.set_equality_check = function (equality_check) { this._equality_check = equality_check; return this; };
		proto.set = function (value, literal) {
			var was_literal = this.literal;
			var old_value = this.value;

			this.literal = literal === true;
			this.value = value;
			
			if (was_literal !== this.literal || !this.get_equality_check()(old_value, this.value)) {
				this.invalidate();
			}
			return this;
		};
	}(SettableConstraint));
	cjs.SettableConstraint = SettableConstraint;

	cjs.is_constraint = cjs.is_$ = function (obj) {
		return obj instanceof Constraint;
	};

	cjs.get = function (obj) {
		if(obj instanceof Constraint) {
			return obj.get();
		} else {
			return obj;
		}
	};

	cjs.$ = function (arg0, arg1, arg2) {
		return new SettableConstraint(arg0, arg1, arg2);
	};

	cjs.$.extend = function (arg0, arg1) {
		var values;
		if (isString(arg0)) {
			values = {};
			values[arg0] = arg1;
		} else {
			values = arg0;
		}

		each(values, function (value, key) {
			Constraint.prototype[key] = value;
		});
	};

	cjs.removeDependency = function (from, to) {
		var fromNode = constraint_solver.getNode(from),
			toNode = constraint_solver.getNode(to);
		var outgoing = fromNode.getOutgoing();
		var edge = outgoing[toNode.id];
		if (edge) {
			constraint_solver.removeEdge(edge);
		}
	};

	cjs.addDependency = function (from, to) {
		var fromNode = constraint_solver.getNode(from),
			toNode = constraint_solver.getNode(to);
		constraint_solver.addNodeDependency(fromNode, toNode);
	};
