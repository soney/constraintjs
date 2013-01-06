var cjs = (function (root) {
var __debug = true;

//
// ============== CJS CORE ============== 
//

// The star of the show!
var old_cjs = root.cjs;
var cjs = function (val) {
	if(isArray(val)) {
		return cjs.array({ value: val });
	} else if(isObject(val) && !isElement(val)) {
		return cjs.map({ value: val });
	} else {
		return cjs.$.apply(cjs, arguments);
	}
};
cjs.version = "0.7.0";

cjs.noConflict = function() { root.cjs = old_cjs; return cjs; };

//
// ============== UTILITY FUNCTIONS ============== 
//
var construct = function(constructor, args) {
    var F = function() { return constructor.apply(this, args); }
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
var uniqueId = (function() {
	var id = 0;
	return function() { return id++; };
}());

// Clone
var clone = function(obj) {
	if (!isObject(obj)) return obj;
	return isArray(obj) ? obj.slice() : extend({}, obj);
};

// Return the first item in arr where test is true
var index_where = function(arr, test, start_index) {
	var i, len = arr.length;
	if(isNumber(start_index)) {
		start_index = Math.round(start_index);
	} else {
		start_index = 0;
	}
	for(i = start_index; i<len; i++) {
		if(test(arr[i], i)) { return i; }
	}
	return -1;
};

//Bind a function to a context
var bind = function(func, context) {
	return function() { return func.apply(context, arguments); };
};

var eqeqeq = function(a, b) { return a === b; };
// Return the first item in arr equal to item (where equality is defined in equality_check)
var index_of = function(arr, item, start_index, equality_check) {
	equality_check = equality_check || eqeqeq;
	return index_where(arr, function(x) { return equality_check(item, x); }, start_index);
};

// Remove an item in an array
var remove = function(arr, obj) {
	var index = index_of(arr, obj);
	if(index>=0) { arr.splice(index, 1); }
	return index;
};

// Remove every item from an array
var clear = function(arr) {
	arr.length = 0;
};
  
// Is a given value a number?
var isNumber = function(obj) {
	return toString.call(obj) == '[object Number]';
};

// Is a given value an array?
// Delegates to ECMA5's native Array.isArray
var isArray = Array.isArray || function(obj) {
	return toString.call(obj) == '[object Array]';
};
  
// Is a given value a DOM element?
var isElement = function(obj) {
	return !!(obj && (obj.nodeType === 1 || obj.nodeType === 8 || obj.nodeType === 3));
};
  
// Is a given value a function?
var isFunction = function(obj) {
	return toString.call(obj) == '[object Function]';
};

var isString = function(obj) {
	return toString.call(obj) == '[object String]';
};

// Is a given variable an object?
var isObject = function(obj) {
	return obj === Object(obj);
};

// Is a given variable an arguments object?
var isArguments = function(obj) {
	return toString.call(obj) == '[object Arguments]';
};
 
// Keep the identity function around for default iterators.
var identity = function(value) {
	return value;
};

// Retrieve the values of an object's properties.
var values = function(obj) {
	return map(obj, identity);
};
  
// Safely convert anything iterable into a real, live array.
var toArray = function(obj) {
	if (!obj) return [];
	if (isArray(obj)) return slice.call(obj);
	if (isArguments(obj)) return slice.call(obj);
	if (obj.toArray && isFunction(obj.toArray)) return obj.toArray();
	return values(obj);
};

// Set a constructor's prototype
var proto_extend = function (subClass, superClass) {
	var F = function() {};
	F.prototype = superClass.prototype;
	subClass.prototype = new F();
	subClass.prototype.constructor = subClass;
	
	subClass.superclass = superClass.prototype;
	if(superClass.prototype.constructor === Object.prototype.constructor) {
		superClass.prototype.constructor = superClass;
	}
};

var extend = function(obj) {
	var i, len = arguments.length;
	for(i = 1; i<len; i++) {
		var source = arguments[i];
		for (var prop in source) {
			obj[prop] = source[prop];
		}
	}
	return obj;
};
var each = function(obj, iterator, context) {
	if (obj == null) { return; }
	if (nativeForEach && obj.forEach === nativeForEach) {
		obj.forEach(iterator, context);
	} else if (obj.length === +obj.length) {
		for (var i = 0, l = obj.length; i < l; i++) {
			if (i in obj && iterator.call(context, obj[i], i, obj) === breaker) { return; }
		}
	} else {
		for (var key in obj) {
			if(has(obj, key)) {
				if (iterator.call(context, obj[key], key, obj) === breaker) { return; }
			}
		}
	}
};
var map = function(obj, iterator, context) {
	var results = [];
	if (obj == null) { return results; }
	if (nativeMap && obj.map === nativeMap) { return obj.map(iterator, context); }
	each(obj, function(value, index, list) {
		results[results.length] = iterator.call(context, value, index, list);
	});
	if (obj.length === +obj.length) { results.length = obj.length; }
	return results;
};

var last = function(arr) {
	return arr[arr.length - 1];
};

var hasOwnProperty = Object.prototype.hasOwnProperty;
var has = function(obj, key) {
	return hasOwnProperty.call(obj, key);
};

//
// ============== CONSTRAINT SOLVER ============== 
//
//   Edge from A -> B means A sends data to B
//   ---

//   Constraint Solver: Implements constraint solving, as described in:
//   Brad Vander Zanden, Brad A. Myers, Dario A. Giuse, and Pedro Szekely. 1994. Integrating pointer variables into one-way constraint models. ACM Trans. Comput.-Hum. Interact. 1, 2 (June 1994), 161-213. DOI=10.1145/180171.180174 http://doi.acm.org/10.1145/180171.180174

var constraint_solver = (function() {
	var ConstraintNode = function(obj, options) {
		this.outgoingEdges = [];
		this.incomingEdges = [];
		this.nullificationListeners = [];
		this.obj = obj;
		this.valid = false;

		this.options = extend({
									auto_add_outgoing_dependencies: true,
									auto_add_incoming_dependencies: true,
									cache_value: true
								},
								options);
		
		this.obj.__cjs_cs_node__ = this;
		this.timestamp = 0;
		this.id = uniqueId();
	};
	(function(my) {
		var proto = my.prototype;
		proto.cs_eval = function() { return this.obj.cjs_getter(); };
		proto.mark_invalid = function() { this.valid = false; };
		proto.mark_valid = function() { this.valid = true; };
		proto.is_valid = function() { return this.valid; };
		proto.update_value = function() {
			if(this.options.cache_value) {
				this.value = this.cs_eval();
			} else {
				this.cs_eval();
			}
		};

		proto.addOutgoingEdge = function(edge) { this.outgoingEdges.push(edge); };
		proto.addIncomingEdge = function(edge) { this.incomingEdges.push(edge); };

		proto.removeOutgoingEdge = function(edge) { remove(this.outgoingEdges, edge); };
		proto.removeIncomingEdge = function(edge) { remove(this.incomingEdges, edge); };

		proto.getOutgoing = function() { return this.outgoingEdges; };
		proto.getIncoming = function() { return this.incomingEdges; };

		proto.onNullify = function(callback) {
			this.nullificationListeners.push(callback);
		};
		proto.offNullify = function(callback) {
			var ri;
			do {
				ri = remove(this.nullificationListeners, callback);
			} while (ri >= 0);
		};

		//Take out the incoming & outgoing edges
		proto.destroy = function() {
			this.incomingEdges.forEach(function(edge) {
				var fromNode = edge.fromNode;
				fromNode.removeOutgoingEdge(edge);
			});

			this.outgoingEdges.forEach(function(edge) {
				var toNode = edge.toNode;
				toNode.removeIncomingEdge(edge);
			});

			clear(this.incomingEdges);
			clear(this.outgoingEdges);
			delete this.obj.__cjs_cs_node__;
		};

		proto.getEdgeTo = function(toNode) {
			var i = index_where(this.outgoingEdges, function(edge) {
				return edge.toNode === toNode;
			});

			if(i < 0) { return null; }
			else { return this.outgoingEdges[i]; }
		};
		proto.hasEdgeTo = function(toNode) { return this.getEdgeTo(toNode)!==null; };
	}(ConstraintNode));

	var ConstraintEdge = function(fromNode, toNode) {
		this.fromNode = fromNode;
		this.toNode = toNode;
		this.timestamp = 0;
	};

	var ConstraintSolver = function() {
		this.stack = [];
		this.nullified_call_stack = [];
		if(__debug) { this.nullified_reasons = []; }
		this.running_nullified_listeners = false;
		this.semaphore = 0;
	};
	(function(my) {
		var proto = my.prototype;

		proto.getNode = function(obj) { return obj.__cjs_cs_node__ || null; };
		proto.hasNode = function(obj) { return this.getNode(obj)!==null; };
		proto.add = function(obj, options) { return this.getNode(obj) || new ConstraintNode(obj, options); };

		proto.removeObject = function(obj) {
			var node = this.getNode(obj);
			if(node!==null) {
				this.removeNode(node);
			}
		};
		proto.removeNode = function(node) {
			node.destroy();
		};

		proto.getNodeDependency = function(fromNode, toNode) { return this.getEdge(fromNode, toNode); };
		proto.addNodeDependency = function(fromNode, toNode) { return this.addEdge(new ConstraintEdge(fromNode, toNode)); };

		proto.removeNodeDependency = function(edge) { this.removeEdge(edge); };

		proto.nullifyNode = function(node) {
			var i, j, outgoingEdges;
			var to_nullify = [node];
			for(i = 0; i<to_nullify.length; i++) {
				var curr_node = to_nullify[i];
				if(curr_node.is_valid()) {
					curr_node.mark_invalid();

					var nullification_listeners = this.get_nullification_listeners(curr_node);
					this.nullified_call_stack.push.apply(this.nullified_call_stack, nullification_listeners);
					if(__debug) {
						this.nullified_reasons.push.apply(this.nullified_reasons, map(nullification_listeners, function() { return curr_node; }));
					}

					var outgoingEdges = curr_node.getOutgoing();
					for(j = 0; j<outgoingEdges.length; j++) {
						var outgoingEdge = outgoingEdges[j];
						var dependentNode = outgoingEdge.toNode;
						if(outgoingEdge.timestamp < dependentNode.timestamp) {
							this.removeEdge(outgoingEdge);
							j--;
						} else {
							to_nullify.push(dependentNode);
						}
					}
				}
			}
			if(this.semaphore >= 0) {
				this.run_nullified_listeners();
			}
		};

		proto.run_nullified_listeners = function() {
			if(!this.running_nullified_listeners) {
				this.running_nullified_listeners = true;
				while(this.nullified_call_stack.length > 0) {
					var nullified_callback = this.nullified_call_stack.pop();
					if(__debug) { var nullified_reason = this.nullified_reasons.pop(); }
					nullified_callback();
				}
				this.running_nullified_listeners = false;
			}
		};

		proto.getValue = function(obj) { return this.getNodeValue(this.getNode(obj)); };

		proto.getNodeValue = function(node) {
			var demanding_var = last(this.stack);

			if(demanding_var) {
				var dependency_edge = this.getNodeDependency(node, demanding_var);
				if(!dependency_edge) {
					if(node.options.auto_add_outgoing_dependencies && demanding_var.options.auto_add_incoming_dependencies) {
						dependency_edge = this.addNodeDependency(node, demanding_var);
					}
				}
				if(dependency_edge!==null) {
					dependency_edge.timestamp = demanding_var.timestamp+1;
				}
			}

			if(!node.is_valid()) {
				this.stack.push(node);
				this.doEvalNode(node);
				this.stack.pop();
			}

			return node.value;
		};

		proto.doEvalNode = function(node) {
			node.mark_valid();
			node.update_value();
			node.timestamp++;
		};
		proto.doEval = function(obj) { return this.doEvalNode(this.getNode(obj)); };

		proto.on_nullify = function(arg0, callback) {
			var node = arg0 instanceof ConstraintNode ? arg0 : this.getNode(arg0);
			node.onNullify(callback);
		};

		proto.off_nullify = function(arg0, callback) {
			var node = arg0 instanceof ConstraintNode ? arg0 : this.getNode(arg0);
			node.offNullify(callback);
			do {
				ri = remove(this.nullified_call_stack, callback);
				if(__debug) {
					if(ri >= 0) {
						this.nullified_reasons.splice(ri, 1);
					}
				}
			} while (ri >= 0);
		};

		proto.get_nullification_listeners = function(arg0) {
			var node = arg0 instanceof ConstraintNode ? arg0 : this.getNode(arg0);
			return node.nullificationListeners;
		};

		proto.getEdge = function(fromNode, toNode) {
			return fromNode.getEdgeTo(toNode);
		};

		proto.addEdge = function(edge){
			edge.fromNode.addOutgoingEdge(edge);
			edge.toNode.addIncomingEdge(edge);
			return edge;
		};

		proto.removeEdge = function(edge) {
			if(edge!=null) {
				edge.fromNode.removeOutgoingEdge(edge);
				edge.toNode.removeIncomingEdge(edge);
			}
		};

		proto.wait = function() {
			this.semaphore--;
		};
		proto.signal = function() {
			this.semaphore++;
			if(this.semaphore >= 0) {
				this.run_nullified_listeners();
			}
		};
	}(ConstraintSolver));

	return new ConstraintSolver();
}());

cjs.wait = function() {
	constraint_solver.wait();
};
cjs.signal = function() {
	constraint_solver.signal();
};

//
// ============== CORE CONSTRAINTS ============== 
//

var Constraint = function(value, literal) {
	var node = constraint_solver.add(this);
	this.value = value;
	this.literal = literal === true;
	this._equality_check = eqeqeq;
	this.invalidate = function() {
		constraint_solver.nullifyNode(node);
	};
	this._change_listeners = [];
};

(function(my) {
	var proto = my.prototype;
	proto.destroy = function() { constraint_solver.removeObject(this); };
	proto.set_equality_check = function(equality_check) { this._equality_check = equality_check; return this; };
	proto.cjs_getter = function() {
		if(has(this, "value")) {
			if(isFunction(this.value) && !this.literal){
				return this.value();
			} else {
				return this.value;
			}
		}
		return undefined;
	};
	proto.get = function() { return constraint_solver.getValue(this); };
	proto.onChange = function(callback) {
		var self = this;
		var listener = {
			callback: callback
			, on_nullify: function() {
				callback(self.get());
			}
		};
		constraint_solver.on_nullify(this, listener.on_nullify);
		this.get();
		this._change_listeners.push(listener);
		return this;
	};
	proto.offChange = function(callback) {
		for(var i = 0; i<this._change_listeners.length; i++) {
			var listener = this._change_listeners[i];
			if(listener === callback) {
				constraint_solver.off_nullify(this, listener.on_nullify);
				this._change_listeners.splice(i, 1);
				i--;
			}
		}
		return this;
	};
}(Constraint));
cjs.Constraint = Constraint;

var SettableConstraint = function() {
	SettableConstraint.superclass.constructor.apply(this, arguments);
};

(function(my) {
	proto_extend(my, Constraint);
	var proto = my.prototype;
	proto.set = function(value, literal) {
		var was_literal = this.literal;
		var old_value = this.value;

		this.literal = literal === true;
		this.value = value;
		
		if(!this._equality_check(was_literal, this.literal) || !this._equality_check(old_value !== this.value)) {
			this.invalidate();
		}
		return this;
	};
}(SettableConstraint));
cjs.SettableConstraint = SettableConstraint;

cjs.is_constraint = cjs.is_$ = function(obj) {
	return obj instanceof Constraint;
};

cjs.get = function(obj, recursive) {
	if(cjs.is_$(obj) || obj instanceof ArrayConstraint) {
		if(recursive === true) {
			return cjs.get(obj.get(), true);
		} else {
			return obj.get();
		}
	} else {
		if(recursive === true && isArray(obj)) {
			return map(obj, function(x) { return cjs.get(x, true); });
		} else {
			return obj;
		}
	}
};

cjs.$ = function(arg0, arg1) {
	return new SettableConstraint(arg0, arg1);
};

cjs.$.extend = function(arg0, arg1) {
	var values;
	if(isString(arg0)) {
		values = {};
		values[arg0] = arg1;
	} else {
		values = arg0;
	}

	each(values, function(value, key) {
		Constraint.prototype[key] = value;
	});
};
//
// ============== LIVEN ============== 
//

cjs.liven = function(func, options) {
	options = extend({
		context: this
		, run_on_create: true
		, pause_while_running: false
	}, options);

	var node = constraint_solver.add({
		cjs_getter: function() {
			func.call(options.context);
		},
		auto_add_outgoing_dependencies: false,
		cache_value: false
	});

	var destroy = function() {
		constraint_solver.off_nullify(node, do_get);
		constraint_solver.removeObject(node);
	};
	var pause = function() {
		constraint_solver.off_nullify(node, do_get);
		return this;
	};
	var resume = function() {
		constraint_solver.on_nullify(node, do_get);
		return this;
	};
	var run = function() {
		do_get();
		return this;
	};

	var do_get = function() {
		if(options.pause_while_running) {
			pause();
		}
		constraint_solver.getNodeValue(node);
		if(options.pause_while_running) {
			resume();
		}
	};

	constraint_solver.on_nullify(node, do_get);
	if(options.run_on_create !== false) {
		constraint_solver.nullified_call_stack.push(do_get);
		if(__debug) { constraint_solver.nullified_reasons.push("liven start"); }

		if(constraint_solver.semaphore >= 0) {
			constraint_solver.run_nullified_listeners();
		}
	}

	return {
		destroy: destroy
		, pause: pause
		, resume: resume
		, run: run
	};
};

var get_categorical_listeners = function(proto, events) {
	proto._initialize_listeners = function() {
		this._semaphore = 0;
		this.__running_listeners = false;
		this._queued_events = [];
		var listeners = this._listeners = {};
		each(events, function(arr_name, diff_event) {
			listeners[arr_name] = [];
		});
	};
	each(events, function(arr_name, diff_event) {
		proto["on" + diff_event] = function(callback, context) {
			var listener_info = {
				callback: callback,
				context: context || this
			};
			var arr = this._listeners[arr_name];
			arr.push(listener_info);
			return this;
		};
		proto["off" + diff_event] = function(callback) {
			var arr = this._listeners[arr_name];

			var listener_index = index_where(arr, function(listener_info) {
				return listener_info.callback === callback;
			});

			if(listener_index >= 0) {
				delete arr[listener_index];
				arr.splice(listener_index, 1);
			}

			return this;
		};
	});

	proto.wait = function() {
		this._semaphore--;
	};

	proto.signal = function() {
		this._semaphore++;
		if(this._semaphore >= 0 && !this.__running_listeners) {
			this.__running_listeners = true;
			this._run_listeners();
			this.__running_listeners = false;
		}
	};

	proto._run_listeners = function() {
		var queued_events = this._queued_events;
		while(queued_events.length > 0) {
			var queued_event = queued_events.shift();
			var type = queued_event.shift();
			var listeners = this._listeners[type];
			each(listeners, function(listener_info) {
				var callback = listener_info.callback;
				var context = listener_info.context;
				callback.apply(context, queued_event);
			});
		}
	};
};


//
// ============== ARRAYS ============== 
//

var ArrayConstraint = function(options) {
	options = extend({
		equals: eqeqeq,
		value: []
	}, options);
	this._value = [];
	this._unsubstantiated_items = [];

	if(isArray(options.value)) {
		var i, len = options.value.length;
		for(i = 0; i<len; i++) {
			var val = options.value[i];
			this._value[i] = cjs.$(val, true);
		}
	}
	this.$len = cjs.$(this._value.length);

	this._equality_check = options.equals;

	this._initialize_listeners();
};

(function(my) {
	var proto = my.prototype;

	var add_event_str = "add"; // value, index
	var remove_event_str = "remove"; // value, index
	var index_change_event_str = "index_change"; // value, to_index, from_index
	var value_change_event_str = "value_change"; // to_value, from_value, index

	get_categorical_listeners(proto, {
		"Add":  add_event_str,
		"Remove":  remove_event_str,
		"IndexChange":  index_change_event_str,
		"ValueChange":  value_change_event_str
	});

	proto.set_equality_check = function(equality_check) {
		this._equality_check = equality_check;
		return this;
	};

	proto.each = function(func, context) {
		context = context || root;
		var i, len = this.length();
		for(var i = 0; i<len; i++) {
			if(func.call(context, this.get(i), i) === false) {
				break;
			}
		}
		return this;
	};
	proto.get = function(key) {
		var val = this._value[key];
		if(val === undefined) {
			// Create a dependency so that if the value for this key changes
			// later on, we can detect it in the constraint solver
			val = cjs.$(undefined);
			this._unsubstantiated_items[key] = val;
		}
		return val.get();
	};
	proto.put = function(key, val) {
		cjs.wait();
		this.wait();
		var $previous_value = this._value[key];
		if($previous_value === undefined && has(this._unsubstantiated_items, key)) {
			$previous_value = this._unsubstantiated_items[key];
			delete this._unsubstantiated_items[key];
		}

		if(cjs.is_$($previous_value)) {
			var prev_val = $previous_value.get();
			$previous_value.set(val, true);
			this._queued_events.push([value_change_event_str, val, key, prev_val]);
		} else {
			this._value[key] = cjs.$(val, true);
			this._queued_events.push([add_event_str, val, key]);
		}
		this._update_len();
		this.signal();
		cjs.signal();
		return this;
	};
	proto.i = proto.item = function(key, val) {
		if(arguments.length === 1) {
			return this.get(key);
		} else if(arguments.length > 1) {
			return this.put(key, val);
		}
	};
	proto.destroy = function() {
		this.$len.destroy();
	};
	proto.length = function() {
		return this.$len.get();
	};
	proto.push = function() {
		var i, len = arguments.length;
		//Make operation atomic
		cjs.wait();
		this.wait();
		for(i = 0; i<len; i++) {
			this.put(this._value.length, arguments[i]);
		}
		this.signal();
		cjs.signal();
		return arguments.length;
	};
	proto.pop = function() {
		cjs.wait(); this.wait();

		var $value = this._value.pop();
		var len = this._value.length;
		var rv;
		if(cjs.is_$($value)) {
			rv = $value.get();
			$value.destroy();
			this._queued_events.push([remove_event_str, rv, len]);
		}
		this._update_len();

		this.signal(); cjs.signal();
		return rv;
	};
	proto.clear = function() {
		var $val;
		cjs.wait(); this.wait();

		while(this._value.length > 0) {
			$val = this._value.pop();
			var len = this._value.length;
			if(cjs.is_constraint($val)) {
				this._queued_events.push([remove_event_str, $val.get(), len]);
				$val.destroy();
			}
		}
		this._update_len();


		this.signal(); cjs.signal();
		return this;
	};
	proto.set = function(arr) {
		cjs.wait(); this.wait();

		this.clear();
		this.push.apply(this, arr);

		this.signal(); cjs.signal();
		return this;
	};
	proto.toArray = function() {
		var rv = [];
		this.each(function(v, i) { rv[i] = v; });
		return rv;
	};
	proto._update_len = function() {
		this.$len.set(this._value.length);
	};
	proto.indexWhere = function(filter) {
		var i, len = this._value.length, $val;

		for(i = 0; i<len; i++) {
			$val = this._value[i];
			if(filter($val.get())) {
				return i;
			}
		}
		this.length(); // We want to depend on the length if not found

		return -1;
	};
	proto.lastIndexWhere = function(filter) {
		var i, len = this.length(), $val;

		for(i = len-1; i>=0; i--) {
			$val = this._value[i];
			if(filter($val.get())) { return i; }
		}
		return -1;
	};
	proto.indexOf = function(item, equality_check) {
		equality_check = equality_check || this._equality_check;
		var filter = function(x) { return equality_check(x, item); };
		return this.indexWhere(filter);
	};
	proto.lastIndexOf = function(item, equality_check) {
		equality_check = equality_check || this._equality_check;
		var filter = function(x) { return equality_check(x, item); };
		return this.lastIndexWhere(filter);
	};
	var isPositiveInteger = function(val) {
		return isNumber(val) && Math.round(val) === val && val >= 0;
	};
	proto.splice = function(index, howmany) {
		var i;
		if(!isNumber(howmany)) { howmany = 0; }
		if(!isPositiveInteger(index) || !isPositiveInteger(howmany)) {
			throw new Error("index and howmany must be positive integers");
		}
		var to_insert = slice.call(arguments, 2);

		cjs.wait(); this.wait();
		var resulting_shift_size = to_insert.length - howmany;
		var removed = [];

		for(i = index; i<index+howmany; i++) {
			removed.push(this.item(i));
		}

		if(resulting_shift_size < 0) {
			for(i = index; i<this._value.length + resulting_shift_size; i++) {
				if(i < index + to_insert.length) {
					this.put(i, to_insert[i-index]);
				} else {
					this.put(i, this.get(i - resulting_shift_size));
				}
			}
			for(i = 0; i<-resulting_shift_size; i++) {
				this.pop();
			}
		} else {
			for(i = this._value.length + resulting_shift_size - 1; i>=index; i--) {
				if(i-index < to_insert.length) {
					this.put(i, to_insert[i-index]);
				} else {
					this.put(i, this.get(i - resulting_shift_size));
				}
			}
		}

		this._update_len();
		this.signal(); cjs.signal();
		return removed;
	};
	proto.shift = function() {
		var rv_arr = this.splice(0, 1);
		return rv_arr[0];
	};
	proto.unshift = function() {
		var args = toArray(arguments);
		this.splice.apply(this, ([0, 0]).concat(args));
		return this._value.length;
	};

	proto.concat = function() {
		var args = [], i, len = arguments.length;
		for(i = 0; i<len; i++) {
			var arg = arguments[i];
			if(arg instanceof ArrayConstraint) {
				args.push(arg.toArray());
			} else {
				args.push(arg);
			}
		}
		var my_val = this.toArray();
		return my_val.concat.apply(my_val, args);
	};
	each(["join", "slice", "sort", "reverse", "valueOf", "toString"], function(fn_name) {
			proto[fn_name] = function() {
				var my_val = this.toArray();
				return my_val[fn_name].apply(my_val, arguments);
			};
	});
}(ArrayConstraint));

cjs.array = function(value) { return new ArrayConstraint(value); };
cjs.is_array = function(obj) { return obj instanceof ArrayConstraint; };
cjs.ArrayConstraint = ArrayConstraint;

//
// ============== MAPS ============== 
//

var defaulthash = function(key) { return ""+key; };
var get_str_hash_fn = function(prop_name) {
	return function(key) {
		return key[prop_name]();
	};
};
var MapConstraint = function(options) {
	options = extend({
		hash: defaulthash,
		equals: eqeqeq,
		value: {},
		keys: [],
		values: []
	}, options);
	each(options.value, function(v, k) {
		options.keys.push(k);
		options.values.push(v);
	}, this);
	this._equality_check = options.equals;
	this._hash = isString(options.hash) ? get_str_hash_fn(options.hash) : options.hash;

	this._values = {};
	this._ordered_values = [];
	var index = 0;
	each(options.keys, function(k, i) {
		var v = options.values[i];
		var info = { key: cjs.$(k, true), value: cjs.$(v, true), index: cjs.$(index, true) };
		var hash = this._hash(k);
		var hash_val = this._values[hash];
		if(isArray(hash_val)) {
			hash_val.push(info);
		} else {
			this._values[hash] = [info];
		}
		this._ordered_values[index] = info;
		index++;
	}, this);

	this._unsubstantiated_values = {};

	this.$keys = new Constraint(bind(this._do_get_keys, this));
	this.$values = new Constraint(bind(this._do_get_values, this));
	this.$entries = new Constraint(bind(this._do_get_entries, this));
	this.$size = new Constraint(bind(this._do_get_size, this));

	this._initialize_listeners();
};

(function(my) {
	var proto = my.prototype;

	var index_change_event_str = "index_change"; // value, key, to, from
	var put_event_str = "put"; // value, key, index
	var remove_event_str = "remove"; // value, key, index
	var value_change_event_str = "value_change"; // to_value, key, from_value, index
	var move_event_str = "move"; // value, key, to_index, from_index

	get_categorical_listeners(proto, {
		"Put":  put_event_str,
		"Remove":  remove_event_str,
		"ValueChange":  value_change_event_str,
		"IndexChange":  index_change_event_str,
		"Move":  move_event_str
	});

	proto._find_key = function(key, fetch_unsubstantiated, create_unsubstantiated) {
		var hash = this._hash(key);
		var rv = {
			hv: false
			, i: -1
			, h: hash
			, ui: -1
			, uhv: false
		};

		var eq = this._equality_check;
		var index_where_fn = function(a, b) {
					return eq(a.key.get(), key);
				};

		var hash_values = this._values[hash];
		if(isArray(hash_values)) {
			var key_index = index_where(hash_values, index_where_fn);
			rv.hv = hash_values;
			rv.i = key_index;
		}

		if(rv.i < 0 && fetch_unsubstantiated !== false) { //Not found
			var unsubstantiated_values = this._unsubstantiated_values[hash];
			var unsubstantiated_index = -1; 
			if(isArray(unsubstantiated_values)) {
				unsubstantiated_index = index_where(unsubstantiated_values, index_where_fn);
			} else {
				if(create_unsubstantiated) {
					unsubstantiated_values = this._unsubstantiated_values[hash] = [];
				}
			}

			if(unsubstantiated_index < 0 && create_unsubstantiated === true) {
				var unsubstantiated_info = { key: cjs.$(key, true), value: cjs.$(undefined, true), index: cjs.$(-1, true) };
				unsubstantiated_values.push(unsubstantiated_info);
				unsubstantiated_index = unsubstantiated_values.length-1;
			}
			rv.uhv = unsubstantiated_values;
			rv.ui = unsubstantiated_index;
		}
		return rv;
	};
	proto._do_set_item_ki = function(ki, key, value, index, ignore_events) {
		var key_index = ki.i,
			hash_values = ki.hv,
			hash = ki.h;
		if(!hash_values) {
			hash_values = this._values[hash] = [];
		}

		var info;
		if(key_index >= 0) {
			info = hash_values[key_index];
			var old_value = info.value.get();
			info.value.set(value, true);
			if(ignore_events !== true) {
				this._queued_events.push([value_change_event_str, info.value, info.key, old_value, info.index]);
			}
		} else {
			if(!isNumber(index) || index < 0) {
				index = this._ordered_values.length;
			}
			var unsubstantiated_index = ki.ui;
			if(unsubstantiated_index >= 0) {
				var unsubstantiated_hash_values = ki.uhv,
					unsubstantiated_info = unsubstantiated_hash_values[unsubstantiated_index];

				unsubstantiated_hash_values.splice(unsubstantiated_index, 1);
				if(unsubstantiated_hash_values.length === 0) {
					delete this._unsubstantiated_values[hash];
				}

				info = unsubstantiated_info;
				info.value.set(value, true);
				info.index.set(index, true);
			} else {
				info = { key: cjs.$(key, true), value: cjs.$(value, true), index: cjs.$(index, true) };
			}

			hash_values.push(info);
			this._ordered_values.splice(index, 0, info);

			if(ignore_events !== true) {
				this._queued_events.push([put_event_str, value, key, index]);
			}
			for(var i = index + 1; i<this._ordered_values.length; i++) {
				this._set_index(this._ordered_values[i], i, ignore_events);
			}
			this.$size.invalidate();
			this.$keys.invalidate();
			this.$values.invalidate();
			this.$entries.invalidate();
		}
	};

	proto._set_index = function(info, to_index, ignore_events) {
		var old_index = info.index.get;
		info.index.set(to_index);
		if(ignore_events !== false) {
			this._queued_events.push([index_change_event_str, info.value, info.key, info.index, old_index]);
		}
	};
	var _destroy_info = function(infos) {
		each(infos, function(info) {
			info.key.destroy();
			info.value.destroy();
			info.index.destroy();
		});
	};
	proto._remove_index = function(index) {
		var info = this._ordered_values[index];
		this._queued_events.push([remove_event_str, info.value.get(), info.key.get(), info.index.get()]);
		_destroy_info(this._ordered_values.splice(index, 1));
		this.$size.invalidate();
	};

	proto.set = proto.put = function(key, value, index) {
		cjs.wait();
		this.wait();
		var ki = this._find_key(key, true, false);
		this._do_set_item_ki(ki, key, value, index);
		this.signal();
		cjs.signal();
		return this;
	};
	proto.remove = function(key) {
		var ki = this._find_key(key, false, false);
		var key_index = ki.i,
			hash_values = ki.hv;
		if(key_index >= 0) {
			cjs.wait(); this.wait();

			var info = hash_values[key_index];
			var ordered_index = info.index.get();

			hash_values.splice(key_index, 1);
			if(hash_values.length === 0) {
				delete hash_values[key_index]
			}

			this._remove_index(ordered_index);
			for(var i = ordered_index; i<this._ordered_values.length; i++) {
				this._set_index(this._ordered_values[i], i);
			}

			this.$keys.invalidate();
			this.$values.invalidate();
			this.$entries.invalidate();

			this.signal(); cjs.signal();
		}
		return this;
	};
	proto.get = function(key) {
		var ki = this._find_key(key, true, true);
		var key_index = ki.i,
			hash_values = ki.hv;
		if(key_index >= 0) {
			var info = hash_values[key_index];
			return info.value.get();
		} else {
			var unsubstantiated_info = ki.uhv[ki.ui];
			return unsubstantiated_info.value.get();
		}
	};
	proto.keys = function() {
		return this.$keys.get();
	};
	proto._do_get_keys = function() {
		var rv = [];
		this.each(function(value, key) {
			rv.push(key);
		});
		return rv;
	};
	proto.clear = function() {
		if(this._do_get_size() > 0) {
			cjs.wait();
			this.wait();
			while(this._ordered_values.length > 0) {
				this._remove_index(0);
			}
			each(this._values, function(arr, hash) {
				delete this._values[hash];
			}, this);

			this.$keys.invalidate();
			this.$values.invalidate();
			this.$entries.invalidate();
			this.$size.invalidate();

			this.signal();
			cjs.signal();
		}
		return this;
	};
	proto.values = function() {
		return this.$values.get();
	};
	proto._do_get_values = function() {
		var rv = [];
		this.each(function(value, key) {
			rv.push(value);
		});
		return rv;
	};
	proto._do_get_size = function() {
		return this._ordered_values.length; 
	};
	proto.size = function() {
		return this.$size.get();
	};
	proto.entries = function() {
		return this.$entries.get();
	};
	proto._do_get_entries = function() {
		var rv = [];
		this.each(function(value, key) {
			rv.push({key: key, value: value});
		});
		return rv;
	};
	proto.each = function(func, context) {
		context = context || root;
		var i, len = this._ordered_values.length;
		for(i=0; i<len; i++) {
			var info = this._ordered_values[i];
			if(info) {
				if(func.call(context, info.value.get(), info.key.get(), info.index.get()) === false) {
					break;
				}
			}
		}
		return this;
	};
	proto.set_equality_check = function(equality_check) {
		this._equality_check = equality_check;
		return this;
	};
	proto.item = function(arg0, arg1, arg2) {
		if(arguments.length === 1) {
			return this.get(arg0);
		} else if(arguments.length >= 2) {
			this.put(arg0, arg1, arg2);
		}
		return this;
	};
	proto.indexOf = function(key) {
		var ki = this._find_key(key, true, true);
		var key_index = ki.i,
			hash_values = ki.hv;
		if(key_index >= 0) {
			var info = hash_values[key_index];
			return info.index.get();
		} else {
			var unsubstantiated_info = ki.uhv[ki.ui];
			return unsubstantiated_info.index.get();
		}
	};
	proto.get_or_put = function(key, create_fn, create_fn_context, index) {
		var ki = this._find_key(key, false, false);
		var key_index = ki.i,
			hash_values = ki.hv,
			hash = ki.h;
		if(key_index >= 0) {
			var info = hash_values[key_index];
			return info.value.get();
		} else {
			cjs.wait();
			this.wait();
			var context = create_fn_context || root;
			var value = create_fn.call(context, key);
			this._do_set_item_ki(ki, key, value, index);
			this.signal();
			cjs.signal();
			return value;
		}
	};
	proto.has = proto.containsKey = function(key) {
		var ki = this._find_key(key, true, true);
		var key_index = ki.i;
		return key_index >= 0;
	};
	proto.containsValue = function(value, eq_check) {
		eq_check = eq_check || eqeqeq;
		var rv = false;
		this.each(function(v, k) {
			if(eq_check(value, v)) {
				rv = true;
				return false;
			}
		});
		return rv;
	};
	proto.move_index = function(old_index, new_index) {
		cjs.wait();
		this.wait();
		var info = this._ordered_values[old_index];
		this._ordered_values.splice(old_index, 1);
		this._ordered_values.splice(new_index, 0, info);
		this._queued_events.push([move_event_str, info.value.get(), info.key.get(), new_index, old_index]);

		var low = Math.min(old_index, new_index);
		var high = Math.max(old_index, new_index);
		for(var i = low; i<= high; i++) {
			this._set_index(this._ordered_values[i], i);
		}
		this.$keys.invalidate();
		this.$values.invalidate();
		this.$entries.invalidate();
		this.signal();
		cjs.signal();
		return this;
	};
	proto.move = function(key, to_index) {
		var ki = this._find_key(key, false, false);
		var key_index = ki.i;
		if(key_index >= 0) {
			var info = ki.hv[key_index];
			this.move_index(info.index.get(), to_index);
		}
		return this;
	};
	proto.keyForValue = function(value, eq_check) {
		eq_check = eq_check || eqeqeq;
		var key;
		this.each(function(v, k) {
			if(eq_check(value, v)) {
				key = k;
				return false;
			}
		});
		return key;
	};
	proto.isEmpty = function() {
		return this.size() === 0;
	};
	proto.destroy = function() {
		this.wait();
		cjs.wait();
		this.clear();
		this.$keys.destroy();
		this.$values.destroy();
		this.$entries.destroy();
		cjs.signal();
		this.signal();
	};
	proto.toObject = function(key_map_fn) {
		key_map_fn = key_map_fn || identity;
		var rv = {};
		this.each(function(v, k) { rv[key_map_fn(k)] = v; });
		return rv;
	};
}(MapConstraint));

cjs.map = function(arg0, arg1) { return new MapConstraint(arg0, arg1); };
cjs.is_map = function(obj) { return obj instanceof MapConstraint; };
cjs.MapConstraint = MapConstraint;

var memoize_default_hash = function() {
	var rv = "";
	for(var i = 0; i<arguments.length; i++) {
		rv += "" + arguments[i];
	}
	return rv;
};
var memoize_default_equals = function(args1, args2) {
	if(args1.length === args2.length) {
		for(var i = 0; i<args1.length; i++) {
			var arg1 = args1[i],
				arg2 = args2[i];
			if(arg1 !== arg2) {
				return false;
			}
		}
		return true;
	} else {
		return false;
	}
};

cjs.memoize = function(getter_fn, options) {
	options = extend({
		hash: memoize_default_hash,
		equals: memoize_default_equals,
		context: root
	}, options);

	var args_map = cjs.map({
		hash: options.hash,
		equals: options.equals
	});

	var context = options.context;
	var rv = function() {
		var args = arguments;
		var constraint = args_map.get_or_put(args, function() {
			return new cjs.Constraint(function() {
				return getter_fn.apply(context, args)
			});
		});
		return constraint.get();
	};
	rv.destroy = function() {
		args_map.each(function(constraint) {
			constraint.destroy();
		}).destroy();
	};
	return rv;
};

if(__debug) { cjs._constraint_solver = constraint_solver; }

return cjs;
}(this));
