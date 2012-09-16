var cjs = (function (root) {
//
// ============== UTILITY FUNCTIONS ============== 
//

// Return a unique id when called
var uniqueId = (function() {
	var id = 0;
	return function() { return id++; };
}());

// Return the first item in arr where test is true
var index_where = function(arr, test) {
	var i, len = arr.length;
	for(i = 0; i<len; i++) {
		if(test(arr[i], i)) { return i; }
	}
	return -1;
};

var eqeqeq = function(a, b) { return a === b; };
// Return the first item in arr equal to item (where equality is defined in equality_check)
var index_of = function(arr, item, equality_check) {
	equality_check = equality_check || eqeqeq;
	return index_where(arr, function(x) { return equality_check(item, x); });
};

// Remove a set of items from an array
var remove_index = function(arr, from, to) {
	//http://ejohn.org/blog/javascript-array-remove/
	var rest = arr.slice((to || from) + 1 || arr.length);
	arr.length = from < 0 ? arr.length + from : from;
	return arr.push.apply(arr, rest);
};

// Remove an item in an array
var remove = function(arr, obj) {
	var index = _.index_of(arr, obj);
	if(index>=0) { remove_index(arr, index); }
};

// Remove every item from an array
var clear = function(arr) {
	arr.length = 0;
};
  
var toString = Object.prototype.toString;
// Is a given value a number?
var isNumber = function(obj) {
	return toString.call(obj) == '[object Number]';
};

// Is a given value an array?
// Delegates to ECMA5's native Array.isArray
var isArray = Array.isArray || function(obj) {
	return toString.call(obj) == '[object Array]';
};
  
// Is a given value a function?
var isFunction = function(obj) {
	return toString.call(obj) == '[object Function]';
};

var isString = function(obj) {
	return toString.call(obj) == '[object String]';
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
	var args = Array.prototype.slice.call(arguments, 1)
		, i
		, len = args.length;
	for(i = 0; i<len; i++) {
		var source = args[i];
		for (var prop in source) {
			obj[prop] = source[prop];
		}
	}
	return obj;
};

var last = function(arr) {
	return arr[arr.length - 1];
};



//
// ============== CJS CORE ============== 
//

// The star of the show!
var cjs = function () {
	return cjs.$.apply(cjs, arguments);
};
cjs.version = "1.0.0";

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
		proto.mark_invalid = function(reasonChain) { this.valid = false; };
		proto.mark_valid = function(reasonChain) { this.valid = true; };
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
		this.nullification_listeners = {};
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
			delete this.nullification_listeners[node.id];
			node.destroy();
		};

		proto.getNodeDependency = function(fromNode, toNode) { return this.getEdge(fromNode, toNode); };
		proto.addNodeDependency = function(fromNode, toNode) { return this.addEdge(new ConstraintEdge(fromNode, toNode)); };

		proto.removeNodeDependency = function(fromNode, toNode) { this.graph.removeEdge(fromNode, toNode); };

		proto.nullifyNode = function(node) {
			var i, j, outgoingEdges;
			var to_nullify = [node];
			for(i = 0; i<to_nullify.length; i++) {
				var curr_node = to_nullify[i];
				if(curr_node.is_valid()) {
					curr_node.mark_invalid();

					var nullification_listeners = this.get_nullification_listeners(curr_node);
					this.nullified_call_stack.push.apply(this.nullified_call_stack, nullification_listeners);

					var outgoingEdges = curr_node.getOutgoing();
					for(j = 0; j<outgoingEdges.length; j++) {
						var outgoingEdge = outgoingEdges[j];
						var dependentNode = outgoingEdge.toNode;
						if(outgoingEdge.timestamp < dependentNode.timestamp) {
							this.removeNodeDependency(outgoingEdge);
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
				for(i = 0; i<this.nullified_call_stack.length; i++) {
					var nullified_callback = this.nullified_call_stack[i];
					nullified_callback();
				}
				clear(this.nullified_call_stack); 
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
			var id = node.id;
			if(isNumber(id)) {
				var listeners = this.nullification_listeners[id];
				if(!isArray(listeners)) { this.nullification_listeners[id] = listeners = []; }
				listeners.push(callback);
			}
		};

		proto.off_nullify = function(arg0, callback) {
			var node = arg0 instanceof ConstraintNode ? arg0 : this.getNode(arg0);
			var id = node.id;
			if(isNumber(id)) {
				var listeners = this.nullification_listeners[id];
				if(isArray(listeners)) { remove(listeners, callback); }
			}
			remove(this.nullified_call_stack, callback);
		};

		proto.get_nullification_listeners = function(arg0) {
			var node = arg0 instanceof ConstraintNode ? arg0 : this.getNode(arg0);
			var id = node.id;
			if(isNumber(id)) {
				var listeners = this.nullification_listeners[id];
				if(isArray(listeners)) {
					return listeners;
				}
			}
			return [];
		};

		proto.getEdge = function(fromNode, toNode) {
			return fromNode.getEdgeTo(toNode);
		};

		proto.addEdge = function(edge){
			edge.fromNode.addOutgoingEdge(edge);
			edge.toNode.addIncomingEdge(edge);
			return edge;
		};

		proto.removeEdge = function(fromNode, toNode) {
			var edge = this.getEdge(fromNode, toNode);
			if(edge!==null) {
				fromNode.removeOutgoingEdge(edge);
				toNode.removeIncomingEdge(edge);
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
	this.invalidate = function() {
		constraint_solver.nullifyNode(node);
	};
	this.equality_check = eqeqeq;
};

(function(my) {
	var proto = my.prototype;
	proto.destroy = function() { constraint_solver.removeObject(this); };
	proto.cjs_getter = function() {
		if(this.hasOwnProperty("value")) {
			if(isFunction(this.value) && !this.literal){
				return this.value();
			} else {
				return this.value;
			}
		}
		return undefined;
	};
	proto.set = function(value, literal) {
		var was_literal = this.literal;
		var old_value = this.value;

		this.literal = literal === true;
		this.value = value;
		
		if(!this.equality_check(was_literal, this.literal) || !this.equality_check(old_value !== this.value)) {
			this.invalidate();
		}
		return this;
	};
	proto.get = function() { return constraint_solver.getValue(this); };
	proto.onChange = function(callback) {
		constraint_solver.on_nullify(this, callback);
		this.get();
	};
	proto.offChange = function(callback) {
		constraint_solver.off_nullify(this, callback);
	};
}(Constraint));

cjs.is_constraint = cjs.is_$ = function(obj) {
	return obj instanceof Constraint;
};

cjs.$ = function(arg0, arg1) {
	return new Constraint(arg0, arg1);
};

cjs.$.extend = function(arg0, arg1) {
	var values;
	if(isString(arg0)) {
		values = {};
		values[arg0] = arg1;
	} else {
		values = arg0;
	}

	for(var key in values) {
		var value = values[key];
		Constraint.prototype[key] = function() {
			var self = this;
			var args = arguments;
			return cjs.$(function() {
				return value.apply(self, args);
			});
		};
	}
};

//
// ============== LIVEN ============== 
//

cjs.liven = function() {
	var runner = function() {
			var i; len = arguments.length;
			for(i = 0; i<len; i++) {
				arguments[i]();
			}
		};
	var node = constraint_solver.add({
		cjs_getter: runner
	}, {
		auto_add_outgoing_dependencies: false,
		cache_value: false
	});

	constraint_solver.on_nullify(node, runner);
	runner();

	return {
		destroy: function() {
			constraint_solver.removeObject(node);
		}
	};
};


//
// ============== ARRAYS ============== 
//

var ArrayConstraint = function(value) {
	this.value = [];
	if(isArray(value)) {
		var i, len = value.length;
		for(i = 0; i<value.length; i++) {
			var val = value[i];
			this.value.push(cjs.$(val));
		}
	}
};

(function(my) {
	var proto = my.prototype;
	proto.item = function(key, value) {
	};
}(ArrayConstraint));

cjs.array = function(value) { return new ArrayConstraint(value); };

//
// ============== MAPS ============== 
//

var MapConstraint = function(arg0, arg1) {
};

(function(my) {
	var proto = my.prototype;
}(MapConstraint));

cjs.map = function(arg0, arg1) { return new MapConstraint(arg0, arg1); };

//
// ============== ASYNCHRONOUS CONSTRAINTS ============== 
//

cjs.async = function() {
};

return cjs;
}(this));
