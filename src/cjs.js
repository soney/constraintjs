var cjs = (function (root) {
//
// ============== CJS CORE ============== 
//

// The star of the show!
var old_cjs = root.cjs;
var cjs = function () { return cjs.$.apply(cjs, arguments); };
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

var camel_case = (function() {
	var rdashAlpha = /-([a-z]|[0-9])/ig, rmsPrefix = /^-ms-/;
	var fcamelCase = function(all, letter) {
		return String(letter).toUpperCase();
	};
	return function(string) {
		return string.replace( rmsPrefix, "ms-" ).replace(rdashAlpha, fcamelCase);
	};
}());

// Return a unique id when called
var uniqueId = (function() {
	var id = 0;
	return function() { return id++; };
}());

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

// Is a given variable an arguments object?
var isArguments = function(obj) {
	return toString.call(obj) == '[object Arguments]';
};
  
// Safely convert anything iterable into a real, live array.
var toArray = function(obj) {
	if (!obj)                                     return [];
	if (isArray(obj))                           return slice.call(obj);
	if (isArguments(obj))                       return slice.call(obj);
	if (obj.toArray && _.isFunction(obj.toArray)) return obj.toArray();
	return _.values(obj);
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
	var args = slice.call(arguments, 1)
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
			if (has(obj, key)) {
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


var nativeFilter = Array.prototype.filter;
var filter = function(obj, iterator, context) {
	var results = [];
	if (obj == null) { return results; }
	if (nativeFilter && obj.filter === nativeFilter) { return obj.filter(iterator, context); }
	var i, len = obj.length, value;
	for(i = 0; i<len; i++) {
		value = obj[i];
		if(iterator.call(context, value, i, obj)) { results.push(value); }
	}
	return results;
};

//Longest common subsequence
//http://rosettacode.org/wiki/Longest_common_subsequence#JavaScript
var indexed_lcs = (function() {
	var popsym = function(index, x, y, symbols, r, n, equality_check) {
		var s = x[index],
			pos = symbols[s]+1;
		pos = index_of(y, s, pos>r?pos:r, equality_check);
		if(pos===-1){pos=n;}
		symbols[s]=pos;
		return pos;
	};
	return function(x, y, equality_check) {
		var symbols = {},
			r=0,p=0,p1,L=0,idx,i,
			m=x.length,n=y.length,
			S = new Array(m<n?n:m);
		if(n === 0 || m === 0) { return []; }
		p1 = popsym(0, x, y, symbols, r, n, equality_check);
		for(i=0;i < m;i++){
			p = (r===p)?p1:popsym(i, x, y, symbols, r, n, equality_check);
			p1 = popsym(i+1, x, y, symbols, r, n, equality_check);
			idx=(p > p1)?(i++,p1):p;
			if(idx===n || i===m) {
				p=popsym(i, x, y, symbols, r, n, equality_check);
			} else {
				r=idx;
				S[L++]={item: x[i], indicies: [i, idx]};
			}
		}
		return S.slice(0,L);
	};
}());

var diff = function(x, y, equality_check) {
	equality_check = equality_check || eqeqeq;
	var i,j;
	var x_clone = x.slice(),
		y_clone = y.slice();
	var d = [], xi, yj, x_len = x_clone.length, found;
	for(i = 0; i<x_len; i++) {
		found = false;
		xi = x_clone[i];
		for(j = 0; j<y_clone.length; j++) {
			yj = y_clone[j];
			if(equality_check(xi, yj)) {
				found = true;
				y_clone.splice(j, 1);
				break;
			}
		}
		if(found === false) { d.push(xi); }
	}
	return d;
};
var dualized_intersection = function(x, y, equality_check) {
	equality_check = equality_check || eqeqeq;
	var i,j;
	var x_clone = x.slice(),
		y_clone = y.slice();
	var d = [], xi, yj, x_len = x_clone.length, found;
	for(i = 0; i<x_len; i++) {
		found = false;
		xi = x_clone[i];
		for(j = 0; j<y_clone.length; j++) {
			yj = y_clone[j];
			if(equality_check(xi, yj)) {
				d.push([xi, yj]);
				y_clone.splice(j, 1);
				break;
			}
		}
	}
	return d;
};

var array_source_map = function(from, to, equality_check) {
		equality_check = equality_check || eqeqeq;
		var item_aware_equality_check = function(a, b) {
			var a_item = a == null ? a : a.item;
			var b_item = b == null ? b : b.item;
			return equality_check(a_item, b_item);
		};
		var indexed_common_subsequence = map(indexed_lcs(from, to), function(info) { 
			return {item: info.item, from: info.indicies[0], to: info.indicies[1]};
		});

		var indexed_from = map(from, function(x,i) { return {item: x, index: i}; });
		var indexed_to = map(to, function(x,i) { return {item: x, index: i}; });

		var indexed_removed = diff(indexed_from, indexed_common_subsequence, item_aware_equality_check),
			indexed_added = diff(indexed_to, indexed_common_subsequence, item_aware_equality_check),
			indexed_moved = map(dualized_intersection(indexed_removed, indexed_added, item_aware_equality_check),
				function(info) {
					var from = info[0].index,
						from_item = info[0].item,
						to = info[1].index,
						to_item = info[1].item;
					return {item: to_item, from: from, to: to, from_item: from_item, to_item: to_item};
				}
			);
		indexed_added = diff(indexed_added, indexed_moved, item_aware_equality_check);
		indexed_removed = diff(indexed_removed, indexed_moved, item_aware_equality_check);

		var to_mappings = map(to, function(item, index) {
				var info_index = index_where(indexed_added, function(info) {
					return info.index === index;
				});
				if(info_index >= 0) {
					var info = indexed_added[info_index];
					return { to: index, to_item: item, item: item };
				}

				info_index = index_where(indexed_moved, function(info) {
					return info.to === index;
				});
				if(info_index >= 0) {
					var info = indexed_moved[info_index];
					return { to: index, to_item: item, item: item, from: info.from, from_item: info.from_item };
				}

				info_index = index_where(indexed_common_subsequence, function(info) {
					return info.to === index;
				});
				if(info_index >= 0) {
					var info = indexed_common_subsequence[info_index];
					return { to: index, to_item: item, item: item, from: info.from, from_item: from[info.from] };
				}
			});
		var removed_mappings = map(indexed_removed, function(info) {
			return { from: info.index, from_item: info.item };
		});
		var mappings = to_mappings.concat(removed_mappings);
		return mappings;
	};


var array_differ = function(val, equality_check) {
	equality_check = equality_check || eqeqeq;
	var last_val = isArray(val) ? val : [];
	return function(val) {
		var source_map = array_source_map(last_val, val, equality_check);
		var rearranged_array = source_map.slice().sort(function(a,b) {
			var a_has_from = has(a, "from"),
				b_has_from = has(b, "from");
			if(a_has_from && b_has_from) { return a.from - b.from; }
			else if(a_has_from && !b_has_from) { return -1; }
			else if(!a_has_from && b_has_from) { return 1; }
			else { return 0; }
		});
		var added = filter(source_map, function(info) { return !has(info, "from"); }).reverse(), // back to front
			removed = filter(rearranged_array, function(info) { return !has(info, "to"); }).reverse(), // back to frong
			index_changed = filter(source_map, function(info) { return has(info, "from") && has(info, "to") && info.from !== info.to; }),
			moved = [];

		each(removed, function(info) { rearranged_array.splice(info.from, 0); });
		each(added, function(info) { rearranged_array.splice(info.to, 0); });
		
		each(source_map, function(info, index) {
			if(has(info, "from") && has(info, "to")) {
				if(rearranged_array[index] !== info) {
					var rearranged_array_info_index = index_of(rearranged_array, info, index);
					rearranged_array.splice(index, 0, rearranged_array.splice(rearranged_array_info_index, 1)[0]);
					moved.push({move_from: rearranged_array_info_index, insert_at: index, item: info.item, from: info.from, to: info.to});
				}
			}
		});
		last_val = val;
		return { added: added, removed: removed, moved: moved, index_changed: index_changed , mapping: source_map};
	};
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
		constraint_solver.on_nullify(this, callback);
		this.get();
		this._change_listeners.push(callback);
		return this._change_listeners.length - 1;
	};
	proto.offChange = function(callback) {
		if(isNumber(callback)) {
			callback = this._change_listeners[callback];
			delete this._change_listeners[callback];
		}
		constraint_solver.off_nullify(this, callback);
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

cjs.$.extend({
	item: function(key) {
		var my_constraint = this;
		return new Constraint(function() {
			var got = my_constraint.get();
			if(got != null) { return got[cjs.get(key)]; }
			else { return undefined; }
		});
	}
	, indexOf: function(item, equality_check) {
		var got = this.get();
		return index_of(got, item, 0, equality_check);
	}
	, add: function() {
		var my_constraint = this;
		var args = arguments;
		return new Constraint(function() {
			var rv = my_constraint.get();
			each(args, function(arg) { rv += cjs.get(arg); });
			return rv;
		});
	}
	, sub: function() {
		var my_constraint = this;
		var args = arguments;
		return new Constraint(function() {
			var rv = my_constraint.get();
			each(args, function(arg) { rv -= cjs.get(arg); });
			return rv;
		});
	}
	, mul: function() {
		var my_constraint = this;
		var args = arguments;
		return new Constraint(function() {
			var rv = my_constraint.get();
			each(args, function(arg) { rv *= cjs.get(arg); });
			return rv;
		});
	}
	, div: function() {
		var my_constraint = this;
		var args = arguments;
		return new Constraint(function() {
			var rv = my_constraint.get();
			each(args, function(arg) { rv /= cjs.get(arg); });
			return rv;
		});
	}
	, func: function(the_func) {
		var my_constraint = this;
		return new Constraint(function() {
			var rv = the_func(my_constraint.get());
			return rv;
		});
	}
	, map: function(func) {
		var my_constraint = this;
		var old_val, old_rv;
		return new Constraint(function() {
			var val = my_constraint.get();
			if(val === old_val) { return old_rv; }
			else { old_val = val; }
			if(isArray(val)) {
				return old_rv = map(val, func);
			} else {
				return undefined;
			}
		});
	}
});

//
// ============== LIVEN ============== 
//

cjs.liven = function(func, context) {
	context = context || this;
	var node = constraint_solver.add({
		cjs_getter: function() {
			func.call(context);
		},
		auto_add_outgoing_dependencies: false,
		cache_value: false
	});

	var do_get = function() {
		constraint_solver.getNodeValue(node);
	};

	constraint_solver.on_nullify(node, do_get);
	constraint_solver.nullified_call_stack.push(do_get);
	if(constraint_solver.semaphore >= 0) {
		constraint_solver.run_nullified_listeners();
	}

	return {
//		node: node, //TODO: remove node & runner
//		runner: runner, 
		destroy: function() {
			constraint_solver.off_nullify(node, do_get);
			constraint_solver.removeObject(node);
		}
	};
};


//
// ============== ARRAYS ============== 
//

var ArrayConstraint = function(value) {
	this._value = [];
	this._unsubstantiated_items = [];
	if(isArray(value)) {
		var i, len = value.length;
		for(i = 0; i<value.length; i++) {
			var val = value[i];
			this._value.push(cjs.$(val, true));
		}
	}
	this._len = cjs.$(this._value.length);
	this._equality_check = eqeqeq;
	var self = this;
	this.$value = new Constraint(function() {
		return self._getter();
	});
	this._add_listeners = [];
	this._remove_listeners = [];
	this._move_listeners = [];
	this._index_change_listeners = [];
	this._diff_listener_id = this._install_diff_listener();
};

(function(my) {
	var proto = my.prototype;
	proto.set_equality_check = function(equality_check) { this._equality_check = equality_check; return this; };

	var diff_events = {
		"Add": "_add_listeners",
		"Remove": "_remove_listeners",
		"Move": "_move_listeners",
		"IndexChange": "_index_change_listeners"
	};
	each(diff_events, function(arr_name, diff_event) {
		proto["on" + diff_event] = function(listener) {
			var arr = this[arr_name];
			arr.push(listener);
			return arr.length-1;
		};
		proto["off" + diff_event] = function(listener) {
			var arr = this[arr_name];
			var listener_index;

			if(isNumber(listener)) { listener_index = listener; }
			else { listener_index = index_of(arr, listener); }

			if(listener_index >= 0) { delete this._add_listeners[listener]; }
		};
	});

	proto._install_diff_listener = function() {
		var self = this;
		var ad = array_differ(this.get(), this._equality_check);
		return this.$value.onChange(function() {
			var diff = ad(self.get());
			each(self._remove_listeners, function(listener) {
				each(diff.removed, function(info) {
					listener(info.item, info.from);
				});
			});
			each(self._add_listeners, function(listener) {
				each(diff.added, function(info) {
					listener(info.item, info.to);
				});
			});
			each(self._move_listeners, function(listener) {
				each(diff.moved, function(info) {
					listener(info.item, info.to, info.from);
				});
			});
			each(self._index_change_listeners, function(listener) {
				each(diff.index_changed, function(info) {
					listener(info.item, info.to, info.from, info.from_item);
				});
			});
		});
	};
	proto._uninstall_diff_listener = function() {
		this.$value.offChange(this._diff_listener_id);
	};
	proto.destroy = function() {
		this._uninstall_diff_listener();
		this.$value.destroy();
		this._len.destroy();
	};
	proto.onChange = function(callback) {
		return this.$value.onChange.apply(this.$value, arguments);
	};
	proto.offChange = function(callback) {
		this.$value.offChange.apply(this.$value, arguments);
	};
	proto.item = function(key, arg1) {
		var val;
		if(arguments.length === 1) {
			val = this._value[key];
			if(val === undefined) {
				// Create a dependency so that if the value for this key changes
				// later on, we can detect it in the constraint solver
				val = cjs.$(undefined);
				this._unsubstantiated_items[key] = val;
			}
			return val.get();
		} else if(arguments.length > 1) {
			val = arg1;
			var $previous_value = this._value[key];
			if($previous_value === undefined) {
				if(has(this._unsubstantiated_items, key)) {
					$previous_value = this._unsubstantiated_items[key];
					delete this._unsubstantiated_items[key];
				}
			}

			if(cjs.is_constraint($previous_value)) {
				$previous_value.set(val);
			} else {
				this._value[key] = cjs.$(val, true);
			}
			this._update_len();
			return this;
		}
	};
	proto.length = function() {
		return this._len.get();
	};
	proto.push = function() {
		var i, len = arguments.length;
		//Make operation atomic
		cjs.wait();
		for(i = 0; i<len; i++) {
			this.item(this._value.length, arguments[i]);
		}
		cjs.signal();
		return arguments.length;
	};
	proto.pop = function() {
		cjs.wait();
		var $value = this._value.pop();
		var rv = undefined;
		if(cjs.is_constraint($value)) {
			rv = $value.get();
			$value.destroy();
		}
		this._update_len();
		cjs.signal();
		return rv;
	};
	proto.clear = function() {
		var $val;
		cjs.wait();
		while(this._value.length > 0) {
			$val = this._value.pop();
			if(cjs.is_constraint($val)) { $val.destroy(); }
		}
		cjs.signal();
	};
	proto.set = function(arr) {
		cjs.wait();
		this.clear();
		this.push.apply(this, arr);
		cjs.signal();
		return this;
	};
	proto._getter = function() {
		var i, len = this.length();
		var rv = [];
		for(i = 0; i<len; i++) {
			rv.push(this.item(i));
		}
		return rv;
	};
	proto.get = function() {
		return this.$value.get();
	};
	proto._update_len = function() {
		this._len.set(this._value.length);
	};
	proto.indexWhere = function(filter) {
		var i, len = this._value.length, $val;

		for(i = 0; i<len; i++) {
			$val = this._value[i];
			if(filter($val.get())) { return i; }
		}
		this.length(); // We want to depend on the length if 

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
		var to_insert = Array.prototype.slice.call(arguments, 2);

		cjs.wait();
		var resulting_shift_size = to_insert.length - howmany;
		var removed = [];
		if(resulting_shift_size < 0) {
			for(i = index; i<this._value.length + resulting_shift_size; i++) {
				if(i-index < howmany) {
					removed.push(this.item(i));
				}

				if(i-index < to_insert.length) {
					this.item(i, to_insert[i-index]);
				} else {
					this.item(i, this.item(i - resulting_shift_size));
				}
			}
			for(i = 0; i<-resulting_shift_size; i++) {
				removed.push(this.pop());
			}
		} else {
			for(i = index; i<index+howmany; i++) {
				removed.push(this.item(i));
			}

			for(i = this._value.length + resulting_shift_size - 1; i>=index; i--) {
				if(i-index < to_insert.length) {
					this.item(i, to_insert[i-index]);
				} else {
					this.item(i, this.item(i - resulting_shift_size));
				}
			}
		}

		this._update_len();
		cjs.signal();
		return removed;
	};
	proto.concat = function() {
		var args = [], i, len = arguments.length;
		for(i = 0; i<len; i++) {
			var arg = arguments[i];
			if(arg instanceof ArrayConstraint) {
				args.push(arg.get());
			} else {
				args.push(arg);
			}
		}
		var my_val = this.get();
		return my_val.concat.apply(my_val, args);
	};
	proto.shift = function() { var rv_arr = this.splice(0, 1); return rv_arr[0]; };
	proto.unshift = function() {
		var args = Array.prototype.slice.call(arguments, 0);
		this.splice.apply(this, ([0, 0]).concat(args));
		return this._value.length;
	};
	proto.join = function() { var my_val = this.get(); return my_val.join.apply(my_val, arguments); };
	proto.slice = function() { var my_val = this.get(); return my_val.slice.apply(my_val, arguments); };
	proto.sort = function() { var my_val = this.get(); return my_val.sort.apply(my_val, arguments); };
	proto.reverse = function() { var my_val = this.get(); return my_val.reverse.apply(my_val, arguments); };
	proto.valueOf = function() { var my_val = this.get(); return my_val.valueOf.apply(my_val, arguments); };
	proto.toString = function() { var my_val = this.get(); return my_val.toString.apply(my_val, arguments); };
	proto.$shadow = function(onAdd, onRemove, onMove, context) {
		context = context || this;
		var ad = array_differ([], this._equality_check);
		var mapped_value = [];
		var self = this;
		return new Constraint(function() {
			var value = self.get();
			var diff = ad(value);
			each(diff.removed, function(info) {
				if(isFunction(onRemove)) {
					onRemove(info.item, info.from, mapped_value);
				}
				mapped_value.splice(info.from, 1);
			});
			each(diff.added, function(info) {
				var mapped_item;
				if(isFunction(onAdd)) {
					mapped_item = onAdd(info.item, info.to, info.from, mapped_value);
				} else {
					mapped_item = info.item;
				}
				mapped_value.splice(info.to, 0, mapped_item);
			});
			each(diff.moved, function(info) {
				if(isFunction(onMove)) {
					onMove(info.item, info.insert_at, info.move_from, mapped_value);
				}
				mapped_value.splice(info.insert_at, 0, mapped_value.splice(info.move_from, 1)[0]);
			});
			return mapped_value;
		});
	};
}(ArrayConstraint));

cjs.array = function(value) { return new ArrayConstraint(value); };
cjs.is_array = function(obj) { return obj instanceof ArrayConstraint; };
cjs.ArrayConstraint = ArrayConstraint;

//
// ============== MAPS ============== 
//

var MapConstraint = function(arg0, arg1, arg2) {
	var keys, values;
	if(arguments.length === 1) {
		for(var key in arg0) {
			keys.push(key);
			values.push(arg0[key]);
		}
	} else if(arguments.length > 1) {
		keys = arg0;
		values = arg1;
	}
	if(isArray(keys)) { this._keys = cjs.array(keys); }
	else if(keys instanceof ArrayConstraint) { this._keys = keys; }
	else if(cjs.is_constraint(keys)) { this._keys = keys; }
	else { this._keys = cjs.array(); }

	if(isArray(values)) { this._values = cjs.array(values); }
	else if(values instanceof ArrayConstraint) { this._values = keys; }
	else if(cjs.is_constraint(values)) { this._values = values; }
	else { this._values = cjs.array(); }

	this._equality_check = arg2 || eqeqeq;
	this._set_listeners = [];
	this._unset_listeners = [];
	this._key_change_listeners = [];
	this._value_change_listeners = [];
	this._move_listeners = [];
	this._index_change_listeners = [];
	var self = this;
	this.$value = new Constraint(function() {
		return {keys: self.keys(), values: self.values()};
	});
	this._diff_listener_id = this._install_diff_listener();
};

(function(my) {
	var proto = my.prototype;
	var diff_events = {
		"Set": "_set_listeners",
		"Unset": "_unset_listeners",
		"KeyChange": "_key_change_listeners",
		"ValueChange": "_value_change_listeners",
		"IndexChange": "_index_change_listeners",
		"Move": "_move_listeners"
	};
	each(diff_events, function(arr_name, diff_event) {
		proto["on" + diff_event] = function(listener) {
			var arr = this[arr_name];
			arr.push(listener);
			return arr.length-1;
		};
		proto["off" + diff_event] = function(listener) {
			var arr = this[arr_name];
			var listener_index;

			if(isNumber(listener)) { listener_index = listener; }
			else { listener_index = index_of(arr, listener); }

			if(listener_index >= 0) { delete this._add_listeners[listener]; }
		};
	});
	proto._install_diff_listener = function() {
		var key_differ = array_differ(this.keys(), this._equality_check);
		var value_differ = array_differ(this.values());
		var self = this;
		return this.$value.onChange(function() {
			var val = self.$value.get();
			var key_diff = key_differ(val.keys);
			var value_diff = value_differ(val.values);
			var set = [], unset = [], key_change = [], value_change = [], index_changed = [], moved = [];
			var i, j;
			for(i = 0; i<key_diff.added.length; i++) {
				var added_key = key_diff.added[i];
				for(j = 0; j<key_diff.removed.length; j++) {
					var removed_key = key_diff.removed[j];
					if(added_key.to === removed_key.from) {
						key_change.push({index: added_key.to, from: removed_key.from_item, to: added_key.item});
						key_diff.added.splice(i--, 1);
						key_diff.removed.splice(j--, 1);
						break;
					}
				}
			}
			for(i = 0; i<value_diff.added.length; i++) {
				var added_value = value_diff.added[i];
				for(j = 0; j<value_diff.removed.length; j++) {
					var removed_value = value_diff.removed[j];
					if(added_value.to === removed_value.from) {
						value_change.push({key: val.keys[added_value.to], index: added_value.to, from: removed_value.from_item, to: added_value.item});
						value_diff.added.splice(i--, 1);
						value_diff.removed.splice(j--, 1);
						break;
					}
				}
			}
			for(i = 0; i<key_diff.added.length; i++) {
				var added_key = key_diff.added[i];
				for(j = 0; j<value_diff.added.length; j++) {
					var added_val = value_diff.added[j];
					if(added_key.to === added_val.to) {
						set.push({index: added_key.to, key: added_key.item, value: added_val.item});
						key_diff.added.splice(i--, 1);
						value_diff.added.splice(j--, 1);
						break;
					}
				}
			}
			for(i = 0; i<key_diff.removed.length; i++) {
				var removed_key = key_diff.removed[i];
				for(j = 0; j<value_diff.removed.length; j++) {
					var removed_val = value_diff.removed[j];
					if(removed_key.to === removed_val.to) {
						unset.push({from: removed_key.from, key: removed_key.from_item, value: removed_val.from_item});
						key_diff.removed.splice(i--, 1);
						value_diff.removed.splice(j--, 1);
						break;
					}
				}
			}

			for(i = 0; i<key_diff.moved.length; i++) {
				var moved_key = key_diff.moved[i];
				for(j = 0; j<value_diff.moved.length; j++) {
					var moved_val = value_diff.moved[j];
					if(moved_key.to === moved_val.to && moved_key.from === moved_val.from) {
						moved.push({from: moved_key.from, to: moved_key.to, key: moved_key.item, value: moved_val.item, insert_at: moved_key.insert_at});
						key_diff.moved.splice(i--, 1);
						value_diff.moved.splice(j--, 1);
						break;
					}
				}
			}
			for(i = 0; i<key_diff.index_changed.length; i++) {
				var index_changed_key = key_diff.index_changed[i];
				for(j = 0; j<value_diff.index_changed.length; j++) {
					var index_changed_val = value_diff.index_changed[j];
					if(index_changed_key.to === index_changed_val.to && index_changed_key.from === index_changed_val.from) {
						index_changed.push({from: index_changed_key.from, to: index_changed_key.to, key: index_changed_key.item, value: index_changed_val.item});
						key_diff.index_changed.splice(i--, 1);
						value_diff.index_changed.splice(j--, 1);
						break;
					}
				}
			}
			each(self._set_listeners, function(listener) {
				each(set, function(info) {
					listener(info.value, info.key, info.index);
				});
			});
			each(self._unset_listeners, function(listener) {
				each(unset, function(info) {
					listener(info.value, info.key, info.from);
				});
			});
			each(self._key_change_listeners, function(listener) {
				each(key_change, function(info) {
					listener(info.to, info.from, info.index);
				});
			});
			each(self._value_change_listeners, function(listener) {
				each(value_change, function(info) {
					listener(info.to, info.key, info.from, info.index);
				});
			});
			each(self._move_listeners, function(listener) {
				each(moved, function(info) {
					listener(info.value, info.key, info.insert_at, info.to, info.from);
				});
			});
			each(self._index_change_listeners, function(listener) {
				each(index_changed, function(info) {
					listener(info.value, info.key, info.to, info.from);
				});
			});
		});
	};
	proto._uninstall_diff_listener = function() {
		this.$value.offChange(this._diff_listener_id);
	};
	proto.destroy = function() {
		this._keys.destroy();
		this._values.destroy();
		this._uninstall_diff_listener();
	};
	proto.keys = function() { return this._keys.get(); };
	proto.values = function() { return this._values.get(); };
	proto.get = function() { return this.$value.get(); };
	proto.set_equality_check = function(equality_check) {
		this._equality_check = equality_check;
		if(this._keys instanceof ArrayConstraint) { this._keys.set_equality_check(equality_check); }
		return this;
	};
	proto.item = function(key, arg1, arg2) {
		if(arguments.length === 1) {
			var keyIndex = this.keyIndex(key);
			if(keyIndex < 0) { return undefined; }
			else { return this._values.item(keyIndex); }
		} else if(arguments.length >= 2) {
			var value = arg1, index = arg2;
			this._do_set(key, value, index);
		}
		return this;
	};
	proto.clear = function() {
		cjs.wait();
		this._keys.clear();
		this._values.clear();
		cjs.signal();
	};
	proto.keyIndex = function(key) {
		return this._keys.indexOf(key, this._equality_check);
	};
	proto._do_set = function(key, value, index) {
		if(this._keys instanceof ArrayConstraint && this._values instanceof ArrayConstraint) {
			// Not settable otherwise
			var key_index = this.keyIndex(key);

			if(key_index<0) { // Doesn't already exist
				if(isNumber(index) && index >= 0 && index < this._keys.length()) {
					cjs.wait();
					this._values.splice(index, 0, value);
					this._keys.splice(index, 0, key);
					cjs.signal();
				} else {
					cjs.wait();
					this._values.push(value);
					this._keys.push(key);
					cjs.signal();
				}
			} else {
				if(isNumber(index) && index >= 0 && index < this._keys.length()) {
					cjs.wait();
					this._values.item(key_index, value);
					this.move(key, index);
					cjs.signal();
				} else {
					this._values.item(key_index, value);
				}
			}
		}

		return this;
	};
	proto.has = function(key) {
		return this.keyIndex(key) >= 0;
	};
	proto.remove = function(key) {
		if(this._keys instanceof ArrayConstraint && this._values instanceof ArrayConstraint) {
			var key_index = this.keyIndex(key);
			if(key_index >= 0) {
				cjs.wait();
				this._keys.splice(key_index, 1);
				this._values.splice(key_index, 1);
				cjs.signal();
			}
		}
		return this;
	};
	var move_index = function (arr, old_index, new_index) {
		if (new_index >= arr.length()) {
			var k = new_index - arr.length();
			while ((k--) + 1) {
				arr.push(undefined);
			}
		}
		arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
		return this;
	};
	proto.move = function(key, index) {
		if(this._keys instanceof ArrayConstraint && this._values instanceof ArrayConstraint) {
			cjs.wait();
			var key_index = this.keyIndex(key);
			if(key_index >= 0) {
				move_index(this._keys,   key_index, index);
				move_index(this._values, key_index, index);
			}
			cjs.signal();
		}
		return this;
	};
	proto.rename = function(old_key, new_key) {
		if(this._keys instanceof ArrayConstraint && this._values instanceof ArrayConstraint) {
			var old_key_index = this.keyIndex(old_key);
			if(old_key_index >= 0) {
				cjs.wait();
				var new_key_index = this.keyIndex(new_key);
				if(new_key_index >= 0) {
					this._keys.splice(new_key_index, 1);
					this._values.splice(new_key_index, 1);
				}
				this._keys.item(old_key_index, new_key);
				cjs.signal();
			}
		}
		return this;
	};
	proto.each = function(func, context) {
		var keys = this.keys();
		var values = this.values();
		context = context || this;
		for(var i = 0; i<keys.length; i++) {
			func.call(context, values[i], keys[i], i);
		}
		return this;
	};
	proto.keyForValue = function(value) {
		var value_index = this._values.indexOf(value, this._equality_check);
		if(value_index < 0) {
			return undefined;
		} else {
			return this._keys.item(value_index);
		}
	};
	proto.$shadow = function(onAdd, onRemove, onMove, context) {
		var value_shadow = this._values.$shadow(onAdd, onRemove, onMove, context || this);
		return cjs.map(this._keys, value_shadow);
	};
}(MapConstraint));
cjs.map = function(arg0, arg1) { return new MapConstraint(arg0, arg1); };
cjs.is_map = function(obj) { return obj instanceof MapConstraint; };
cjs.MapConstraint = MapConstraint;

var State = function(name) {
	this._name = name;
};
(function(my) {
	var proto = my.prototype;
	proto.name = function() { return this._name; };
}(State));

var Transition = function(fsm, from_state, to_state, name) {
	this.fsm = fsm;
	this._from = from_state;
	this._to = to_state;
	this._name = name;
};
(function(my) {
	var proto = my.prototype;
	proto.from = function() { return this._from; };
	proto.to = function() { return this._to; };
	proto.name = function() { return this._name; };
	proto.run = function() {
		var args = toArray(arguments);
		args.unshift(this.to());
		this.fsm.set_state.apply(this.fsm, args);
	};
}(Transition));

var FSM = function() {
	this._states = [];
	this._transitions = [];
	this.$state = cjs.$(null);
	this._chain_state = undefined;
	this._listeners = {};
};
(function(my) {
	var proto = my.prototype;
	proto.state_with_name = function(state_name) {
		var state_index = index_where(this._states, function(state) { return state.name() === state_name; } );
		if(state_index >= 0) { return this._states[state_index]; }
		else { return null; }
	};
	proto.add_state = function(state_name) {
		var state = this.create_or_find_state(state_name);
		this._chain_state = state;
		return this;
	};
	proto.create_or_find_state = function(state_name) {
		if(state_name instanceof State) {
			return this.create_or_find_state(state_name.name());
		}
		var state = this.state_with_name(state_name);
		if(state === null) {
			state = new State(state_name);
			this._states.push(state);
		}
		return state;
	};
	proto.get_state = function() { return this.$state.get(); };
	var get_state_regex = function(state_name) { 
		var valid_chars = "[^\\-<>a-zA-Z0-9]*";
		return valid_chars + "\\*|("+state_name+")" + valid_chars;
	};
	proto.set_state = function(state, event) {
		var old_state = this.get_state();
		var old_state_name = old_state ? old_state.name() : "";
		var new_state_name = state ? state.name() : "";
		var pre_transition_listeners = [];
		var post_transition_listeners = [];
		var old_state_regex = get_state_regex(old_state_name);
		var new_state_regex = get_state_regex(new_state_name);
		each(this._listeners, function(listeners, spec) {
			if(spec.match(new RegExp("^"+new_state_regex+"$"))) {
				post_transition_listeners.push.apply(post_transition_listeners, listeners);
			} else if(spec.match(new RegExp("^" + old_state_regex + "(->|<->)" + new_state_regex+"$"))) {
				post_transition_listeners.push.apply(post_transition_listeners, listeners);
			} else if(spec.match(new RegExp("^" + old_state_regex + "(>-|>-<)" + new_state_regex+"$"))) {
				pre_transition_listeners.push.apply(pre_transition_listeners, listeners);
			}
		});
		var fsm = this;
		each(pre_transition_listeners, function(listener) { listener(event, new_state_name, old_state_name, fsm); });
		this.$state.set(state);
		each(post_transition_listeners, function(listener) { listener(event, new_state_name, old_state_name, fsm); });
	};

	proto.add_transition = function(add_transition_fn) {
		var do_transition = this.get_transition.apply(this, slice.call(arguments, 1));
		add_transition_fn.call(this, do_transition, this);

		return this;
	};
	proto.get_transition = function(arg1, arg2, arg3) {
		var from_state, to_state, name;
		if(arguments.length >= 2) {
			from_state = this.create_or_find_state(arg1);
			to_state = this.create_or_find_state(arg2);
			name = arg3;
		} else {
			from_state = this._chain_state;
			to_state = this.create_or_find_state(arg1);
			name = arg2;
		}
		var transition = new Transition(this, from_state, to_state, name);
		this._transitions.push(transition);
		return  bind(function() {
			if(this.is(from_state.name())) {
				transition.run.apply(transition, arguments);
			}
		}, this);
	};
	proto.start_at = function(state_name) {
		var state = this.state_with_name(state_name);
		this.set_state(state);
		return this;
	};
	proto.is = function(state) {
		var my_state = this.get_state();
		return my_state === state || (my_state !== null && my_state.name() === state);
	};
	proto.on = function(state_spec, func) {
		var listeners = this._listeners[state_spec];
		if(!isArray(listeners)) {
			listeners = this._listeners[state_spec] = [];
		}

		listeners.push(func);
	};
}(FSM));
cjs.fsm = function() { return new FSM(); };
cjs.is_fsm = function(obj) { return obj instanceof FSM; };
cjs.FSM = FSM;

cjs.on = function(event_type, target) {
	var rv = function(do_something) { target.addEventListener(event_type, do_something); };

	var context = this;
	rv.guard = function(guard_func) {
		return function(do_something) {
			target.addEventListener(event_type, function() {
					var args = toArray(arguments);
					if(guard_func.apply(context, args)) {
						do_something.apply(context, args);
					}
				});
		};
	};
	rv.destroy = function() { target.removeEventListener(event_type, do_something); };
	return rv;
};


var FSMConstraint = function(fsm, values) {
	this._curr_constraint = cjs.$(null);
	this._fsm = fsm;
	this._listeners = {};
	var precedence = -1;
	var init_value = null;
	each(values, function(value, selector) {
		this.set(selector, value);
		if(selector === "INIT" && precedence < 1) { precedence = 1; init_value = value; }
		else if(selector === "*" && precedence < 2) { precedence = 2; init_value = value; }
		else if(this._fsm.is(selector) && precedence < 3) { precedence = 3; init_value = value; }
	}, this);
	if(init_value !== null) { this._curr_constraint.set(init_value); }

	var value = bind(function() {
		return this._curr_constraint.get();
	}, this);
	FSMConstraint.superclass.constructor.call(this, value);
};
(function(my) {
	proto_extend(my, Constraint);
	var proto = my.prototype;
	proto.set = function(selector, value) {
		if(has(this._listeners, selector)) {
			this.unset(selector);
		}
		var listener = this._listeners[selector] = bind(function(event) {
			if(isFunction(value)) {
				var args = toArray(arguments);
				this._curr_constraint.set(function() {
					return value.apply(this, args);
				});
			} else {
				this._curr_constraint.set(value);
			}
		}, this);
		this._fsm.on(selector, listener);
		return this;
	};
	proto.unset = function(selector) {
		var listener = this._listeners[selector];
		if(listener) {
			this._fsm.off(selector, listener);
			delete this._listeners[selector];
		}
		return this;
	};
	proto.destroy = function() {
		each(this._listeners, function(listener, selector) {
			this._fsm.off(selector, listener);
		}, this);
		this._curr_constraint.destroy();
		my.superclass.destroy.apply(this, arguments);
	};
}(FSMConstraint));
cjs.fsm_$ = function(fsm, values) { return new FSMConstraint(fsm, values); };
cjs.is_fsm_$ = function(obj) { return obj instanceof FSMConstraint; };
cjs.FSMConstraint = FSMConstraint;

var ConditionalConstraint = function() {
	this._condition_map = cjs.map();
	each(arguments, function(arg) {
		if(arg) { this.set(arg.condition, arg.value); }
	}, this);

	var value = bind(function() {
		var keys = this._condition_map.keys();
		for(var i = 0; i<keys.length; i++) {
			var key = keys[i];
			var key_val;
			if(isFunction(key)) { key_val = key(); }
			else { key_val = key; }

			if(key_val == true || key_val === "else") {
				var val = this._condition_map.item(key);
				if(isFunction(val)) { return val(key_val); }
				else { return val; }
			}
		}
	}, this);
	ConditionalConstraint.superclass.constructor.call(this, value);
};
(function(my) {
	proto_extend(my, Constraint);
	var proto = my.prototype;
	proto.set = function() {
		var cm = this._condition_map;
		cm.item.apply(cm, arguments);
		return this;
	};
	proto.unset = function(condition) {
		cm.unset.apply(cm, arguments);
		return this;
	};
}(ConditionalConstraint));
cjs.conditional_$ = function() { return construct(ConditionalConstraint, arguments); };
cjs.is_conditional_$ = function(obj) { return obj instanceof FSMConstraint; };
cjs.ConditionalConstraint = ConditionalConstraint;

var dom_setter = function(elems, set_func) {
	if(isElement(elems)) {
		set_func(elems);
	} else if(isArray(elems)) {
		each(elems, function(elem) { dom_setter(elem, set_func); });
	} else if(has(window, "jQuery") && elems instanceof jQuery) {
		for(var i = 0; i<elems.length; i++) {
			set_func(elems[i]);
		}
	} else if(cjs.is_$(elems)) {
		dom_setter(elems.get(), set_func);
	} else if(cjs.is_array(elems)) {
		dom_setter(elems.get(), set_func);
	}
};


cjs.text = function(elems, val) {
	cjs.liven(function() {
		var v = cjs.get(val);
		dom_setter(elems, function(elem) {
			elem.textContent = v;
		});
	});
};

cjs.html = function(elems, val) {
	cjs.liven(function() {
		var v = cjs.get(val);
		dom_setter(elems, function(elem) {
			elem.innerHTML = v;
		});
	});
};

cjs.val = function(elems, val) {
	cjs.liven(function() {
		var v = cjs.get(val);
		dom_setter(elems, function(elem) {
			elem.val = v;
		});
	});
};

cjs.class = function(elems, val) {
	cjs.liven(function() {
		var v;
		if(cjs.is_$(val)) {
			v = val.get();
		} else if(cjs.is_array(val)) {
			v = val.get();
		} else {
			v = val;
		}

		if(isArray(v)) { v = v.join(" "); }

		dom_setter(elems, function(elem) {
			elem.className = v;
		});
	});
};

cjs.css = function(elems, attr_name, val) {
	cjs.liven(function() {
		var k = camel_case(cjs.get(attr_name));
		var v = cjs.get(val);
		dom_setter(elems, function(elem) { elem.style[k] = v; });
	});
};

cjs.attr = function(elems, attr_name, val) {
	cjs.liven(function() {
		var k = cjs.get(attr_name);
		var v = cjs.get(val);
		dom_setter(elems, function(elem) { elem.setAttribute(k, v); });
	});
};

var insert_at = function(child_node, parent_node, index) {
	var children = parent_node.childNodes;
	if(children.length <= index) {
		parent_node.appendChild(child_node);
	} else {
		var before_child = children[index];
		parent_node.insertBefore(child_node, before_child);
	}
};
var move_child = function(parent_node, to_index, from_index) {
	var children = parent_node.childNodes;
	if(children.length > from_index) {
		var child_node = children[from_index];
		if(parent_node) {
			if(from_index < to_index) { //If it's less than the index we're inserting at...
				to_index++; //Increase the index by 1, to make up for the fact that we're removing me at the beginning
			}
			insert_at(child_node, parent_node, to_index);
		}
	}
};

cjs.children = function(elems, children) {
	dom_setter(elems, function(elem) { elem.innerHTML = ""; });
	var ad = array_differ();
	cjs.liven(function() {
		var diff = ad(cjs.get(children, true));
		dom_setter(elems, function(elem) {
			each(diff.removed, function(info) {
				elem.removeChild(elem.children[info.index]);
			});
			each(diff.added, function(info) {
				insert_at(info.item, elem, info.to);
			});
			each(diff.moved, function(info) {
				move_child(elem, info.from, info.to);
			});
		});
	});
};

var getColorValue = function(color) {
    var t = document.createElement('div');
    t.style.display = 'none';
    t.style.color = color;
    document.body.appendChild(t);

    var style = window.getComputedStyle(t, null);
    var colorValue = style.getPropertyCSSValue('color').getRGBColorValue();
    document.body.removeChild(t);

    var hex = function(x) {
        return ('0' + parseInt(x, 10).toString(16)).slice(-2);
    }

    var hexString = '#';
    with(colorValue) {
        hexString += hex(red.cssText) + hex(green.cssText) + hex(blue.cssText);
    }

    return hexString;
};

var timings = {
	linear: function(percentage, start, end, current) {
		return percentage;
	}
	, _default: function(percentage) {
		return percentage;
	}
};
var speeds = {
	slow: 600
	, fast: 200
	, _default: 400
};
var defaults = {
	speed: "_default"
	, in_filter: function(x) {
		return x;
	}
	, out_filter: function(x) {
		return x;
	}
	, timing: "linear"
	, fps: 30
};
var get_time = function() {
	return (new Date()).getTime();
};

var hex_to_rgb = function(str) {
	var rv = [];
	for(var i = 1; i<6; i+=2) {
		rv.push(parseInt(str.substr(i, 2), 16));
	}
	return rv;
};
function decimalToHex(d, padding) {
    var hex = Number(d).toString(16);
    padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

    while (hex.length < padding) {
        hex = "0" + hex;
    }

    return hex;
}
var rgb_to_hex = function(arr) {
	var rv = "#";
	each(arr, function(item) { rv += decimalToHex(Math.round(item), 2); });
	return rv;
};

var Animation = function(options, unfiltered_from, unfiltered_to) {
	this.options = options;

	this.unfiltered_from = unfiltered_from;
	this.unfiltered_to = unfiltered_to;

	this.from = options.in_filter(this.unfiltered_from);
	this.to = options.in_filter(this.unfiltered_to);

	this.current = this.start;
	this.timing = isString(options.timing) ? (timings[options.timing] || timings._default) : options.timing;
	this.speed = isString(options.speed) ? (speeds[options.speed] || speeds._default) : options.speed;

	this.start_time = null;
	this.end_time = null;

	this.started = false;
	this.done = false;
};
(function(my) {
	var proto = my.prototype;
	proto.get = function(time) {
		if(!this.started) {
			return options.out_filter(this.from);
		} else if(this.done) {
			return options.out_filter(this.to);
		}
		time = time || get_time();
		var raw_percentage = (time - this.start_time) / (this.end_time - this.start_time);
		var percentage = this.timing(raw_percentage, this.start_time, this.end_time, this.current);

		var current_value;

		if(isArray(this.from) && isArray(this.to) &&  this.from.length === this.to.length) {
			current_value = map(this.from, function(from, index) {
				var to = this.to[index];
				return to * percentage + from * (1 - percentage);
			}, this);
		} else {
			current_value = this.to * percentage + this.from * (1 - percentage);
		}

		return this.options.out_filter(current_value);
	}
	proto.start = function() {
		this.start_time = get_time();
		this.end_time = this.start_time + this.speed;
		this.started = true;
	};
	proto.stop = function() {
		this.done = true;
		return this;
	};
}(Animation));


cjs.$.extend("anim", function(based_on, options) {
	var based_on = this;
	options = extend({}, defaults, options);

	var current_animation = null;
	var current_animation_end_timeout = null;
	var invalidation_interval = null;

	var old_val = based_on.get();
	var new_constraint = new Constraint(function() {
		if(current_animation === null) {
			return old_val;
		} else {
			var rv = current_animation.get();
			return rv;
		}
	});

	var on_change_func = function() {
		//var animate_from = new_constraint.get();
		var animate_from;
		var orig_animate_to = animate_to = based_on.get();

		if(current_animation_end_timeout === null) {
			animate_from = old_val;
		} else {
			animate_from = new_constraint.get();
			root.clearTimeout(current_animation_end_timeout);
		}

		var default_anim_options = {};
		if(isString(animate_from) && isString(animate_to)) {
			animate_from = hex_to_rgb(getColorValue(animate_from));
			animate_to = hex_to_rgb(getColorValue(animate_to));

			default_anim_options.out_filter = rgb_to_hex;
		}

		var anim_options = extend({}, options, default_anim_options);

		current_animation = new Animation(anim_options, animate_from, animate_to);
		current_animation.start();

		invalidation_interval = setInterval(new_constraint.invalidate, 1000/options.fps);
		current_animation_end_timeout = root.setTimeout(function() {
			current_animation_end_timeout = null;
			current_animation = null;
			root.clearInterval(invalidation_interval);
			invalidation_interval = null;
			new_constraint.invalidate();
		}, current_animation.speed);
		old_val = orig_animate_to;
	};

	based_on.onChange(on_change_func);

	new_constraint.destroy = function() {
		Constraint.prototype.destroy.apply(this);
		based_on.offChange(on_change_func);
	};

	return new_constraint;
});

cjs.async_$ = function(invoke_callback, timeout_interval) {
	var async_fsm = cjs	.fsm()
						.add_state("pending")
						.add_transition(function(do_transition ) {
							if(_.isNumber(timeout_interval)) {
								root.setTimeout(function() {
									do_transition("timeout");
								}, timeout_interval);
							}
						}, "rejected")
						.add_state("resolved")
						.add_state("rejected")
						.start_at("pending");

	var do_resolved_transition = async_fsm.get_transition("pending", "resolved");
	var do_rejected_transition = async_fsm.get_transition("pending", "rejected");

	if(_.isNumber(timeout_interval)) {
		root.setTimeout(function() {
			do_rejected_transition("timeout");
		}, timeout_interval);
	}
	var resolved_value, rejected_value;
	var resolved = function(value) {
		resolved_value = value;
		do_resolved_transition(value);
	};

	var rejected = function(message) {
		rejected_value = message;
		do_rejected_transition(message);
	};

	invoke_callback(resolved, rejected);


	var constraint = cjs.fsm_$(async_fsm, {
		"pending": undefined
		, "resolved": function() {
			return cjs.get(resolved_value);
		}
		, "rejected": function() {
			return cjs.get(rejected_value);
		}
	});


	constraint.state = async_fsm;

	constraint.item = function() {
		if(arguments.length === 1 && arguments[0] === "state") {
			return this.state;
		} else {
			return Constraint.prototype.item.apply(this, arguments);
		}
	};

	return constraint;
};

return cjs;
}(this));
