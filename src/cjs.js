var cjs = (function (root) {
//
// ============== CJS CORE ============== 
//

// The star of the show!
var old_cjs = root.cjs;
var cjs = function () {
	return cjs.$.apply(cjs, arguments);
};
cjs.version = "1.0.0";

cjs.noConflict = function() {
	root.cjs = old_cjs;
	return cjs;
};

//
// ============== UTILITY FUNCTIONS ============== 
//
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

var eqeqeq = function(a, b) { return a === b; };
// Return the first item in arr equal to item (where equality is defined in equality_check)
var index_of = function(arr, item, start_index, equality_check) {
	equality_check = equality_check || eqeqeq;
	return index_where(arr, function(x) { return equality_check(item, x); }, start_index);
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
	var index = index_of(arr, obj);
	if(index>=0) { remove_index(arr, index); }
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
	};
	proto.offChange = function(callback) {
		constraint_solver.off_nullify(this, callback);
	};
}(Constraint));

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

cjs.is_constraint = cjs.is_$ = function(obj) {
	return obj instanceof Constraint;
};

cjs.get = function(obj) {
	if(cjs.is_$(obj)) {
		return obj.get();
	} else if(obj instanceof ArrayConstraint) {
		return obj.get();
	} else {
		return obj;
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

	for(var key in values) {
		var value = values[key];
		var self = this;
		Constraint.prototype[key] = value;
	}
};

cjs.$.extend({
	item: function(key) {
		var got = this.get();
		return got[key];
	}
	, indexOf: function(item, equality_check) {
		var got = this.get();
		return index_of(got, item, 0, equality_check);
	}
});

//
// ============== LIVEN ============== 
//

cjs.liven = function() {
	var args = arguments;
	var node = constraint_solver.add({
		cjs_getter: function() {
			each(args, function(arg) {
				arg();
			});
		},
		auto_add_outgoing_dependencies: false,
		cache_value: false
	});

	var do_get = function() {
		constraint_solver.getNodeValue(node);
	};

	constraint_solver.on_nullify(node, do_get);
	do_get();

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
};

(function(my) {
	var proto = my.prototype;
	proto.set_equality_check = function(equality_check) { this._equality_check = equality_check; return this; };
	proto.onChange = function(callback) {
		this.$value.onChange.apply(this.$value, arguments);
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
};

(function(my) {
	var proto = my.prototype;
	proto.keys = function() { return this._keys.get(); };
	proto.values = function() { return this._values.get(); };
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

return cjs;
}(this));
