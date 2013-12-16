/*ConstraintJS - v0.9.0*/
/* jslint nomen: true, vars: true */
/* jshint -W093 */
/* global document */

var cjs = (function (root) {
	"use strict";

	/*jslint eqnull: true */
	//
	// ============== UTILITY FUNCTIONS ============== 
	//
	var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;
	var slice			= ArrayProto.slice,
		toString		= ObjProto.toString,
		concat			= ArrayProto.concat,
		push			= ArrayProto.push,
		nativeSome		= ArrayProto.some,
		nativeIndexOf	= ArrayProto.indexOf,
		nativeEvery		= ArrayProto.every,
		nativeForEach	= ArrayProto.forEach,
		nativeKeys		= Object.keys,
		nativeFilter	= ArrayProto.filter,
		nativeReduce	= ArrayProto.reduce,
		nativeMap		= ArrayProto.map,
		bind			= function (func, context) { return function () { return func.apply(context, arguments); }; }, //Bind a function to a context
		doc				= root.document,
		sTO				= bind(root.setTimeout, root),
		cTO				= bind(root.clearTimeout, root),
		unary_operators = { "+":	function (a) { return +a; }, "-":	function (a) { return -a; },
							"~":	function (a) { return ~a; }, "!":	function (a) { return !a; }
		},
		binary_operators = {"===":	function (a, b) { return a === b;}, "!==":	function (a, b) { return a !== b; },
							"==":	function (a, b) { return a == b; }, "!=":	function (a, b) { return a != b; },
							">":	function (a, b) { return a > b;  }, ">=":	function (a, b) { return a >= b; },
							"<":	function (a, b) { return a < b;  }, "<=":	function (a, b) { return a <= b; },
							"+":	function (a, b) { return a + b;  }, "-":	function (a, b) { return a - b; },
							"*":	function (a, b) { return a * b;  }, "/":	function (a, b) { return a / b; },
							"%":	function (a, b) { return a % b;  }, "^":	function (a, b) { return a ^ b; },
							"&&":	function (a, b) { return a && b; }, "||":	function (a, b) { return a || b; },
							"&":	function (a, b) { return a & b;  }, "|":	function (a, b) { return a | b; },
							"<<":	function (a, b) { return a << b; }, ">>":	function (a, b) { return a >> b; },
							">>>":  function (a, b) { return a >>> b;}
		};

	// Establish the object that gets returned to break out of a loop iteration.
	var breaker = {};

	// Return a unique id when called
	var uniqueId = (function () {
		var id = 0;
		return function () { return id++; };
	}());

	// Create a (shallow-cloned) duplicate of an object.
	var clone = function(obj) {
		if (!isObject(obj)) { return obj; }
		return isArray(obj) ? obj.slice() : extend({}, obj);
	};

	var keys = nativeKeys || function (obj) {
		if (obj !== Object(obj)) { throw new TypeError('Invalid object'); }
		var keys = [];
		var key;
		for (key in obj) {
			if (obj.hasOwnProperty(key)) {
				keys[keys.length] = key;
			}
		}
		return keys;
	};

	// Get the last element of an array. Passing **n** will return the last N
	// values in the array. The **guard** check allows it to work with `_.map`.
	var last = function(array, n, guard) {
		if (array == null) {
			return void 0;
		} else if ((n == null) || guard) {
			return array[array.length - 1];
		} else {
			return slice.call(array, Math.max(array.length - n, 0));
		}
	};

	// Return the number of elements in an object.
	var size = function(obj) {
		if (obj == null) { return 0; }
		return (obj.length === +obj.length) ? obj.length : keys(obj).length;
	};

	// Determine if at least one element in the object matches a truth test.
	// Delegates to **ECMAScript 5**'s native `some` if available.
	// Aliased as `any`.
	var any = function(obj, iterator, context) {
		var result = false;
		if (obj == null) { return result; }
		if (nativeSome && obj.some === nativeSome) { return obj.some(iterator, context); }
		each(obj, function(value, index, list) {
			if (result || (result = iterator.call(context, value, index, list))) { return breaker; }
		});
		return !!result;
	};

	// Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
	// Especially useful on the arguments object. Passing an **n** will return
	// the rest N values in the array. The **guard**
	// check allows it to work with `_.map`.
	var rest = function(array, n, guard) {
		return slice.call(array, (n == null) || guard ? 1 : n);
	};

	// Trim out all falsy values from an array.
	var compact = function(array) {
		return filter(array, identity);
	};

	// If every object obeys iterator
	var every = function(obj, iterator, context) {
		iterator = iterator || identity;
		var result = true;
		if (!obj) {
			return result;
		}

		if (nativeEvery && obj.every === nativeEvery) {
			return obj.every(iterator, context);
		}

		each(obj, function(value, index, list) {
			if (!(result = result && iterator.call(context, value, index, list))) {
				return breaker;
			}
		});
		return !!result;
	};

	// Recursive call for flatten (from underscore)
	var recursiveFlatten = function(input, shallow, output) {
		if (shallow && every(input, isArray)) {
			return concat.apply(output, input);
		}
		each(input, function(value) {
			if (isArray(value) || isArguments(value)) {
				if(shallow) {
					push.apply(output, value);
				} else {
					recursiveFlatten(value, shallow, output);
				}
			} else {
				output.push(value);
			}
		});
		return output;
	};

	// Initial call to the recursive flatten function
	var flatten = function(input, shallow) {
		return recursiveFlatten(input, shallow, []);
	};

	// Retrieve the values of an object's properties.
	var values = function (obj) {
		var values = [];
		var key;
		for (key in obj) {
			if (obj.hasOwnProperty(key)) {
				values.push(obj[key]);
			}
		}
		return values;
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

	// Is the given value a String?
	var isString = function (obj) {
		return toString.call(obj) === '[object String]';
	};

	// Is a given variable an object?
	var isObject = function (obj) {
		return obj === Object(obj);
	};

	// Is a given value a DOM element?
	var isElement = function(obj) {
		return !!(obj && obj.nodeType === 1);
	};

	// Any element of any type?
	var isAnyElement = function(obj) {
		return !!(obj && (obj.nodeType > 0));
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
		if (superClass.prototype.constructor === ObjProto.constructor) {
			superClass.prototype.constructor = superClass;
		}
	};

	// hasOwnProperty proxy, useful if you don't know if obj is null or not
	var hOP = ObjProto.hasOwnProperty;
	var has = function (obj, key) {
		return hOP.call(obj, key);
	};

	// Run through each element and calls 'iterator' where 'this' === context
	var each = function (obj, iterator, context) {
		var i, key, l;
		if (!obj) { return; }
		if (nativeForEach && obj.forEach === nativeForEach) {
			obj.forEach(iterator, context);
		} else if (obj.length === +obj.length) {
			for (i = 0, l = obj.length; i < l; i++) {
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
	
	// Run through each element and calls 'iterator' where 'this' === context
	// and returns the return value for every element
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

	// Return all the elements that pass a truth test.
	// Delegates to **ECMAScript 5**'s native `filter` if available.
	// Aliased as `select`.
	var filter = function(obj, iterator, context) {
		var results = [];
		if (!obj) { return results; }
		if (nativeFilter && obj.filter === nativeFilter) { return obj.filter(iterator, context); }
		each(obj, function(value, index, list) {
			if (iterator.call(context, value, index, list)) { results.push(value); }
		});
		return results;
	};

	var extend = function (obj) {
		var i, prop, len = arguments.length,
			on_each_func = function (val, prop) {
				obj[prop] = val;
			};
		for (i = 1; i < len; i++) {
			each(arguments[i], on_each_func);
		}
		return obj;
	};
		
	// Return the first item in arr where test is true
	var indexWhere = function (arr, test, start_index) {
		var i, len = arr.length;
		for (i = start_index || 0; i < len; i++) {
			if (test(arr[i], i)) { return i; }
		}
		return -1;
	};
		
	var eqeqeq = function (a, b) { return a === b; };
	// Return the first item in arr equal to item (where equality is defined in equality_check)
	var indexOf = function (arr, item, start_index, equality_check) {
		if(!equality_check && !start_index && nativeIndexOf && arr.indexOf === nativeIndexOf) {
			return arr.indexOf(item);
		} else {
			equality_check = equality_check || eqeqeq;
			return indexWhere(arr, function (x) { return equality_check(item, x); }, start_index);
		}
	};
		
	// Remove an item in an array
	var remove = function (arr, obj) {
			return removeIndex(arr, indexOf(arr, obj));
		},
		removeIndex = function(arr, index) {
			if (index >= 0) { return arr.splice(index, 1)[0]; }
			return index;
		};
	
	// Fold down a list of values into a single value
	var reduce = function(obj, iterator, memo) {
		var initial = arguments.length > 2;
		if (!obj) obj = [];
		if (nativeReduce && obj.reduce === nativeReduce) {
			return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
		}
		each(obj, function(value, index, list) {
			memo = iterator(memo, value, index, list);
		});
		return memo;
	};

	//Longest common subsequence between two arrays, based on:
	//http://rosettacode.org/wiki/Longest_common_subsequence#JavaScript
	var popsym = function (index, x, y, symbols, r, n, equality_check) {
			var s = x[index],
				pos = symbols[s] + 1;
			pos = indexOf(y, s, pos > r ? pos : r, equality_check);
			if (pos < 0) { pos = n; }
			symbols[s] = pos;
			return pos;
		},
		indexed_lcs = function (x, y, equality_check) {
			var symbols = {}, r = 0, p = 0, p1, L = 0, idx, i, m = x.length, n = y.length, S = new Array(m < n ? n : m);
			if (n === 0 || m === 0) { return []; }
			p1 = popsym(0, x, y, symbols, r, n, equality_check);
			for (i = 0; i < m; i++) {
				p = (r === p) ? p1 : popsym(i, x, y, symbols, r, n, equality_check);
				p1 = popsym(i + 1, x, y, symbols, r, n, equality_check);

				if (p > p1) {
					i++;
					idx = p1;
				} else {
					idx = p;
				}

				if (idx === n || i === m) {
					p=popsym(i, x, y, symbols, r, n, equality_check);
				} else {
					r = idx;
					S[L] = {item: x[i], indicies: [i, idx]};
					L++;
				}
			}
			return S.slice(0,L);
		};

	// "Subtracts" y from x (takes x-y) and returns a list of items in x that aren't in y
	var diff = function (x, y, equality_check) {
		var i, j, xi,
			y_clone = clone(y),
			x_len = x.length,
			y_len = y.length,
			diff = [],
			diff_len = 0;

		if(y_len === 0 || x_len === 0) {
			return x; // If there aren't any items, then the difference is the same as x.
						// not bothering to return a clone here because diff is private none of my code
						// modifies the return value
		}

		for (i = 0; i < x_len; i += 1) {
			xi = x[i];
			j = indexOf(y_clone, xi, 0, equality_check);
			if(j >= 0) {
				removeIndex(y_clone, j);
				// If there's nothing left to subtract, just add the rest of x to diff and return
				if(--y_len === 0) {
					diff.push.apply(diff, rest(x, i+1));
					break;
				}
			} else {
				diff[diff_len] = xi;
				diff_len++;
			}
		}
		return diff;
	};

	// Returns the items that are in both x and y
	var dualized_intersection = function (x, y, equality_check) {
		var i, j, xi,
			y_clone = clone(y),
			x_len = x.length,
			y_len = y.length,
			intersection = [];

		for (i = 0; i < x_len && y_len > 0; i++) {
			xi = x[i];
			j = indexOf(y_clone, xi, 0, equality_check);
			if(j >= 0) {
				intersection.push([xi, removeIndex(y_clone, j)]);
				y_len--;
			}
		}

		return intersection;
	};


	var get_index_moved = function(info) {
			var item = info[1].item;
			return {item: item, from: info[0].index, to: info[1].index, from_item: info[0].item, to_item: item};
		}, 
		add_indicies = function(x, i) {
			return {item: x, index: i};
		},
		add_from_to_indicies = function(info) {
			return {item: info.item, from: info.indicies[0], to: info.indicies[1]};
		},
		get_index = function(x) { return x.index; },
		get_to = function(x) { return x.to; },
		add_from_and_from_item = function(x) {
			return { from: x.index, from_item: x.item };
		};

	// Get where every item came from and went to
	var array_source_map = function (from, to, equality_check) {
		//Utility functions for array_source_map below
		var eq = equality_check || eqeqeq,
			item_aware_equality_check = function (a, b) { return eq(a ? a.item : a, b ? b.item : b); },
			indexed_from = map(from, add_indicies),
			indexed_to = map(to, add_indicies),
			indexed_common_subsequence = map(indexed_lcs(from, to), add_from_to_indicies),
			indexed_removed = diff(indexed_from, indexed_common_subsequence, item_aware_equality_check),
			indexed_added = diff(indexed_to, indexed_common_subsequence, item_aware_equality_check),
			indexed_moved = map(dualized_intersection(indexed_removed, indexed_added, item_aware_equality_check), get_index_moved);

		indexed_added = diff(indexed_added, indexed_moved, item_aware_equality_check);
		indexed_removed = diff(indexed_removed, indexed_moved, item_aware_equality_check);

		var added_indicies = map(indexed_added, get_index),
			moved_indicies = map(indexed_moved, get_to),
			ics_indicies = map(indexed_common_subsequence, get_to),
			to_mappings = map(to, function (item, index) {
					var info, info_index;

					if ((info_index = indexOf(added_indicies, index)) >= 0) {
						info = indexed_added[info_index];
						return { to: index, to_item: item, item: item };
					} else if ((info_index = indexOf(moved_indicies, index)) >= 0) {
						info = indexed_moved[info_index];
						return { to: index, to_item: item, item: item, from: info.from, from_item: info.from_item };
					} else if ((info_index = indexOf(ics_indicies, index)) >= 0) {
						info = indexed_common_subsequence[info_index];
						return { to: index, to_item: item, item: item, from: info.from, from_item: from[info.from] };
					}
				});

		return to_mappings.concat(map(indexed_removed, add_from_and_from_item));
	};

	var has_from = function(x) { return x.hasOwnProperty("from"); },
		not_has_from = function(x) { return !has_from(x); },
		has_to = function(x) { return x.hasOwnProperty("to"); },
		not_has_to = function(x) { return !has_to(x); },
		has_from_and_to = function(x) { return has_from(x) && has_to(x); },
		unequal_from_to = function(x) { return has_from_and_to(x) && x.from !== x.to; };

	var sort_by_from_fn = function(a, b) {
		var a_has_from = has_from(a),
			b_has_from = has_from(b);
		if (a_has_from && b_has_from) { return a.from - b.from; }
		else if (a_has_from && !b_has_from) { return -1; }
		else if (!a_has_from && b_has_from) { return 1; }
		else { return 0; }
		// could alternatively return: b_has_from - a_has_from
	};

	/*
	get_array_diff returns an object with attributes:
	removed, added, and moved.
	Every item in removed has the format: {item, index}
	Every item in added has the format: {item, index}
	Every item in moved has the format: {from_index, to_index}

	When oldArray removes every item in removed, adds every item in added,
	and moves every item in moved in sequence, it will result in an array
	that is equivalent to newArray.
	*/
	var get_array_diff = function (from_val, to_val, equality_check) {
		var source_map = array_source_map(from_val, to_val, equality_check),
			rearranged_array = clone(source_map).sort(sort_by_from_fn),

			added = filter(source_map, not_has_from), // back to front
			removed = filter(rearranged_array, not_has_to).reverse(), // back to front
			index_changed = filter(source_map, unequal_from_to),
			moved = [];

		each(removed, function (info) { removeIndex(rearranged_array, info.from); });
		each(added, function (info) { rearranged_array.splice(info.to, 0, info); });
		
		each(source_map, function (info, index) {
			if (has_from_and_to(info)) {
				if (rearranged_array[index] !== info) {
					var rearranged_array_info_index = indexOf(rearranged_array, info, index);
					rearranged_array.splice(index, 0, removeIndex(rearranged_array, rearranged_array_info_index));
					moved.push({move_from: rearranged_array_info_index, insert_at: index, item: info.item, from: info.from, to: info.to});
				}
			}
		});
		rearranged_array = null;
		return { added: added, removed: removed, moved: moved, index_changed: index_changed , mapping: source_map};
	};


	// Convert dashed to camelCase; used by the css and data modules
	// Microsoft forgot to hump their vendor prefix (#9572)
	var rdashAlpha = /-([a-z]|[0-9])/ig, rmsPrefix = /^-ms-/,
		fcamelCase = function(all, letter) { return String(letter).toUpperCase(); },
		camel_case = function(string) { return string.replace( rmsPrefix, "ms-" ).replace(rdashAlpha, fcamelCase); };

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
			} else if(isPolyDOM(arg0)) {
				return cjs.inputValue(arg0);
			} else if(isObject(arg0) && !isFunction(arg0)) {
				return new MapConstraint(extend({
					value: arg0
				}, arg1));
			} else {
				return new Constraint(arg0, arg1);
			}
		};

	cjs.version = "0.9.0"; // This template will be filled in by the builder
	cjs.__debug = false;

	cjs.arrayDiff = get_array_diff; // expose this useful function
	//cjs.mapDiff = get_map_diff;
	cjs.toString = function() { return "ConstraintJS v" + cjs.version; };

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
		getValue: function (auto_add_outgoing) {
			var node = this,
				stack = constraint_solver.stack,
				stack_len = stack.length,
				demanding_var, dependency_edge;
			
			if (stack_len > 0) { // There's a constraint that's asking for my value
				// Let's call it demanding_var
				demanding_var = stack[stack_len - 1];
				dependency_edge = node._outEdges[demanding_var._id];

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
				stack[stack_len] = node;
				// Mark it as valid
				node._valid = true;

				// Set the timestamp before fetching in case a constraint depends on itself
				// TODO: Check the logic on this...
				node._tstamp += 1;

				if (node._options.cache_value !== false) {
					// Check if dynamic value. If it is, then call it. If not, just fetch it
					// set this to the node's cached value, which will be returned
					node._cached_value = isFunction(node._value) && !node._options.literal ? node._value.call(node._options.context) : node._value;
				} else if(isFunction(node._value)) {
					// if it's just a non-cached function call, just call the function
					node._value.call(node._options.context);
				}
				// Pop the item off the stack
				stack.length = stack_len;
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
						new_value = curr_node.get();

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
			remove(this.nullified_call_stack, info);
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
		proto.get = constraint_solver.getValue;

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
		proto.and = function() {
			var args = ([this]).concat(toArray(arguments)),
				len = args.length;

			return new Constraint(function() {
				var i = 0, val;
				for(;i<len; i++) {
					if(!(val = cjs.get(args[i]))) {
						return false;
					}
				}
				return val;
			});
		};
		proto.or = function() {
			var args = ([this]).concat(toArray(arguments)),
				len = args.length;

			return new Constraint(function() {
				var i = 0, val;
				for(;i<len; i++) {
					if((val = cjs.get(args[i]))) {
						return val;
					}
				}
				return false;
			});
		};
		var createConstraintModifier = function(modifier_fn) {
			return function() {
				var args = arguments;
				var rv = new Constraint(function() {
					return modifier_fn.apply(rv, map(args, cjs.get));
				});
				args = ([this]).concat(toArray(args));
				return rv;
			};
		};

		proto.add = createConstraintModifier(function() { return reduce(arguments, binary_operators["+"], 0); });
		proto.sub = createConstraintModifier(function() { return reduce(arguments, binary_operators["-"], 0); });
		proto.mul = createConstraintModifier(function() { return reduce(arguments, binary_operators["*"], 1); });
		proto.div = createConstraintModifier(function() { return reduce(arguments, binary_operators["/"], 1); });
		each(["abs", "pow", "round", "floor", "ceil", "sqrt", "log", "exp"], function(op_name) {
			proto[op_name] = createConstraintModifier(bind(Math[op_name], Math));
		});
		each({
			u: {
				pos: "+", neg: "-", not: "!", bitwiseNot: "~"
			},
			bi: {
				eqStrct: "===", neqStrict: "!==", eq: "==", neq: "!=",
				gt: ">", ge: ">=", lt: "<", le: "<=", mod: "%",
				xor: "^", bitwiseAnd: "&", bitwiseOr: "|", rightShift: ">>",
				leftShift: "<<", unsignedRightShift: ">>>"
			}
		},	function(ops, operator_prefix) {
			var op_list = operator_prefix === "u" ? unary_operators : binary_operators;
			each(ops, function(key, op_name) {
				proto[op_name] = createConstraintModifier(op_list[key]);
			});
		});
	} (Constraint));



	// Create some exposed utility functions
	is_constraint = function(obj) {
		return obj instanceof Constraint;
	};
	cjs.isConstraint = is_constraint;
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

	//
	// ============== ARRAYS ============== 
	//
	
	var isPositiveInteger = function (val) {
		return isNumber(val) && Math.round(val) === val && val >= 0;
	};


	// This class is meant to emulate standard arrays, but with constraints
	// It contains many of the standard array functions (push, pop, slice, etc)
	// and makes them constraint-enabled.
	// x[1] = y[2] + z[3] === x.item(1, y.item(2) + z.item(3))
	ArrayConstraint = function (options) {
		options = extend({
			equals: eqeqeq, // How to check for equality, useful for indexOf, etc
			value: [] // starting value
		}, options);

		// Every value in the array is a constraint
		this._value = map(options.value, function(val) {
			return new Constraint(val, {literal: true});
		});

		// When we fetch an item in the array that doesn't exist, it gets added to
		// the unsubstantiated items list to create a dependency
		this._unsubstantiated_items = [];

		this.$len = new Constraint(this._value.length); // Keep track of the array length in a constraint
		this.$equality_check = new Constraint(options.equals, {literal: true}); // How to check for equality again...
	};

	(function (my) {
		var proto = my.prototype;
		// Any iterator in forEach can return this object to break the loop
		my.BREAK = {};

		// Get a particular item in the array
		var _get = function (arr, key) {
			var val = arr._value[key];
			if (val === undefined) { // Even if arr[key] is set to undefined, it would be a constraint
				// Create a dependency so that if the value for this key changes
				// later on, we can detect it in the constraint solver
				val = new Constraint(undefined, {literal: true});
				arr._unsubstantiated_items[key] = val;
			}
			return val.get();
		};

		// For internal use; set a particular item in the array
		var _put = function (arr, key, val) {
			cjs.wait(); // Don't run any nullification listeners until this function is done running
			var $previous_value = arr._value[key];

			// If there's an unsubstantiated item; use that, so that dependencies still work
			if ($previous_value === undefined && arr._unsubstantiated_items[key]) {
				$previous_value = arr._value[key] = arr._unsubstantiated_items[key];
				delete arr._unsubstantiated_items[key];
			}

			if (is_constraint($previous_value)) {
				// If there was a previous value, just set it
				var prev_val = $previous_value.get();
				$previous_value.set(val);
			} else {
				// Otherwise, just create a new value
				arr._value[key] = new Constraint(val, {literal: true});
			}
			_update_len(arr); // Make sure the length hasn't changed
			cjs.signal(); // OK, run nullification listeners now if necessary
		};

		// Remove every element of the array
		var _clear = function (arr, silent) {
			var $val;
			cjs.wait();

			// Keep on popping and don't stop!
			while (arr._value.length > 0) {
				$val = arr._value.pop();
				var len = arr._value.length;
				if (is_constraint($val)) {
					$val.destroy(silent); // Clear memory for every element
				}
			}
			_update_len(arr);

			cjs.signal();
			return this;
		};

		var _update_len = function (arr) {
			// The setter will automatically not update if the value is the same
			arr.$len.set(arr._value.length);
		};


		// Change the equality check; useful for indexOf
		proto.setEqualityCheck = function (equality_check) {
			this.$equality_check.set(equality_check);
			return this;
		};

		// Run through every element of the array and call func with 'this' === context or window
		proto.forEach = function (func, context) {
			var i, len = this.length();
			context = context || root; // Set context to window if not specified
			for (i = 0; i < len; i += 1) {
				if (func.call(context, _get(this, i), i) === my.BREAK) { // "break" equivalent
					return this;
				}
			}
			return this;
		};

		// Return a new JAVASCRIPT array with each element's value being the result of calling func
		// on item i
		proto.map = function (func, context) {
			var rv = [];
			context = context || root;
			this.forEach(function(val, i) {
				rv[i] = func.call(context, val, i);
			});
			return rv;
		};

		// Replaces the whole array
		proto.setValue = function (arr) {
			cjs.wait(); // Don't run nullified functions quite yet
			_clear(this);
			this.push.apply(this, arr);
			cjs.signal(); // OK, now run them
			return this;
		};

		// Get or put item i
		proto.item = function (key, val) {
			if(arguments.length === 0) { // Just return an array if called with no arguments
				return this.toArray();
			} else if (arguments.length === 1) { // Get if called with one argument
				return _get(this, key);
			} else if (arguments.length > 1) { // Put if called with more than one argument
				return _put(this, key, val);
			}
		};
		// Clean up any allocated memory
		proto.destroy = function (silent) {
			_clear(this, silent);
			this.$len.destroy(silent);
		};

		proto.length = function () {
			return this.$len.get(); // Remember that length is a constraint
		};
		
		// add to the end of the array
		proto.push = function () {
			var i, len = arguments.length, value_len = this._value.length;
			//Make operation atomic
			cjs.wait();
			// Add every item that was passed in
			for (i = 0; i < len; i += 1) {
				_put(this, value_len+i, arguments[i]);
			}
			cjs.signal();
			return this.length(); // return the new length
		};

		// Remove from the end of the array
		proto.pop = function () {
			var rv, $value = this._value.pop(); // $value should be a constraint
			cjs.wait();

			if (is_constraint($value)) { // if it's a constraint return the value.
											// otherwise, return undefined
				rv = $value.get();
				$value.destroy();
			}
			// And set the proper length
			_update_len(this);

			// Ok, ready to go again
			cjs.signal();
			
			return rv;
		};
		// Converts to a JAVASCRIPT array
		proto.toArray = function () {
			return this.map(identity); // just get every element
		};

		// Returns the first item where calling filter is truthy
		proto.indexWhere = function (filter, context) {
			var i, len = this.length(), $val;
			context = context || this;

			for (i = 0; i < len; i += 1) {
				$val = this._value[i];
				if (filter.call(context, $val.get(), i)) { return i; }
			}

			return -1; // -1 if not found
		};
		// Return the last item where calling filter is truthy
		proto.lastIndexWhere = function (filter, context) {
			var i, len = this.length(), $val;
			context = context || this;

			for (i = len - 1; i >= 0; i -= 1) {
				$val = this._value[i];
				if (filter.call(context, $val.get(), i)) { return i; }
			}

			return -1; // -1 if not found
		};

		// First index of item, with either the supplied equality check or my equality check
		proto.indexOf = function (item, equality_check) {
			equality_check = equality_check || this.$equality_check.get();
			var filter = function (x) { return equality_check(x, item); };
			return this.indexWhere(filter);
		};

		// Last index of item, with either the supplied equality check or my equality check
		proto.lastIndexOf = function (item, equality_check) {
			equality_check = equality_check || this.$equality_check.get();
			var filter = function (x) { return equality_check(x, item); };
			return this.lastIndexWhere(filter);
		};

		// Return true if any item in the array is true
		proto.some = function(filter, context) {
			return this.indexWhere(filter, context) >= 0;
		};

		// Return true if every item in the array has a truty value
		proto.every = function(filter, context) {
			var rv = true;
			this.forEach(function() {
				if(!filter.apply(context, arguments)) { // break on the first non-obeying element
					rv = false;
					return my.BREAK;
				}
			});
			return rv;
		};

		// Works just like the standard JavaScript array splice function
		proto.splice = function (index, howmany) {
			var i;
			if (!isNumber(howmany)) { howmany = 0; }
			if (!isPositiveInteger(index) || !isPositiveInteger(howmany)) {
				throw new Error("index and howmany must be positive integers");
			}
			var to_insert = slice.call(arguments, 2),
				to_insert_len = to_insert.length;

			// Don't run any listeners until we're done
			cjs.wait();
			// It's useful to keep track of if the resulting shift size is negative because
			// that will influence which direction we loop in
			var resulting_shift_size = to_insert_len - howmany;

			// removed will hold the items that were removed
			var removed = map(this._value.slice(index, index + howmany), function(x) {
				return x ? x.get() : undefined;
			});

			// If we have to remove items
			if (resulting_shift_size < 0) {
				var value_len = this._value.length,
					insertion_max = index + to_insert_len,
					movement_max = value_len + resulting_shift_size;

				// If it's in the insertion range, use the user-specified insert
				for (i = index; i<insertion_max; i += 1) {
					_put(this, i, to_insert[i - index]);
				}

				// Otherwise, use put (don't use splice here to make sure that 
				// item i has the same constraint object (for dependency purposes)
				for (; i<movement_max; i += 1) {
					_put(this, i, _get(this, i - resulting_shift_size));
				}

				// Then, just get rid of the last resulting_shift_size elements
				for (; i<value_len; i += 1) {
					var $value = this._value.pop(); // $value should be a constraint
					if (is_constraint($value)) {  // and dealocate
						$value.destroy();
					}
				}
			} else {
				for (i = this._value.length + resulting_shift_size - 1; i >= index; i -= 1) {
					if (i < index + to_insert_len) {
						// If it's in the insertion range...
						_put(this, i, to_insert[i - index]);
					} else {
						// If not...
						_put(this, i, _get(this, i - resulting_shift_size));
					}
				}
			}

			if(resulting_shift_size !== 0) { // Don't bother if no resulting shift
				_update_len(this);
			}

			cjs.signal(); // And finally run any listeners
			return removed;
		};

		// Remove the first item of the array
		proto.shift = function () {
			var rv_arr = this.splice(0, 1);
			return rv_arr[0];
		};

		// Add a new item to the beginning of the array (any number of parameters)
		proto.unshift = function () {
			this.splice.apply(this, ([0, 0]).concat(toArray(arguments)));
			return this.length();
		};

		// Like the standard js concat but return an array
		proto.concat = function () {
			// Every argument could either be an array or constraint array
			var args = map(arguments, function(arg) {
				return is_array(arg) ? arg.toArray() : arg;
			});
			var my_val = this.toArray();
			return my_val.concat.apply(my_val, args);
		};

		// Just like the standard JS slice
		proto.slice = function () {
			// Just call the normal slice with the same arguments
			var sliced_arr = this._value.slice.apply(this._value, arguments);
			return map(sliced_arr, function(x) {
				return x ? x.get() : undefined;
			});
		};

		proto.getConstraint = function(key) {
			return new Constraint(function() {
				return this.item(cjs.get(key));
			}, {
				context: this
			});
		};

		// All of these functions will just convert to an array and return that
		each(["filter", "join", "sort", "reverse", "valueOf", "toString"], function (fn_name) {
			proto[fn_name] = function () {
				var my_val = this.toArray();
				return my_val[fn_name].apply(my_val, arguments);
			};
		});
	}(ArrayConstraint));

	is_array = function(obj) {
		return obj instanceof ArrayConstraint;
	};

	cjs.array = function (value) { return new ArrayConstraint(value); };
	cjs.isArrayConstraint = is_array;
	cjs.ArrayConstraint = ArrayConstraint;

	//
	// ============== MAPS ============== 
	//

	// Maps use hashing to improve performance. By default, the hash is a simple toString
	// function
	var defaulthash = function (key) { return key.toString(); };

	// A string can also be specified as the hash, so that the hash is the result of calling
	// that property of the object
	var get_str_hash_fn = function (prop_name) {
		return function (key) {
			return key[prop_name]();
		};
	};

	// Map constraints are supposed to behave like normal objects ({}) with a few enhancements
	MapConstraint = function (options) {
		options = extend({
			hash: defaulthash, // Improves performance when searching by key
			valuehash: false, // Function if we should hash values, which improves performance when searching by value. By default, we don't hash values
			equals: eqeqeq, // Equality check when searching by key
			valueequals: eqeqeq, // Equality check when searching by value
			value: {}, // Optional starting value
			keys: [], // Rather than passing in 'value', keys and values can be equal-length arrays specifying keys...
			values: [], // and values
			literal_values: true, // true if every value should be literal
			create_unsubstantiated: true // Create a value when a key isn't found
		}, options);

		// Append all of the keys and values passed to the keys and values arrays
		each(options.value, function (v, k) {
			options.keys.push(k);
			options.values.push(v);
		}, this);

		// Convert to boolean
		this._default_literal_values = !!options.literal_values;
		this.$equality_check = new Constraint(options.equals, {literal: true});
		this.$vequality_check = new Constraint(options.valueequals, {literal: true});

		// Get my hash
		this._hash = isString(options.hash) ? get_str_hash_fn(options.hash) : options.hash;
		this._create_unsubstantiated = options.create_unsubstantiated;

		this._khash = {};

		// If we're hashing values, then set this._valuehash as a function
		if (options.valuehash) {
			this._vhash = {};
			if (isFunction(options.valuehash)) {
				this._valuehash = options.valuehash;
			} else if (isString(options.valuehash)) {
				this._valuehash = get_str_hash_fn(options.valuehash);
			} else {
				this._valuehash = defaulthash;
			}
		} else {
			this._vhash = false;
		}

		var is_literal = this._default_literal_values;

		// Keeps track of the values and maintains the proper order
		this._ordered_values = map(options.keys, function (k, i) {
			var v = options.values[i];
			// Have key (k) and value (v)
			var info = {
				key: new Constraint(k, {literal: true}),
				value: new Constraint(v, {literal: is_literal}),
				index: new Constraint(i, {literal: true})
			};

			// Properly put the entry into the key hash
			var hash = this._hash(k);
			var hash_val = this._khash[hash];
			if (hash_val) {
				hash_val.push(info);
			} else {
				this._khash[hash] = [info];
			}

			// If we hash values too, properly put the entry into the value hash
			if (this._vhash) {
				var value_hash = this._valuehash(v);
				var vhash_val = this._vhash[value_hash];
				if (vhash_val) {
					vhash_val.push(info);
				} else {
					this._vhash[value_hash] = [info];
				}
			}
			// And finally, set return info for this._ordered_values[i]
			return info;
		}, this);

		// Keeps track of requested values that aren't set
		this._unsubstantiated_values = {};

		// Array to store keys
		this.$keys = new Constraint(this._do_get_keys, {context: this});
		// Array to store values
		this.$values = new Constraint(this._do_get_values, {context: this});
		// Full entries (includes keys and values)
		this.$entries = new Constraint(this._do_get_entries, {context: this});
		// Number of keys
		this.$size = new Constraint(this._do_get_size, {context: this});
	};

	(function (my) {
		my.BREAK = ArrayConstraint.BREAK;
		var proto = my.prototype;

		// Utility function to return information about a key
		var _find_key = function (key, fetch_unsubstantiated, create_unsubstantiated) {
			// Get the hash
			var hash = this._hash(key),
				rv = {
					h: hash, // the actual hash value
					hv: false, // the hash array at the hash value
					i: -1, // the index of the key in the hash array
					ui: -1, // the index in the unsubstantiated array
					uhv: false // the unsubstantiated hash array
				},
				eq = this.$equality_check.get(),
				index_where_fn = function (a, b) {
					return eq(a.key.get(), key);
				},
				hash_values = this._khash[hash];

			if (hash_values) { // We found a potential hash array
				var key_index = indexWhere(hash_values, index_where_fn);
				rv.hv = hash_values;
				if(key_index >= 0) { // Wohoo! we also found the key in there
					rv.i = key_index;
					return rv;
				}
			}

			// Haven't returned yet, so we didn't find the entry. Look for an unsubstantiated
			// value instead.
			if (fetch_unsubstantiated !== false) { //Not found
				var unsubstantiated_values = this._unsubstantiated_values[hash];
				var unsubstantiated_index = -1;
				if (unsubstantiated_values) {
					rv.uhv = unsubstantiated_values;
					unsubstantiated_index = indexWhere(unsubstantiated_values, index_where_fn);
					if(unsubstantiated_index >= 0) {
						rv.ui = unsubstantiated_index;
						return rv;
					}
				}

				// We haven't returned yet, so we didn't find an unsubstantiated value either
				// Check to see if we should create one.
				if(create_unsubstantiated === true) {
					var is_literal = this._default_literal_values;
					var unsubstantiated_info = {
						key: new Constraint(key, {literal: true}),
						value: new Constraint(undefined, {literal: is_literal}), // will be undefined
						index: new Constraint(-1, {literal: true}) // with a negative index
					};

					if(unsubstantiated_values) { // The hash was found but not the particular value
						// Add it onto the end
						unsubstantiated_index = unsubstantiated_values.length;
						unsubstantiated_values[unsubstantiated_index] = unsubstantiated_info;
					} else {
						// The hash wasn't found; create a new array
						unsubstantiated_index = 0;
						this._unsubstantiated_values[hash] = unsubstantiated_values = [unsubstantiated_info];
					}
				}
				rv.uhv = unsubstantiated_values || false; // Want to return false if not found
				rv.ui = unsubstantiated_index;
			}
			return rv;
		};

		// Responsible for setting a key properly
		var _do_set_item_ki = function (ki, key, value, index, literal) {
			// ki is the key information from _find_key
			var i, value_hash, vhash_val, info,
				key_index = ki.i, // where the key is in the hash array
				hash_values = ki.hv, // the hash array
				hash = ki.h; // the hash value

			if (key_index >= 0) { // The key was already in this map
				// get the information
				info = hash_values[key_index];

				if (this._vhash) { // If we're hashing values, the new value has to get re-hashed
					var old_value = info.value.get(),
						old_value_hash = this._valuehash(old_value),
						old_vhash_val = this._vhash[old_value_hash];
					value_hash = this._valuehash(value);

					if (old_vhash_val) { // This should probably always be true, unless something went wrong...
						var len = old_vhash_val.length;
						for (i = 0; i < len; i += 1) {
							if (old_vhash_val[i] === info) { // wohoo, found it
								old_vhash_val.splice(i, 1);
								if (old_vhash_val.length === 0) {
									delete this._vhash[old_value_hash]; // don't keep the old hash array
								}
								break;
							}
						}
					}

					// Put the new value has in
					vhash_val = this._vhash[value_hash]; // hash array
					if (vhash_val) {
						vhash_val.push(info); // add onto the hash array
					} else {
						this._vhash[value_hash] = [info]; // create a new hash array
					}
				}

				info.value.set(value); // set the value constraint to the new value

				if (isPositiveInteger(index)) { // But they also specified an index...
					var old_index = info.index.get();
					if(old_index !== index) { // great...now we have to move it too
						// take out the old value
						this._ordered_values.splice(old_index, 1);
						// and re-add it
						this._ordered_values.splice(index, 0, info);

						// Properly iterate regardless of whether moving higher or lower
						var low = Math.min(old_index, index);
						var high = Math.max(old_index, index);
						// update the indicies of every thing between that might have been affected
						for (i = low; i <= high; i += 1) {
							_set_index(this._ordered_values[i], i);
						}
						this.$keys.invalidate(); // Keys are now invalid
					}
				}
			} else {
				// They didn't specify an index or at least they specified it wrong...
				if (!isPositiveInteger(index)) {
					index = this._ordered_values.length; // just set it to the 
				}
				// Check to see if there was an unsubstantiated item
				var unsubstantiated_index = ki.ui;

				if (unsubstantiated_index >= 0) { // Found it! Now let's remove it from the list of unsubstantiated items
					var unsubstantiated_hash_values = ki.uhv,
						unsubstantiated_info = unsubstantiated_hash_values[unsubstantiated_index];

					unsubstantiated_hash_values.splice(unsubstantiated_index, 1);
					if (unsubstantiated_hash_values.length === 0) {
						delete this._unsubstantiated_values[hash];
					}

					info = unsubstantiated_info; // re-use the same object to keep dependencies

					info.value.set(value); // but update its value and index
					info.index.set(index);
				} else {
					// Nothing in unsubstantiated; just create it from scratch
					info = {
						key: new Constraint(key, {literal: true}),
						value: new Constraint(value, {literal: literal === undefined ? this._default_literal_values : !!literal}),
						index: new Constraint(index, {literal: true})
					};
				}

				if(hash_values) { // There was already a hash array
					hash_values.push(info);
				} else { // Have to create the hash array
					hash_values = this._khash[hash] = [info];
				}

				//If we're hashing values...
				if (this._vhash) {
					value_hash = this._valuehash(value);
					vhash_val = this._vhash[value_hash];
					// Add the item to the value hash
					if (vhash_val) {
						vhash_val.push(info);
					} else {
						this._vhash[value_hash] = [info];
					}
				}

				//  insert into values
				this._ordered_values.splice(index, 0, info);

				// Push the index of every item that I spliced before up
				for (i = index + 1; i < this._ordered_values.length; i += 1) {
					_set_index(this._ordered_values[i], i);
				}
				// Now, size and keys are invalid
				this.$size.invalidate();
				this.$keys.invalidate();
			}
			this.$values.invalidate();
			this.$entries.invalidate();
		};

		// Cange an info's specified index
		var _set_index = function (info, to_index) {
			info.index.set(to_index);
		};

		// Deallocate memory from constraints
		var _destroy_info = function (infos, silent) {
			each(infos, function (info) {
				info.key.destroy(silent);
				info.value.destroy(silent);
				info.index.destroy(silent);
			});
		};

		// removes the selected item and destroys its value to deallocate it
		var _remove_index = function (index, silent) {
			var info = this._ordered_values[index];
			_destroy_info(this._ordered_values.splice(index, 1), silent);
			if(silent !== true) {
				this.$size.invalidate();
			}
		};
		
		// Getter for this.$keys constraint
		proto._do_get_keys = function () {
			var rv = [];
			this.forEach(function (value, key, index) {
				rv[index] = key;
			});
			return rv;
		};
		// used when keys() is called
		proto.keys = function () { return this.$keys.get(); };

		// Getter for this.$values constraint
		proto._do_get_values = function () {
			var rv = [];
			this.forEach(function (value, key, index) {
				rv[index] = value;
			});
			return rv;
		};
		//used when values() is called
		proto.values = function () { return this.$values.get(); };

		// Getter for this.$entries constraint
		proto._do_get_entries = function () {
			var rv = [];
			this.forEach(function (value, key, index) {
				rv[index] = {key: key, value: value};
			});
			return rv;
		};
		//used when entries() is called
		proto.entries = function () { return this.$entries.get(); };

		// Getter for this.$size constraint
		proto._do_get_size = function () {
			return this._ordered_values.length;
		};
		// used when size() is called
		proto.size = function () {
			return this.$size.get();
		};
		
		// Simple check if I have items
		proto.isEmpty = function () {
			return this.size() === 0;
		};

		// set the item at key (like this[key] = value)
		proto.set = proto.put = function (key, value, index, literal) {
			cjs.wait();
			// Find out if there's a key or unsubstantiated info but don't create it
			var ki = _find_key.call(this, key, true, false);
			// And do the work of putting
			_do_set_item_ki.call(this, ki, key, value, index, literal);
			cjs.signal();
			return this;
		};

		// Unset the item at key (like delete this[key])
		proto.remove = function (key) {
			// Find out if there's an actual key set
			var ki = _find_key.call(this, key, false, false);
			var key_index = ki.i,
				hash_values = ki.hv;
			var i;

			// If the item was found
			if (key_index >= 0) {
				cjs.wait();

				var info = hash_values[key_index]; // The info about the value
				var ordered_index = info.index.get(); // The map's index (not the index in the hash array)

				hash_values.splice(key_index, 1); // Remove info from the hash array
				if (hash_values.length === 0) { // If there isn't anything in the hash array,
					delete this._khash[ki.h]; // remove it
				}

				// If the value is also hashed..
				if (this._vhash) {
					// Find the value hash information
					var value_hash = this._valuehash(info.value.get()); // the lookup key for the value hash
					var vhash_val = this._vhash[value_hash]; // the value hash array
					if (vhash_val) { // Found the value hash
						var len = vhash_val.length;
						for (i = 0; i < len; i += 1) {
							if (vhash_val[i] === info) { // found the actual item
								vhash_val.splice(i, 1); // remove it from the array
								if (vhash_val.length === 0) {
									delete this._vhash[value_hash]; // and if it's empty, remove the whole value hash array
								}
								break; // Wohoo!
							}
						}
					}
				}

				_remove_index.call(this, ordered_index); // remove ordered_index (splices the ordered array)
				for (i = ordered_index; i < this._ordered_values.length; i += 1) {
					_set_index(this._ordered_values[i], i); // and update the index for every item
				}

				// And now all of these constraint variables are invalid.
				this.$size.invalidate();
				this.$keys.invalidate();
				this.$values.invalidate();
				this.$entries.invalidate();

				// OK, now you can run any nullified listeners
				cjs.signal();
			}
			return this;
		};
		
		// Get the item at key (like this[key])
		proto.get = function (key) {
			// Try to find the key and search in any unsubstantiated values
			var ki = _find_key.call(this, key, true, this._create_unsubstantiated),
				key_index = ki.i,
				hash_values = ki.hv;

			if (key_index >= 0) { // Found it; get the item in the hash's value
				var info = hash_values[key_index];
				return info.value.get();
			} else if(this._create_unsubstantiated) {
				var unsubstantiated_info = ki.uhv[ki.ui]; // use the unsubstantiated getter to create a dependency
				return unsubstantiated_info.value.get();
			} else { // not found and can't create unsubstantiated item
				return undefined;
			}
		};

		proto.getConstraint = function(key) {
			return new Constraint(function() {
				return this.get(cjs.get(key));
			}, {
				context: this
			});
		};

		// Empty out every entry
		proto.clear = function (silent) {
			if (this.size() > 0) { // If I actually have something
				cjs.wait();
				// Keep removing items
				while (this._ordered_values.length > 0) {
					_remove_index.call(this, 0, silent);
				}
				// And get rid of every key hash
				each(this._khash, function (arr, hash) {
					delete this._khash[hash];
				}, this);
				// and value hash if applicable
				if (this._vhash) {
					each(this._vhash, function (arr, hash) {
						delete this._vhash[hash];
					}, this);
				}

				// and everything should be invalid
				if(!silent) {
					this.$keys.invalidate();
					this.$values.invalidate();
					this.$entries.invalidate();
					this.$size.invalidate();
				}

				cjs.signal(); // ready to run nullification listeners
			}
			return this;
		};
		// Loop through every value and key calling func on it with this === context (or this)
		proto.forEach = function (func, context) {
			var i, info, len = this.size(),
				ov_clone = this._ordered_values.slice();
			context = context || this;
			for (i = 0; i < len; i += 1) {
				info = ov_clone[i];
				if (info && func.call(context, info.value.get(), info.key.get(), info.index.get()) === my.BREAK) { // break if desired
					break;
				}
			}
			return this;
		};
		// Change rules for key lookup
		proto.setEqualityCheck = function (equality_check) {
			this.$equality_check.set(equality_check);
			return this;
		};
		// Change rules for value lookup
		proto.setValueEqualityCheck = function (vequality_check) {
			this.$vequality_check.set(vequality_check);
			return this;
		};
		// Change how hashing is done
		proto.setHash = function (hash) {
			cjs.wait();
			// First, empty out the old key hash and unsubstantiated values
			this._hash = isString(hash) ? get_str_hash_fn(hash) : hash;
			this._khash = {};
			// Then, for every one of my values, re-hash
			each(this._ordered_values, function (info) {
				var key = info.key.get();
				var hash = this._hash(key);
				var hash_val = this._khash[hash];
				if (hash_val) {
					hash_val.push(info);
				} else {
					this._khash[hash] = [info];
				}
			}, this);

			// And re-hash for every unsubstantiated value
			var new_unsubstantiated_values = {};
			each(this._unsubstantiated_values, function(unsubstantiated_value_arr) {
				each(unsubstantiated_value_arr, function(info) {
					var key = info.key.get();
					var hash = this._hash(key);
					var hash_val = this.new_unsubstatiated_values[hash];
					if(hash_val) {
						hash_val.push(info);
					} else {
						new_unsubstantiated_values[hash] = [info];
					}
				}, this);
			}, this);
			this._unsubstantiated_values = new_unsubstantiated_values;

			cjs.signal();
			return this;
		};

		// Change how value hashing is done
		proto.setValueHash = function (vhash) {
			this._valuehash = isString(vhash) ? get_str_hash_fn(vhash) : vhash;
			// Empty out the old value hash
			this._vhash = {};

			if (this._valuehash) {
				// And reset the value hash for every element
				each(this._ordered_values, function (info) {
					var value = info.value.get();
					var hash = this._valuehash(value);
					var hash_val = this._vhash[hash];
					if (hash_val) {
						hash_val.push(info);
					} else {
						this._vhash[hash] = [info];
					}
				}, this);
			}

			return this;
		};
		proto.item = function (arg0, arg1, arg2) {
			if(arguments.length === 0) { // no arguments? return an object
				return this.toObject();
			} else if (arguments.length === 1) { // One, try to get the keys values
				return this.get(arg0);
			} else { // more than two, try to set
				return this.put(arg0, arg1, arg2);
			}
		};
		// Find the item in myself (uses hashing)
		proto.indexOf = function (key) {
			// get hash information
			var ki = _find_key.call(this, key, true, this._create_unsubstantiated),
				key_index = ki.i,
				hash_values = ki.hv;
			if (key_index >= 0) { // Found! return the proper item's index
				var info = hash_values[key_index];
				return info.index.get();
			} else if(ki.ui >= 0) { // Not found but creating unsubstantiated items
				var unsubstantiated_info = ki.uhv[ki.ui];
				return unsubstantiated_info.index.get(); // create a dependency
			} else { // Not found and not creating unsubstantiated items
				return -1;
			}
		};

		// This function will search for a key and create it if not found
		proto.get_or_put = function (key, create_fn, create_fn_context, index, literal) {
			var ki = _find_key.call(this, key, true, false);
			var key_index = ki.i, // index within hash array
				hash_values = ki.hv, // hash array
				hash = ki.h; // hash value
			if (key_index >= 0) { // found actual item!
				var info = hash_values[key_index];
				return info.value.get();
			} else { // need to create it
				cjs.wait();
				var context = create_fn_context || this;
				var value = create_fn.call(context, key); // will set the value to this
				_do_set_item_ki.call(this, ki, key, value, index, literal); // do the work of putting
				cjs.signal();
				return value;
			}
		};

		// Check if we have a given key
		proto.has = proto.containsKey = function (key) {
			var ki = _find_key.call(this, key, true, this._create_unsubstantiated);
			var key_index = ki.i;
			if (key_index >= 0) { // Found successfully
				return true;
			} else if(this._create_unsubstantiated) { // Didn't find but there is an unusbstantiated item
				var unsubstantiated_info = ki.uhv[ki.ui];
				unsubstantiated_info.index.get(); // Add a dependency
				return false;
			} else { // No dependency to be added; just saya we didn't find it
				return false;
			}
		};

		//Move an item from one index to another given the item's index
		proto.moveIndex = function (old_index, new_index) {
			var i;
			cjs.wait();
			var info = this._ordered_values[old_index];
			// take out the old value
			this._ordered_values.splice(old_index, 1);
			// and re-add it
			this._ordered_values.splice(new_index, 0, info);

			// Properly iterate regardless of whether moving higher or lower
			var low = Math.min(old_index, new_index);
			var high = Math.max(old_index, new_index);
			// update the indicies of every thing between that might have been affected
			for (i = low; i <= high; i += 1) {
				_set_index(this._ordered_values[i], i);
			}

			// Invalidate the relevant properties (size shouldn't change)
			this.$keys.invalidate();
			this.$values.invalidate();
			this.$entries.invalidate();

			cjs.signal();
			return this;
		};
		// Move an item from one index to another given the item's key
		proto.move = function (key, to_index) {
			//Move a key to a new index
			var ki = _find_key.call(this, key, false, false);
			var key_index = ki.i;
			if (key_index >= 0) {
				var info = ki.hv[key_index];
				// leverage the previous move_index function
				this.moveIndex(info.index.get(), to_index);
			}
			return this;
		};

		// Given a value, find the corresponding key
		proto.keyForValue = function (value, eq_check) {
			eq_check = eq_check || this.$vequality_check.get();
			var i;
			// It's advantageous here to use a value hash if it's there
			if (this._vhash) {
				var value_hash = this._valuehash(value);
				var vhash_val = this._vhash[value_hash];
				// Find that value hash's array
				if (vhash_val) {
					var len = vhash_val.length;
					for (i = 0; i < len; i += 1) {
						var info = vhash_val[i];
						if (eq_check(info.value.get(), value)) { // found it! here's the key
							return info.key.get();
						}
					}
				}
				// Didn't find it
				return undefined;
			} else {
				// Without a value hash, we have to iterate through every item
				var key;
				this.forEach(function (v, k) {
					if (eq_check(value, v)) { // found
						key = k;
						return my.BREAK; // Break out of the forEach
					}
				});
				return key;
			}
		};
		// Useful for deallocating memory
		proto.destroy = function (silent) {
			cjs.wait();
			this.clear(silent);
			this.$equality_check.destroy(silent);
			this.$vequality_check.destroy(silent);
			this.$keys.destroy(silent);
			this.$values.destroy(silent);
			this.$entries.destroy(silent);
			this.$size.destroy(silent);
			cjs.signal();
		};
		// optional filter to apply to every key
		proto.toObject = function (key_map_fn) {
			var rv = {};
			key_map_fn = key_map_fn || identity; // just use the key if not supplied
			this.forEach(function (v, k) { rv[key_map_fn(k)] = v; });
			return rv;
		};
	}(MapConstraint));

	is_map = function(obj) {
		return obj instanceof MapConstraint;
	};

	cjs.map = function (arg0, arg1) { return new MapConstraint(arg0, arg1); };
	cjs.isMapConstraint = is_map;
	cjs.MapConstraint = MapConstraint;

	//
	// ============== LIVEN ============== 
	//

	// Will automatically call the provided function when it becomes invalid
	cjs.liven = function (func, options) {
		options = extend({
			context: root, // what to equate 'this' to
			run_on_create: true, // whether it should run immediately
			pause_while_running: false, // whether to allow the function to be called recursively (indirectly)
			on_destroy: false // a function to call when this liven function is destroyed
		}, options);

		//Make constraint-aware values just by calling func in a constraint
		var node = new Constraint(func, {
			context: options.context,
			cache_value: false,
			auto_add_outgoing_dependencies: false,
			run_on_add_listener: !!options.run_on_create
		});

		// check if running
		var paused = false;
		var do_get;

		// Destroy the node and make sure no memory is allocated
		var destroy = function (silent) {
			if(options.on_destroy) {
				options.on_destroy.call(options.context, silent);
			}
			node.destroy(silent);
			node = null;
		};

		// Stop changing and remove it from the event queue if necessary
		var pause = function () {
			if(paused === false) {
				paused = true;
				node.offChange(do_get);
				return true; // successfully paused
			}
			return false;
		};

		// Re-add to the event queue
		var resume = function () {
			if(paused === true) {
				paused = false;
				node.onChange(do_get);
				return true; // successfully resumed
			}
			return false;
		};

		// The actual getter, will call the constraint's getter
		do_get = function () {
			if (options.pause_while_running) {
				pause();
			}
			node.get();
			if (options.pause_while_running) {
				resume();
			}
		};

		// When the value changes, call do_get
		node.onChange(do_get);

		var rv = {
			destroy: destroy,
			pause: pause,
			resume: resume,
			run: function(arg0) {
				do_get(arg0);
				return this;
			},
			_constraint: node // for debugging purposes
		};
		return rv;
	};

	// A function to hash the arguments passed in. By default, just a concatenation of the arguments' string value
	var memoize_default_hash = function () {
		var i, len = arguments.length;
		var rv = "";
		for (i = 0; i < len; i += 1) {
			rv += arguments[i];
		}
		return rv;
	};
	// A function to check if two sets of arguments are equal; by default just check every value
	var memoize_default_equals = function (args1, args2) {
		var i,
			len = args1.length;
		if (len === args2.length) {
			for (i = 0; i < len; i += 1) {
				var arg1 = args1[i],
					arg2 = args2[i];
				if (arg1 !== arg2) {
					return false;
				}
			}
			return true;
		} else {
			return false;
		}
	};

	// Memoize takes a function and applies a getter_fn as a filter
	var memoize = function (getter_fn, options) {
		options = extend({
			hash: memoize_default_hash,
			equals: memoize_default_equals,
			context: root,
			literal_values: false
		}, options);

		// Map from args to value
		var args_map = new MapConstraint({
			hash: options.hash,
			equals: options.equals,
			literal_values: options.literal_values
		});

		// When getting a value either create a constraint or return the existing value
		var rv = function () {
			var args = toArray(arguments),
				constraint = args_map.get_or_put(args, function() {
					return new Constraint(function () {
						return getter_fn.apply(options.context, args);
					});
				});
			return constraint.get();
		};

		// Clean up memory after self
		rv.destroy = function (silent) {
			args_map.forEach(function (constraint) {
				constraint.destroy(silent);
			});
			args_map.destroy(silent);

			args_map = null;
			options = null;
		};

		// Run through every argument and call fn on it
		rv.each = function (fn) {
			args_map.forEach(fn);
		};
		return rv;
	};

	cjs.memoize = memoize;

	var make_node = function(item) {
			if(isAnyElement(item)) {
				return item;
			} else {
				var node = doc.createTextNode(item);
				return node;
			}
		},
		insert_at = function(child_node, parent_node, index) {
			var children = parent_node.childNodes;
			if(children.length <= index) {
				parent_node.appendChild(child_node);
			} else {
				var before_child = children[index];
				parent_node.insertBefore(child_node, before_child);
			}
		},
		remove_node = function(child_node) {
			var parentNode = child_node.parentNode;
			if(parentNode !== null) {
				parentNode.removeChild(child_node);
			}
		},
		remove_index = function(parent_node, index) {
			var children = parent_node.childNodes, child_node;
			if(children.length > index) {
				child_node = children[index];
				remove_node(child_node);
			}
		},
		move_child = function(parent_node, to_index, from_index) {
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
		},
		// Check if jQuery is available
		is_jquery_obj = function(x) {
			return has(root, "jQuery") ? (x instanceof root.jQuery) : false;
		},
		nList = root.NodeList || false,
		// a node list is what is returned when you call getElementsByTagName, etc.
		isNList = nList ? function(x) { return x instanceof nList; } : function() { return false; },
		// Convert an object that can be passed into a binding into an array of dom elements
		get_dom_array = function(obj) {
			if(isArray(obj)) { // already an array
				return obj;
			} else if (is_constraint(obj)) { // regular constraint
				return get_dom_array(obj.get());
			} else if(is_array(obj)) { // array constraint
				return obj.toArray();
			} else if(is_map(obj)) { // map constraint
				return obj.values();
			} else if(is_jquery_obj(obj)) { // jquery object
				return root.jQuery.makeArray(obj);
			} else if(isNList(obj)) { // node list
				return toArray(obj);
			} else { // hopefully just an element; return its value as an array
				return [obj];
			}
		};

	var Binding = function(options) {
		var targets = options.targets,
			initialValue = options.initialValue,
			onAdd = options.onAdd,
			onRemove = options.onRemove,
			onMove = options.onMove,
			setter = options.setter,
			getter = options.getter,
			init_val = options.init_val;

		this._throttle_delay = false;
		this._timeout_id = false;

		var curr_value, last_value;
		if(isFunction(init_val)) {
			last_value = init_val(get_dom_array(targets[0]));
		} else {
			last_value = init_val;
		}
		var old_targets = [];
		this._do_update = function() {
			this._timeout_id = false;
			var new_targets = filter(get_dom_array(targets), isAnyElement);

			if(onAdd || onRemove || onMove) {
				var diff = get_array_diff(old_targets, new_targets);
				each(onRemove && diff.removed, function(removed) { onRemove(removed.from_item, removed.from); });
				each(onAdd && diff.added, function(added) { onAdd(added.item, added.to); });
				each(onMove && diff.moved, function(moved) { onMove(moved.item, moved.to_index, moved.from_index); });
				old_targets = new_targets;
			}

			each(new_targets, function(target) {
				setter(target, curr_value, last_value);
			});
			last_value = curr_value;
		};

		this.$live_fn = cjs.liven(function() {
			curr_value = getter();
			if(this._throttle_delay && !this._timeout_id) {
				this._timeout_id = sTO(bind(this._do_update, this), this._throttle_delay);
			} else {
				this._do_update();
			}
		}, {
			context: this
		});
	};

	(function(my) {
		var proto = my.prototype;
		proto.pause = function() {
			this.$live_fn.pause();
		};
		proto.resume = function() {
			this.$live_fn.resume();
		};
		proto.throttle = function(min_delay) {
			this._throttle_delay = min_delay > 0 ? min_delay : false;
			if(this._throttle_delay && this._timeout_id) {
				cTO(this._timeout_id);
				this._timeout_id = false;
			}
			this.$live_fn.run();
			return this;
		};
		proto.destroy = function() {
			this.$live_fn.destroy();
		};
	}(Binding));

	var create_list_binding = function(list_binding_getter, list_binding_setter, list_binding_init_value) {
		return function(elements) {
			var args = slice.call(arguments, 1);
			var val = cjs(function() {
				return list_binding_getter(args);
			});

			var binding = new Binding({
				targets: elements,
				getter: function() { return val.get(); },
				setter: function(element, value, old_value) {
					list_binding_setter(element, value, old_value);
				},
				init_val: list_binding_init_value
			});
			return binding;
		};
	};
	
	var create_textual_binding = function(setter) {
		return create_list_binding(function(args) {
			return map(args, cjs.get).join("");
		}, function(element, value) {
			setter(element, value);
		});
	};
	var text_binding = create_textual_binding(function(element, value) {
			element.textContent = value;
		}),
		html_binding = create_textual_binding(function(element, value) {
			element.innerHTML = value;
		}),
		val_binding = create_textual_binding(function(element, value) {
			element.val = value;
		}),
		class_binding = create_list_binding(function(args) {
			var arg_val_arr = map(args, function(arg) {
				return cjs.get(arg);
			});

			return flatten(arg_val_arr, true);
		}, function(element, value, old_value) {
			var ad = get_array_diff(old_value, value);
			var curr_class_name = " " + element.className + " ";
			var added_classes = map(ad.added, function(added_info) {
				return added_info.item;
			}).join(" ");
			each(ad.removed, function(removed_info) {
				curr_class_name = curr_class_name.replace(" " + removed_info.from_item + " ", " ");
			});
			curr_class_name += added_classes;
			curr_class_name = curr_class_name.trim();
			element.className = curr_class_name;
		}, []);

	var children_binding = create_list_binding(function(args) {
		var arg_val_arr = map(args, function(arg) {
			return cjs.get(arg);
		});

		return map(flatten(arg_val_arr, true), make_node);
	}, function(element, value, old_value) {
		var ad = get_array_diff(old_value, value);
		each(ad.removed, function(removed_info) { remove_index(element, removed_info.from); });
		each(ad.added, function(added_info) { insert_at(added_info.item, element, added_info.to); });
		each(ad.moved, function(moved_info) { move_child(element, moved_info.to_index, moved_info.from_index); });
	}, function(element) {
		return toArray(element.childNodes);
	});

	var create_obj_binding = function(obj_binding_setter) {
		return function(elements) {
			var vals,
				args = slice.call(arguments, 1);
			if(args.length === 0) {
				return;
			} else if(args.length === 1) {
				vals = args[0];
			} else if(args.length > 1) {
				vals = {};
				vals[args[0]] = args[1];
			}

			var binding = new Binding({
				targets: elements,
				setter: function(element, value) {
					each(value, function(v, k) {
						obj_binding_setter(element, k, v);
					});
				},
				getter: function() {
					var obj_vals, rv = {};
					if(is_map(vals)) {
						obj_vals = vals.toObject();
					} else {
						obj_vals = vals;
					}
					each(obj_vals, function(v, k) {
						rv[k] = cjs.get(v);
					});
					return rv;
				}
			});

			return binding;
		};
	};
	var css_binding = create_obj_binding(function(element, key, value) {
			element.style[camel_case(key)] = value;
		}),
		attr_binding = create_obj_binding(function(element, key, value) {
			element.setAttribute(key, value);
		});

	extend(cjs, {
		"text": text_binding,
		"html": html_binding,
		"val": val_binding,
		"class": class_binding,
		"children": children_binding,
		"attr": attr_binding,
		"css": css_binding
	});

	var inp_change_events = ["keyup", "input", "paste", "propertychange", "change"];
	cjs.inputValue = function(inps) {
		var arr_inp;
		if(isElement(inps)) {
			inps = [inps];
			arr_inp = false;
		} else {
			arr_inp = true;
		}
        var constraint = cjs(function() {
				if(arr_inp) {
					return map(inps, function(inp) { return inp.value; });
				} else {
					return inps[0].value;
				}
			}),
			len = inps.length,
			on_change = bind(constraint.invalidate, constraint),
			activate = function() {
				each(inp_change_events, function(event_type) {
					each(inps, function(inp) {
						inp.addEventListener(event_type, on_change);
					});
				});
			},
			deactivate = function() {
				each(inp_change_events, function(event_type) {
					each(inps, function(inp) {
						inp.removeEventListener(event_type, on_change);
					});
				});
			},
			oldDestroy = constraint.destroy;

		constraint.destroy = function() {
			deactivate();
			oldDestroy.call(constraint);
		};
        activate();
        return constraint;
	};

	/*
	 * ConstraintJS representation for finite-state machines
	 */

	// State keeps track of basic state information (its containing FSM does most of the work)
	var State = function(fsm, name) {
		this._fsm = fsm; // parent fsm
		this._name = name; // state name (fetch with getName)
		this._id = uniqueId(); // useful for storage
	};

	(function(my) {
		var proto = my.prototype;
		proto.getName = function() { return this._name; }; // getter for name
		proto.id = function() { return this._id; }; // getter for id
	}(State));

	// Simple transition representation (again, the containing FSM does most of the work)
	var Transition = function(fsm, from_state, to_state, name) {
		this._fsm = fsm; // parent FSM
		this._from = from_state; // from state (fetch with getFrom)
		this._to = to_state; // to state (fetch with getTo)
		this._name = name; // name (fetch with getName)
		this._id = uniqueId(); // useful for storage
	};

	(function(my) {
		var proto = my.prototype;
		proto.getFrom = function() { return this._from; }; // from getter
		proto.getTo = function() { return this._to; }; // to getter
		proto.getName = function() { return this._name; }; // name getter
		proto.getFSM = function() { return this._fsm; }; // FSM getter
		proto.id = function() { return this._id; }; // getter for id
		proto.run = function() {
			var fsm = this.getFSM();
			// do_transition should be called by the user's code
			if(fsm.is(this.getFrom())) {
				var args = toArray(arguments);
				args.unshift(this);
				args.unshift(this.getTo());
				fsm._setState.apply(fsm, args);
			}
		};
	}(Transition));

	/*
	 * The following selector constructors are used internally to keep track of user-specified
	 * selectors (a -> b represents the transition from a to b).
	 * 
	 * Developers using cjs can specify that they want to add listeners for any number of such
	 * selectors and they will be dynamically evaluated and called. For instance, if the user
	 * adds a selector for any state to stateA (represented as * -> stateA) *before* stateA is
	 * created, then if the developer later adds a state named stateA, their callback should be
	 * called whenever the fsm transitions to that newly created stateA
	 */

	// The selector for a state with a supplied name (e.g. stateA)
	var StateSelector = function(state_name) {
		this._state_name = state_name;
	};
	(function(my) {
		var proto = my.prototype;
		proto.matches = function(state) {
			// Supplied object should be a State object with the given name
			return state instanceof State && (this._state_name === state || this._state_name === state.getName());
		};
	}(StateSelector));

	// Matches any state (e.g. *)
	var AnyStateSelector = function() { };
	(function(my) {
		var proto = my.prototype;
		// will match any state (but not transition)
		proto.matches = function(state) {return state instanceof State;};
	}(AnyStateSelector));

	// Matches certain transitions (see transition formatting spec)
	var TransitionSelector = function(pre, from_state_selector, to_state_selector) {
		this.is_pre = pre; // should fire before the transition (as opposed to after)
		this.from_state_selector = from_state_selector; // the selector for the from state (should be a StateSelector or AnyStateSelector)
		this.to_state_selector = to_state_selector; // selector for the to state
	};
	(function(my) {
		var proto = my.prototype;
		// Make sure that the supplied object is a transition with the same timing
		proto.matches = function(transition, pre) {
			if(transition instanceof Transition && this.is_pre === pre) { 
				var from_state = transition.getFrom();
				var to_state = transition.getTo();
				// And then make sure both of the states match as well
				return this.from_state_selector.matches(from_state) &&
						this.to_state_selector.matches(to_state);
			} else { return false; }
		};
	}(TransitionSelector));

	// Multiple possiblities (read OR, not AND)
	var MultiSelector = function(selectors) {
		this.selectors = selectors; // all of the selectors to test
	};
	(function(my) {
		var proto = my.prototype;
		proto.matches = function() {
			var match_args = arguments;
			// See if any selectors match
			return any(this.selectors, function(selector) {
				return selector.matches.apply(selector, match_args);
			});
		};
	}(MultiSelector));

	// return a selector object from a string representing a single state
	var parse_single_state_spec = function(str) {
		if(str === "*") {
			return new AnyStateSelector();
		} else {
			return new StateSelector(str);
		}
	};

	// Parse one side of the transition
	var parse_state_spec = function(str) {
		// Split by , and remove any excess spacing
		var state_spec_strs = map(str.split(","), function(ss) { return ss.trim(); }); 

		// The user only specified one state
		if(state_spec_strs.length === 1) {
			return parse_single_state_spec(state_spec_strs[0]);
		} else { // any number of states
			var state_specs = map(state_spec_strs, parse_single_state_spec);
			return new MultiSelector(state_specs);
		}
	};

	// The user specified a transition
	var parse_transition_spec = function(left_str, transition_str, right_str) {
		var left_to_right_transition, right_to_left_transition;
		var left_state_spec = parse_state_spec(left_str);
		var right_state_spec = parse_state_spec(right_str);

		// Bi-directional, after transition
		if(transition_str === "<->") {
			left_to_right_transition = new TransitionSelector(false, left_state_spec, right_state_spec);
			right_to_left_transition = new TransitionSelector(false, right_state_spec, left_state_spec);
			return new MultiSelector(left_to_right_transition, right_to_left_transition);
		} else if(transition_str === ">-<") { // bi-directional, before transition
			left_to_right_transition = new TransitionSelector(true, left_state_spec, right_state_spec);
			right_to_left_transition = new TransitionSelector(true, right_state_spec, left_state_spec);
			return new MultiSelector(left_to_right_transition, right_to_left_transition);
		} else if(transition_str === "->") { // left to right, after transition
			return new TransitionSelector(false, left_state_spec, right_state_spec);
		} else if(transition_str === ">-") { // left to right, before transition
			return new TransitionSelector(true, left_state_spec, right_state_spec);
		} else if(transition_str === "<-") { // right to left, after transition
			return new TransitionSelector(false, right_state_spec, left_state_spec);
		} else if(transition_str === "-<") { // right to left, before transition
			return new TransitionSelector(true, right_state_spec, left_state_spec);
		} else { return null; } // There shouldn't be any way to get here...
	};

	var transition_separator_regex = new RegExp("^([\\sa-zA-Z0-9,\\-_*]+)((<->|>-<|->|>-|<-|-<)([\\sa-zA-Z0-9,\\-_*]+))?$");
	// Given a string specifying a state or set of states, return a selector object
	var parse_spec = function(str) {
		var matches = str.match(transition_separator_regex);
		if(matches === null) {
			return null; // Poorly formatted specification
		} else {
			if(matches[2] === undefined) {
				// The user specified a state: "A": ["A", "A", undefined, undefined, undefined]
				var states_str = matches[1];
				return parse_state_spec(states_str);
			} else {
				// The user specified a transition: "A->b": ["A->b", "A", "->b", "->", "b"]
				var from_state_str = matches[1], transition_str = matches[3], to_state_str = matches[4];
				return parse_transition_spec(from_state_str, transition_str, to_state_str);
			}
		}
	};


	// StateListener
	var state_listener_id = 0;
	var StateListener = function(selector, callback, context) {
		this._context = context || root; // 'this' in the callback
		this._selector = selector; // used to record interest
		this._callback = callback; // the function to call when selector matches
		this._id = state_listener_id++; // unique id
	};
	(function(my) {
		var proto = my.prototype;
		// Used to determine if run should be called by the fsm
		proto.interested_in = function() { return this._selector.matches.apply(this._selector, arguments); };
		// Run the user-specified callback
		proto.run = function() { this._callback.apply(this._context, arguments); };
	}(StateListener));

	var FSM = function() {
		this._states = {}; // simple substate representations
		this._transitions = []; // simple transition representations
		this._curr_state = null; // the currently active state
		this._listeners = []; // listeners for every selector
		this._chain_state = null; // used internally for chaining
		this._did_transition = false; // keeps track of if any transition has run (so that when the user specifies
									// a start state, it knows whether or not to change the current state

		this.state = cjs(function() { // the name of the current state
			if(this._curr_state) { return this._curr_state.getName(); }
			else { return null; }
		}, {
			context: this
		});

		// Option to pass in state names as arguments
		var state_names = flatten(arguments, true);
		each(state_names, this.addState, this);
	};
	(function(my) {
		var proto = my.prototype;
		// Creates and returns a new state object with name state
		proto.createState = function(state_name) {
			var state = new State(this, state_name);
			this._states[state_name] = state;
			return state;
		};

		// Either creates a state with name state_name or sets the current
		// chain state to that state
		proto.addState = function(state_name) {
			var state = this.stateWithName(state_name);
			if(state === null) {
				state = this.createState.apply(this, arguments);
				if(this._curr_state === null) { this._curr_state = state; } // if there isn't an active state,
																		// make this one the starting state by default
			}

			this._chain_state = state;
			return this;
		};
		// Find the state with a given name
		proto.stateWithName = function(state_name) {
			return this._states[state_name] || null;
		};

		// Returns the name of the state this machine is currently in
		proto.getState = function() {
			return this.state.get();
		};
		
		// Add a transition from the last state that was added (the chain state) to a given state
		// add_transition_fn will be called with the code to do a transition as a parameter
		proto.addTransition = function(a, b, c) {
			var from_state, to_state, transition, add_transition_fn, return_transition_func = false;

			if(arguments.length === 0) {
				throw new Error("addTransition expects at least one argument");
			} else if(arguments.length === 1) { // make a transition from the last entered state to the next state
				return_transition_func = true;
				from_state = this._chain_state;
				to_state = a;
			} else if(arguments.length === 2) {
				if(isFunction(b) || b instanceof CJSEvent) { // b is the function to add the transition
					from_state = this._chain_state;
					to_state = a;
					add_transition_fn = b;
				} else { // from and to states specified
					from_state = a;
					to_state = b;
					return_transition_func = true;
				}
			} else if(arguments.length > 2) {
				from_state = a;
				to_state = b;
				add_transition_fn = c;
			}

			// do_transition is a function that can be called to activate the transition
			transition = this._getTransition(from_state, to_state);
			if(return_transition_func) {
				return bind(transition.run, transition);
			} else {
				if(add_transition_fn instanceof CJSEvent) {
					add_transition_fn._addTransition(transition);
				} else {
					// call the supplied function with the code to actually perform the transition
					add_transition_fn.call(this, bind(transition.run, transition), this);
				}
				return this;
			}
		};

		// Creates a new transition that will go from from_state to to_state
		proto._getTransition = function(from_state, to_state) {
			if(isString(from_state)) {
				from_state = this.stateWithName(from_state);
			}
			if(isString(to_state)) {
				to_state = this.stateWithName(to_state);
			}
			
			var transition = new Transition(this, from_state, to_state);
			this._transitions.push(transition);

			return transition;
		};
		// This function should, ideally, be called by a transition instead of directly
		proto._setState = function(state, transition) {
			var from_state = this.getState(); // the name of my current state
			var to_state = isString(state) ? this.stateWithName(state) : state;
			if(!to_state) {
				throw new Error("Could not find state '" + state + "'");
			}
			this.did_transition = true;

			// Look for pre-transition callbacks
			each(this._listeners, function(listener) {
				if(listener.interested_in(transition, true)) {
					listener.run(transition, to_state, from_state); // and run 'em
				}
			});
			this._curr_state = to_state;
			this.state.invalidate();
			// Look for post-transition callbacks..
			// and also callbacks that are interested in state entrance
			each(this._listeners, function(listener) {
				if(listener.interested_in(transition, false)) {
					listener.run(transition, to_state, from_state); // and run 'em
				} else if(listener.interested_in(to_state)) {
					listener.run(transition, to_state, from_state); // and run 'em
				}
			});
		};
		proto.destroy = function() {
			this.state.destroy();
			this._states = {};
			this._transitions = [];
			this._curr_state = null;
		};
		proto.startsAt = function(state_name) {
			var state = this.stateWithName(state_name); // Get existing state
			if(state === null) {
				// or create it if necessary
				state = this.create_state(state_name);
			}
			if(!this.did_transition) {
				// If no transitions have occured, set the current state to the one they specified
				this._curr_state = state;
			}
			this._chain_state = state;
			return this;
		};
		proto.is = function(state_name) {
			// get the current state name...
			var state = this.getState();
			if(state === null) { return false; }
			else {
				// ...and compare
				if(isString(state_name)) {
					return state === state_name;
				} else {
					return state === state_name.getName();
				}
			}
		};
		// A function to be called when the given string is true
		proto.on = proto.addEventListener = function(spec_str, callback, context) {
			var selector;
			if(isString(spec_str)) {
				selector = parse_spec(spec_str);
				if(selector === null) {
					throw new Error("Unrecognized format for state/transition spec.");
				}
			} else {
				selector = spec_str;
			}
			var listener = new StateListener(selector, callback, context);
			this._listeners.push(listener);
			return this;
		};

		// Remove the listener specified by an on call; pass in just the callback
		proto.off = proto.removeEventListener = function(listener_callback) {
			this._listeners = filter(this._listeners, function(listener) {
				return listener.callback !== listener_callback;
			});
			return this;
		};
	}(FSM));

	cjs.fsm = function() {
		return new FSM(arguments);
	};
	cjs.is_fsm = function(obj) {
		return obj instanceof FSM;
	};

	var CJSEvent = function(parent, filter, onAddTransition, onRemoveTransition) {
		this._do_transition = false;
		this._listeners = [];
		this._transitions = [];
		this._on_add_transition = onAddTransition;
		this._on_remove_transition = onRemoveTransition;
		this._live_fns = {};
		if(parent) {
			parent._listeners.push({event:this, filter: filter});
		}
	};

	(function(my) {
		var proto = my.prototype;
		proto.guard = function(filter) {
			return new CJSEvent(this, filter);
		};
		proto._addTransition = function(transition) {
			this._transitions.push(transition);
			if(this._on_add_transition) {
				this._live_fns[transition.id()] = this._on_add_transition(transition);
			}
		};
		proto._removeTransition = function(transition) {
			var index = indexOf(this._transitions, transition);
			if(index >= 0) {
				this._transitions.splice(index, 1);
				if(this._on_remove_transition) {
					this._on_remove_transition(transition);
				}
				var tid = transition.id();
				this._live_fns[tid].destroy();
				delete this._live_fns[tid];
			}
		};
		proto._fire = function() {
			var args = arguments;
			each(this._transitions, function(transition) {
				transition.run.apply(transition, args);
			});
			each(this._listeners, function(listener_info) {
				var listener = listener_info.event,
					filter = listener_info.filter;

				if(!filter || filter.apply(root, args)) {
					listener._fire.apply(listener, args);
				}
			});
		};
	}(CJSEvent));

	var isElementOrWindow = function(elem) { return elem === root || isElement(elem); },
		do_trim = function(x) { return x.trim(); },
		split_and_trim = function(x) { return map(x.split(" "), do_trim); },
		timeout_event_type = "timeout";

	cjs.on = function(event_type) {
		var rest_args = arguments.length > 1 ? slice.call(arguments, 1) : root,
			event = new CJSEvent(false, false, function(transition) {
				var targets = [],
					timeout_id = false,
					event_type_val = [],
					listener = bind(transition.run, transition),
					fsm = transition.getFSM(),
					from = transition.getFrom(),
					state_selector = new StateSelector(from),
					from_state_selector = new TransitionSelector(true, state_selector, new AnyStateSelector()),
					on_listener = function() {
						each(event_type_val, function(event_type) {
							if(event_type === timeout_event_type) {
								if(timeout_id) {
									cTO(timeout_id);
									timeout_id = false;
								}

								var delay = cjs.get(rest_args[0]);
								if(!isNumber(delay) || delay < 0) {
									delay = 0;
								}

								timeout_id = sTO(listener, delay);
							} else {
								each(targets, function(target) {
									target.addEventListener(event_type, listener);
								});
							}
						});
					},
					off_listener = function() {
						each(event_type_val, function(event_type) {
							each(targets, function(target) {
								if(event_type === timeout_event_type) {
									if(timeout_id) {
										cTO(timeout_id);
										timeout_id = false;
									}
								} else {
									target.removeEventListener(event_type, listener);
								}
							});
						});
					},
					live_fn = cjs.liven(function() {
						off_listener();

						event_type_val = split_and_trim(cjs.get(event_type));
						targets = filter(get_dom_array(rest_args), isElementOrWindow);

						fsm	.on(state_selector, on_listener)
							.on(from_state_selector, off_listener);
						if(fsm.is(from)) {
							on_listener();
						}
					});
				return live_fn;
			});
		return event;
	};

	var FSMConstraint = function(options) {
		FSMConstraint.superclass.constructor.call(this, this._getter, extend({context: this}, options));
		this.$getter = cjs.constraint(undefined, {literal: true});
	};
	(function(my) {
		proto_extend(my, Constraint);
		var proto = my.prototype;

		proto._getter = function() {
			var getter = this.$getter.get();
			return isFunction(getter) ? getter.call(this) : cjs.get(getter);
		};
		proto.inFSM = function(fsm, values) {
			each(values, function(v, k) {
				fsm.on(k, function() {
					this.$getter.set(v);
				}, this);
				if(fsm.is(k)) {
					this.$getter.set(v);
				}
			}, this);
			return this;
		};
	}(FSMConstraint));

	cjs.inFSM = function() {
		var constraint = new FSMConstraint();
		return constraint.inFSM.apply(constraint, arguments);
	};
	cjs.FSMConstraint = FSMConstraint;

	//Based on Mu's parser: https://github.com/raycmorgan/Mu
	/*
	 * HTML Parser By John Resig (ejohn.org)
	 * Original code by Erik Arvidsson, Mozilla Public License
	 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
	 *
	 * // Use like so:
	 * HTMLParser(htmlString, {
	 *     start: function(tag, attrs, unary) {},
	 *     end: function(tag) {},
	 *     chars: function(text) {},
	 *     comment: function(text) {}
	 * });
	 *
	 * // or to get an XML string:
	 * HTMLtoXML(htmlString);
	 *
	 * // or to get an XML DOM Document
	 * HTMLtoDOM(htmlString);
	 *
	 * // or to inject into an existing document/DOM node
	 * HTMLtoDOM(htmlString, document);
	 * HTMLtoDOM(htmlString, document.body);
	 *
	 */
	var makeMap = function(str){
		var obj = {};
		each(str.split(","), function(item) { obj[item] = true; });
		return obj;
	};

	// Regular Expressions for parsing tags and attributes
	var startTag = /^<([\-A-Za-z0-9_]+)((?:\s+[a-zA-Z0-9_\-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
		endTag = /^<\/([\-A-Za-z0-9_]+)[^>]*>/,
		handlebar = /^\{\{([#=!>|{\/])?\s*((?:(?:"[^"]*")|(?:'[^']*')|[^\}])*)\s*(\/?)\}?\}\}/,
		attr = /([\-A-Za-z0-9_]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g,
		HB_TYPE = "hb",
		HTML_TYPE = "html";
		
	// Empty Elements - HTML 4.01
	var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed");

	// Block Elements - HTML 4.01
	var block = makeMap("address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul");

	// Inline Elements - HTML 4.01
	var inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var");

	// Elements that you can, intentionally, leave open
	// (and which close themselves)
	var closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");

	// Attributes that have their values filled in disabled="disabled"
	var fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected");

	// Special Elements (can contain anything)
	var special = makeMap("script,style");


	// HANDLEBARS RULES
	
	// Dictates what parents children must have; state must be a direct descendent of diagram
	var parent_rules = {
		"state": { parent: ["fsm"] },
		"elif": { parent: ["if"] },
		"else": { parent: ["if", "each"] }
	};

	var autoclose_nodes = {
		"elif": {
			when_open_sibling: ["elif", "else"]
		},
		"else": {
			when_close_parent: ["if", "each"]
		},
		"state": {
			when_open_sibling: ["state"]
		}
	};

	// elsif and else must come after either if or elsif
	var sibling_rules = {
		"elif": {
			follows: ["elif"], //what it may follow
			or_parent: ["if"] //or the parent can be 'if'
		},
		"else": {
			follows: ["elif"],
			or_parent: ["if", "each"]
		},
		"state": {
			follows: ["state"],
			or_parent: ["fsm"]
		}
	};

	var parseTemplate = function(input_str, handler) {
		var html_index, hb_index, last_closed_hb_tag, index, chars, match, stack = [], last = input_str;
		stack.last = function(){
			return this[this.length - 1];
		};

		var replace_fn = function(all, text) {
			text = text	.replace(/<!--(.*?)-->/g, "$1")
						.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1");

			if (handler.chars) {
				handler.chars(text);
			}

			return "";
		};

		while (input_str) {
			chars = true;

			// Make sure we're not in a script or style element
			if (!stack.last() || !special[stack.last()]) {
				// Comment
				if (input_str.indexOf("<!--") === 0) {
					index = input_str.indexOf("-->");
	
					if (index >= 0) {
						if (handler.HTMLcomment) {
							handler.HTMLcomment( input_str.substring( 4, index ) );
						}
						input_str = input_str.substring( index + 3 );
						chars = false;
					}
	
				// end tag
				} else if (input_str.indexOf("</") === 0) {
					match = input_str.match(endTag);
	
					if (match) {
						input_str = input_str.substring(match[0].length);
						match[0].replace(endTag, parseEndTag);
						chars = false;
					}
	
				// start tag
				} else if(input_str.indexOf("<") === 0) {
					match = input_str.match(startTag);
	
					if (match) {
						input_str = input_str.substring(match[0].length);
						match[0].replace(startTag, parseStartTag);
						chars = false;
					}
				} else if(input_str.indexOf("{{") === 0) {
					match = input_str.match(handlebar);
					if(match) {
						input_str = input_str.substring(match[0].length);
						match[0].replace(handlebar, parseHandlebar);
						chars = false;
					}
				}

				if(chars) {
					html_index = input_str.indexOf("<");
					hb_index = input_str.indexOf("{{");

					if(html_index < 0) { index = hb_index; }
					else if(hb_index < 0) { index = html_index; }
					else { index = Math.min(html_index, hb_index); }
					
					var text = index < 0 ? input_str : input_str.substring(0, index);
					input_str = index < 0 ? "" : input_str.substring(index);
					
					handler.chars(text);
				}
			} else {
				input_str = input_str.replace(new RegExp("(.*)<\/" + stack.last() + "[^>]*>"), replace_fn);

				parseEndTag("", stack.last());
			}

			if (input_str == last) {
				throw "Parse Error: " + input_str;
			}
			last = input_str;
		}
		
		// Clean up any remaining tags
		parseEndTag();

		function parseStartTag( tag, tagName, rest, unary ) {
			tagName = tagName.toLowerCase();

			if ( block[ tagName ] ) {
				while ( stack.last() && inline[ stack.last() ] ) {
					parseEndTag( "", stack.last() );
				}
			}

			if ( closeSelf[ tagName ] && stack.last() == tagName ) {
				parseEndTag( "", tagName );
			}

			unary = empty[ tagName ] || !!unary;

			if ( !unary ) {
				stack.push({type: HTML_TYPE, tag: tagName});
			}
			
			if (handler.startHTML) {
				var attrs = [];
	
				rest.replace(attr, function(match, name) {
					var value = arguments[2] ? arguments[2] :
						arguments[3] ? arguments[3] :
						arguments[4] ? arguments[4] :
						fillAttrs[name] ? name : "";
					
					attrs.push({
						name: name,
						value: value,
						escaped: value.replace(/(^|[^\\])"/g, '$1\\\"') //"
					});
				});
	
				handler.startHTML(tagName, attrs, unary);
			}
		}

		function parseEndTag(tag, tagName) {
			popStackUntilTag(tagName, HTML_TYPE);
		}
		function getLatestHandlebarParent() {
			var i, stack_i;
			for(i = stack.length - 1; i>= 0; i--) {
				stack_i = stack[i];
				if(stack_i.type === HB_TYPE) {
					return stack_i;
				}
			}
			return undefined;
		}
		function parseHandlebar(tag, prefix, content) {
			var last_stack, tagName, parsed_content = jsep(content);

			if(parsed_content.type === COMPOUND) {
				if(parsed_content.body.length > 0 && parsed_content.body[0].type === IDENTIFIER) {
					tagName = parsed_content.body[0].name;
				}
			} else {
				if(parsed_content.type === IDENTIFIER) {
					tagName = parsed_content.name;
				}
			}

			switch (prefix) {
				case undefined: // unary
					handler.startHB(tagName, parsed_content, true, false);
					break;
				case '{': // literal
					handler.startHB(tagName, parsed_content, true, true);
					break;
				case '>': // partial
					handler.partialHB(tagName, parsed_content);
					break;

				//case '!': // comment
					//var text = tag.replace(/\{\{!(--)?(.*?)(--)?\}\}/g, "$1");
					//handler.HBComment(text);
					//break;
				case '#': // start block
					last_stack = getLatestHandlebarParent();

					if(last_stack && has(autoclose_nodes, last_stack.tag)) {
						var autoclose_node = autoclose_nodes[last_stack.tag];
						if(autoclose_node.when_open_sibling.indexOf(tagName) >= 0) {
							popStackUntilTag(last_stack.tag, HB_TYPE);
							last_stack = getLatestHandlebarParent();
						}
					}

					if(has(parent_rules, tagName)) {
						var parent_rule = parent_rules[tagName];
						if(!last_stack || indexOf(parent_rule.parent, last_stack.tag)<0) {
							throw new Error("'" + tagName + "' must be inside of a '"+parent_rule.parent+"' block");
						}
					}

					if(has(sibling_rules, tagName)) {
						var sibling_rule = sibling_rules[tagName];
						if(sibling_rule.follows.indexOf(last_closed_hb_tag) < 0) {
							if(!sibling_rule.or_parent || sibling_rule.or_parent.indexOf(last_stack.tag) < 0) {
								var error_message = "'" + tagName + "' must follow a '" + sibling_rule.follows[0] + "'";
								if(sibling_rule.or_parent) {
									error_message += " or be inside of a '" + sibling_rule.or_parent[0] + "' tag";
								}
								throw new Error(error_message);
							}
						}
					}

					stack.push({type: HB_TYPE, tag: tagName});
					handler.startHB(tagName, parsed_content, false);
					break;

				case '/': // end block
					popStackUntilTag(tagName, HB_TYPE);
					break;
			}
		}
		function popStackUntilTag(tagName, type) {
			var i, pos, stack_i;
			for (pos = stack.length - 1; pos >= 0; pos -= 1) {
				if(stack[pos].type === type && stack[pos].tag === tagName) {
					break;
				}
			}
			
			if (pos >= 0) {
				// Close all the open elements, up the stack
				for (i = stack.length - 1; i >= pos; i-- ) {
					stack_i = stack[i];
					if(stack_i.type === HB_TYPE) {
						if (handler.endHB) {
							handler.endHB(stack_i.tag);
						}
					} else {
						if (handler.endHTML) {
							handler.endHTML(stack_i.tag);
						}
					}
				}
				
				// Remove the open elements from the stack
				stack.length = pos;
			}

			if(type === HB_TYPE) {
				last_closed_hb_tag = tagName;
			}
		}
	};

	var child_is_dynamic_html		= function(child)	{ return child.isDynamicHTML; },
		child_is_text				= function(child)	{ return child.isText; },
		every_child_is_text			= function(arr)		{ return every(arr, child_is_text); },
		any_child_is_dynamic_html	= function(arr)		{ return indexWhere(arr, child_is_dynamic_html) >= 0; },
		escapeHTML = function (unsafe) {
			return unsafe	.replace(/&/g, "&amp;")	.replace(/</g, "&lt;")
							.replace(/>/g, "&gt;")	.replace(/"/g, "&quot;")
							.replace(/'/g, "&#039;");
		},
		compute_object_property = function(object, prop_node, context, lineage, curr_bindings) {
			return object ? object[prop_node.computed ? get_node_value(prop_node, context, lineage, curr_bindings) : prop_node.name] :
							undefined;
		},
		ELSE_COND = {},
		first_body = function(node) {
			return node.type === COMPOUND ? node.body[0] : node;
		},
		rest_body = function(node) {
			return {type: COMPOUND,
					body: node.type === COMPOUND ? rest(node.body) : [] };
		},
		get_node_value = function(node, context, lineage, curr_bindings) {
			var op, object, call_context, args;
			if(!node) { return; }
			switch(node.type) {
				case THIS_EXP: return last(lineage).this_exp;
				case LITERAL: return node.value;
				case UNARY_EXP:
					op = unary_operators[node.operator];
					return op ? op(get_node_value(node.argument, context, lineage, curr_bindings)) :
								undefined;
				case BINARY_EXP:
				case LOGICAL_EXP:
					op = binary_operators[node.operator];
					return op ? op(get_node_value(node.left, context, lineage, curr_bindings), get_node_value(node.right, context, lineage, curr_bindings)) :
								undefined;
				case IDENTIFIER:
					if(node.name[0] === "@") {
						var name = node.name.slice(1);
						for(var i = lineage.length-1; i>=0; i--) {
							object = lineage[i].at;
							if(object && has(object, name)) {
								return object[name];
							}
						}
						return undefined;
					}
					return cjs.get(context[node.name]);
				case MEMBER_EXP:
					object = get_node_value(node.object, context, lineage, curr_bindings);
					return compute_object_property(object, node.property, context, lineage, curr_bindings);
				case COMPOUND:
					return get_node_value(node.body[0], context, lineage, curr_bindings);
				case CURR_LEVEL_EXP:
					object = last(lineage).this_exp;
					return compute_object_property(object, node.argument, context, lineage, curr_bindings);
				case PARENT_EXP:
					object = (lineage && lineage.length > 1) ? lineage[lineage.length - 2].this_exp : undefined;
					return compute_object_property(object, node.argument, context, lineage, curr_bindings);
				case CALL_EXP:
					if(node.callee.type === MEMBER_EXP) {
						call_context = get_node_value(node.callee.object, context, lineage, curr_bindings);
						object = compute_object_property(call_context, node.callee.property, context, lineage, curr_bindings);
					} else {
						call_context = root;
						object = get_node_value(node.callee, context, lineage, curr_bindings);
					}

					if(object && isFunction(object)) {
						args = map(node['arguments'], function(arg) {
							return get_node_value(arg, context, lineage, curr_bindings);
						});
						return object.apply(call_context, args);
					}
			}
		},
		create_node_constraint = function(node, context, lineage, curr_bindings) {
			var args = arguments;
			if(node.type === LITERAL) {
				return get_node_value.apply(root, args);
			}
			return cjs(function() {
				return get_node_value.apply(root, args);
			});
		},
		get_concatenated_inner_html_constraint = function(children, context, lineage, curr_bindings) {
			return cjs(function() {
				return map(children, function(child) {
					if(child.isDynamicHTML) {
						return cjs.get(context[child.tag]);
					} else if(has(child, "text")) {
						return escapeHTML(child.text);
					} else if(has(child, "tag")) {
						return escapeHTML(cjs.get(context[child.tag]));
					} else {
						var child_val = child.create(context, lineage, curr_bindings);
						return child_val.outerHTML;
					}
				}).join("");
			});
		},
		get_concatenated_children_constraint = function(children, args) {
			return cjs(function() {
						var rv = [];
						each(children, function(child) {
							var c_plural = child.create.apply(child, args);
							if(isArray(c_plural)) {
								rv.push.apply(rv, c_plural);
							} else {
								rv.push(c_plural);
							}
						});
						return rv;
					});
		},
		default_template_create = function(context, parent_dom_node, curr_bindings) {
			var args = [context, [{this_exp: context}], curr_bindings], // context & lineage
				container = parent_dom_node || doc.createElement("span"),
				first_child;
			if(this.children.length === 1 && (first_child = this.children[0]) && first_child.isHTML) {
				return first_child.create.apply(first_child, args);
			}

			if(any_child_is_dynamic_html(this.children)) { // this is where it starts to suck...every child's innerHTML has to be taken and concatenated
				var concatenated_html = get_concatenated_inner_html_constraint(this.children, context);
				curr_bindings.push(concatenated_html, cjs.html(container, concatenated_html));
			} else {
				var children_constraint = get_concatenated_children_constraint(this.children, args);
				curr_bindings.push(children_constraint, cjs.children(container, children_constraint));
			}
			return container;
		},
		hb_regex = /^\{\{([\-A-Za-z0-9_]+)\}\}/,
		get_constraint = function(str, context, lineage, curr_bindings) {
			var has_constraint = false,
				strs = [],
				index, match_val, len, context_val;
			while(str.length > 0) {
				index =  str.indexOf("{");
				if(index < 0) {
					strs.push(str);
					break;
				} else {
					match_val = str.match(hb_regex);
					if(match_val) {
						len = match_val[0].length;
						context_val = context[match_val[1]];
						str = str.substr(len);
						strs.push(context_val);

						if(!has_constraint && (is_constraint(context_val) || is_array(context_val))) {
							has_constraint = true;
						}
					} else {
						strs.push(str.substr(0, index));
						str = str.substr(index);
					}
				}
			}

			if(has_constraint) {
				return cjs(function() {
					return map(strs, function(str) {
						if(is_constraint(str)) {
							return str.get();
						} else if(is_array(str)) {
							return str.join(" ");
						} else {
							return "" + str;
						}
					}).join("");
				});
			} else {
				return strs.join("");
			}
		},
		memoize_dom_elems = function() {
			var memoized_args = [],
				memoized_vals = [];

			return {
				get: function(context, lineage, curr_bindings) {
					var memo_index = indexWhere(memoized_args, function(margs) {
						return margs[0]=== context &&
								margs[1].length === lineage.length &&
								every(margs[1], function(l, i) {
									return l.this_exp === lineage[i].this_exp;
								});
					});
					return memoized_vals[memo_index];
				},
				set: function(context, lineage, curr_bindings, val) {
					memoized_args.push([context, lineage, curr_bindings]);
					memoized_vals.push(val);
				}
			};
		},
		IS_OBJ = {},
		map_aware_array_eq = function(a, b) {
			return a === b || (a && a.is_obj === IS_OBJ && a.key === b.key && a.value === b.value);
		},
		name_regex = /^(data-)?cjs-out$/,
		on_regex = /^(data-)?cjs-on-(\w+)$/,
		create_template = function(template_str) {
			var stack = [{
				children: [],
				create: default_template_create
			}], last_pop = false, has_container = false, condition_stack = [], fsm_stack = [];

			parseTemplate(template_str, {
				startHTML: function(tag, attributes, unary) {
					last_pop = {
						create: function(context, lineage, curr_bindings) {
							var args = arguments,
								element = doc.createElement(tag),
								on_regex_match;

							each(attributes, function(attr) {
								if(attr.name.match(name_regex)) {
									context[attr.value] = cjs.inputValue(element);
								} else if((on_regex_match = attr.name.match(on_regex))) {
									var event_name = on_regex_match[2];
									element.addEventListener(event_name, context[attr.value]);
								} else {
									var constraint = get_constraint(attr.value, context, lineage, curr_bindings);
									if(is_constraint(constraint)) {
										cjs.attr(element, attr.name, constraint);
									} else {
										element.setAttribute(attr.name, constraint);
									}
								}
							});

							if(any_child_is_dynamic_html(this.children)) { // this is where it starts to suck...every child's innerHTML has to be taken and concatenated
								var concatenated_html = get_concatenated_inner_html_constraint(this.children, context, lineage, curr_bindings);
								curr_bindings.push(concatenated_html, cjs.html(element, concatenated_html));
							} else {
								var children_constraint = get_concatenated_children_constraint(this.children, args);
								curr_bindings.push(children_constraint, cjs.children(element, children_constraint));
							}
							return element;
						},
						children: [],
						isHTML: true
					};

					if(stack.length > 0) {
						last(stack).children.push(last_pop);
					}

					if(!unary) {
						stack.push(last_pop);
					}
				},
				endHTML: function(tag) {
					last_pop = stack.pop();
				},
				HTMLcomment: function(str) {
					last_pop = {
						create: function() { return doc.createComment(str); },
						isText: true,
						text: str
					};
					if(stack.length > 0) {
						last(stack).children.push(last_pop);
					}
				},
				chars: function(str) {
					last_pop = {
						create: function() {
							return doc.createTextNode(str);
						},
						isText: true,
						text: str
					};
					if(stack.length > 0) {
						last(stack).children.push(last_pop);
					}
				},
				startHB: function(tag, parsed_content, unary, literal) {
					var memoized_elems, setter_name, type_name, push_onto_children;
					if(unary) {
						if(literal) { type_name = "isDynamicHTML"; setter_name = "html"; }
						else { type_name = "isText"; setter_name = "text"; }
						last_pop = {
							create: function(context, lineage, curr_bindings) {
								var elem = doc.createTextNode(""),
									val = get_node_value(first_body(parsed_content), context, lineage, curr_bindings);
								curr_bindings.push(cjs[setter_name](elem, val));
								return elem;
							},
							tag: tag
						};
						last_pop[type_name] = true;

						if(stack.length > 0) {
							last(stack).children.push(last_pop);
						}
					} else {
						push_onto_children = true;
						if(tag === "each") {
							memoized_elems = memoize_dom_elems();

							last_pop = {
								create: function(context, lineage, curr_bindings) {
									var mvals, mdom, mLastLineage, val_diff, rv = [],
										val = get_node_value(rest_body(parsed_content), context, lineage, curr_bindings),
										memoized_val = memoized_elems.get(context, lineage, curr_bindings);

									if(!isArray(val)) {
										// IS_OBJ provides a way to ensure the user didn't happen to pass in a similarly formatted array
										val = map(val, function(v, k) { return { key: k, value: v, is_obj: IS_OBJ }; });
									} else if(val.length === 0 && this.else_child) {
										val = [ELSE_COND];
									}

									if(memoized_val) {
										mvals = memoized_val.val;
										mdom = memoized_val.dom;
										mLastLineage = memoized_val.lineage;
									} else {
										mvals = [];
										mdom = [];
										mLastLineage = [];
										memoized_elems.set(context, lineage, curr_bindings, {val: val, dom: mdom, lineage: mLastLineage});
									}

									val_diff = get_array_diff(mvals, val, map_aware_array_eq);

									each(val_diff.index_changed, function(ic_info) {
										var lastLineageItem = mLastLineage[ic_info.from];
										if(lastLineageItem && lastLineageItem.at && lastLineageItem.at.index) {
											lastLineageItem.at.index.set(ic_info.to);
										}
									});
									each(val_diff.removed, function(removed_info) {
										var index = removed_info.from,
											lastLineageItem = mLastLineage[index];
										mdom.splice(index, 1);
										if(lastLineageItem && lastLineageItem.at) {
											each(lastLineageItem.at, function(v) {
												v.destroy(true);
											});
										}
									});
									each(val_diff.added, function(added_info) {
										var v = added_info.item,
											index = added_info.to,
											is_else = v === ELSE_COND,
											lastLineageItem = is_else ? false : {this_exp: v, at: ((v && v.is_obj === IS_OBJ) ? {key: cjs(v.key)} : { index: cjs(index)})},
											concated_lineage = is_else ? lineage : lineage.concat(lastLineageItem),
											vals = map(is_else ? this.else_child.children : this.children, function(child) {
												var dom_child = child.create(context, concated_lineage, curr_bindings);
												return dom_child;
											});
										mdom.splice(index, 0, vals);
										mLastLineage.splice(index, 0, lastLineageItem);
									}, this);
									each(val_diff.moved, function(moved_info) {
										var from_index = moved_info.from_index,
											to_index = moved_info.to_index,
											dom_elem = mdom[from_index],
											lastLineageItem = mLastLineage[from_index];

										mdom.splice(from_index, 1);
										mdom.splice(to_index, 0, dom_elem);
										mLastLineage.splice(from_index, 1);
										mLastLineage.splice(to_index, 0, lastLineageItem);
									});

									mvals.splice.apply(mvals, ([0, mvals.length]).concat(val));
									return flatten(mdom, true);
								},
								children: [],
								isEach: true,
								else_child: false 
							};
						} else if(tag === "if" || tag === "unless") {
							memoized_elems = memoize_dom_elems();
							last_pop = {
								create: function(context, lineage, curr_bindings) {
									var memoized_val = memoized_elems.get(context, lineage, curr_bindings),
										len = this.sub_conditions.length,
										cond = !!get_node_value(this.condition, context, lineage, curr_bindings),
										i = -1, children, memo_index;

									if(this.reverse) {
										cond = !cond;
									}

									if(cond) {
										i = 0;
									} else if(len > 0) {
										for(i = 0; i<len; i++) {
											cond = this.sub_conditions[i];

											if(cond.condition === ELSE_COND || get_node_value(cond.condition, context, lineage, curr_bindings)) {
												i++; break;
											}
										}
									}

									if(i < 0) {
										return [];
									} else {
										var memoized_children = memoized_elems.get(context, lineage, curr_bindings);
										if(!memoized_children) {
											memoized_children = [];
											memoized_elems.set(context, lineage, curr_bindings, memoized_children);
										}

										if(!memoized_children[i]) {
											if(i === 0) {
												children = this.children;
											} else {
												children = this.sub_conditions[i-1].children;
											}
											memoized_children[i] = flatten(map(children, function(child) {
												return child.create(context, lineage, curr_bindings);
											}), true);
										}

										return memoized_children[i];
									}
								},
								children: [],
								sub_conditions: [],
								condition: rest_body(parsed_content),
								reverse: tag === "unless"
							};

							condition_stack.push(last_pop);
						} else if(tag === "elif" || tag === "else") {
							last_pop = {
								children: [],
								condition: tag === "else" ? ELSE_COND : rest_body(parsed_content)
							};
							var last_stack = last(stack);
							if(last_stack.isEach) {
								last_stack.else_child = last_pop;
							} else {
								last(condition_stack).sub_conditions.push(last_pop);
							}
							push_onto_children = false;
						} else if(tag === "fsm") {
							memoized_elems = memoize_dom_elems();
							var fsm_target = rest_body(parsed_content);
							last_pop = {
								create: function(context, lineage, curr_bindings) {
									var fsm = get_node_value(fsm_target, context, lineage, curr_bindings),
										state = fsm.getState(),
										do_child_create = function(child) {
											return child.create(context, lineage, curr_bindings);
										}, state_name, memoized_children;
									if(!lineage) {
										lineage = [];
									}
									for(state_name in this.sub_states) {
										if(this.sub_states.hasOwnProperty(state_name)) {
											if(state === state_name) {
												memoized_children = memoized_elems.get(context, lineage, curr_bindings);
												if(!memoized_children) {
													memoized_children = {};
													memoized_elems.set(context, lineage, curr_bindings, memoized_children);
												}

												if(!has(memoized_children, state_name)) {
													memoized_children[state_name] = map(this.sub_states[state_name].children, do_child_create);
												}
												return memoized_children[state_name];
											}
										}
									}
									return [];
								},
								children: [],
								sub_states: {}
							};
							fsm_stack.push(last_pop);
						} else if(tag === "state") {
							if(parsed_content.body.length > 1) {
								var state_name = parsed_content.body[1].name;
								last_pop = { children: [] };
								last(fsm_stack).sub_states[state_name] = last_pop;
								push_onto_children = false;
							}
						} else if(tag === "with") {
							last_pop = {
								create: function(context, lineage, curr_bindings) {
									var new_context = get_node_value(rest_body(parsed_content), context, lineage, curr_bindings),
										concatenated_lineage = lineage.concat({this_exp: new_context});
									return map(this.children, function(child) {
										return child.create(new_context, concatenated_lineage, curr_bindings);
									});
								},
								children: []
							};
						} else {
							return;
						}

						if(push_onto_children && stack.length > 0) {
							last(stack).children.push(last_pop);
						}
						stack.push(last_pop);
					}
				},
				endHB: function(tag) {
					if(tag === "if" || tag === "unless") {
						condition_stack.pop();
					} else if(tag === "fsm") {
						fsm_stack.pop();
					}
					stack.pop();
				},
				partialHB: function(tagName, parsed_content) {
					var partial = partials[tagName];
					if(partial) {
						last_pop = {
							create: function(context, lineage, curr_bindings) {
								var new_context = get_node_value(rest_body(parsed_content), context, lineage, curr_bindings);
								return partial(new_context);
							}
						};

						if(stack.length > 0) {
							last(stack).children.push(last_pop);
						}
					}
				}
			});
			return stack.pop();
		},
		memoized_template_nodes = [],
		memoized_template_bindings = [],
		template_strs = [],
		template_values = [],
		partials = {},
		isPolyDOM = function(x) {
			return is_jquery_obj(x) || isNList(x) || isAnyElement(x);
		},
		getFirstDOMChild = function(x) {
			if(is_jquery_obj(x) || isNList(x))	{ return x[0]; }
			else if(isAnyElement(x))			{ return x; }
			else								{ return false; }
		},
		memoize_template = function(context, parent_dom_node) {
			var template = this,
				curr_bindings = [],
				dom_node = template.create(context, parent_dom_node, curr_bindings);
			memoized_template_nodes.push(dom_node);
			memoized_template_bindings.push(curr_bindings);
			return dom_node;
		},
		get_template_bindings = function(dom_node) {
			var nodeIndex = indexOf(memoized_template_nodes, dom_node);
			return nodeIndex >= 0 ? memoized_template_bindings[nodeIndex] : false;
		};

	var createTemplate = function(template_str) {
			if(!isString(template_str)) {
				if(is_jquery_obj(template_str) || isNList(template_str)) {
					template_str = template_str.length > 0 ? template_str[0].innerText : "";
				} else if(isElement(template_str)) {
					template_str = template_str.innerText;
				} else {
					template_str = "" + template_str;
				}
			}

			var template, template_index = indexOf(template_strs, template_str);
			if(template_index < 0) {
				template = create_template(template_str);
				template_strs.push(template_str);
				template_values.push(template);
			} else {
				template = template_values[template_index];
			}

			if(arguments.length >= 2) { // Create and use the template immediately
				return memoize_template.apply(template, rest(arguments));
			} else { // create the template as a function that can be called with a context
				return bind(memoize_template, template);
			}
		};
	cjs.createTemplate = cjs.template = createTemplate;
	cjs.registerPartial = function(name, value) { partials[name] = value; };
	cjs.unregisterPartial = function(name, value) { delete partials[name]; };
	cjs.destroyTemplate = function(dom_node) {
		var nodeIndex = indexOf(memoized_template_nodes, dom_node);
		if(nodeIndex >= 0) {
			var bindings = memoized_template_bindings[nodeIndex];
			memoized_template_nodes.splice(nodeIndex, 1);
			memoized_template_bindings.splice(nodeIndex, 1);
			each(bindings, function(binding) { binding.destroy(); });
			return true;
		}
		return false;
	};
	cjs.pauseTemplate = function(dom_node) {
		var bindings = get_template_bindings(dom_node);
		each(bindings, function(binding) { if(has(binding, "pause")) { binding.pause(); } });
		return !!bindings;
	};
	cjs.resumeTemplate = function(dom_node) {
		var bindings = get_template_bindings(dom_node);
		each(get_template_bindings(dom_node), function(binding) { if(has(binding, "resume")) { binding.resume(); } });
		return !!bindings;
	};

var COMPOUND = 'Compound',
	IDENTIFIER = 'Identifier',
	MEMBER_EXP = 'MemberExpression',
	LITERAL = 'Literal',
	THIS_EXP = 'ThisExpression',
	CALL_EXP = 'CallExpression',
	UNARY_EXP = 'UnaryExpression',
	BINARY_EXP = 'BinaryExpression',
	LOGICAL_EXP = 'LogicalExpression',
	PARENT_EXP = 'ParentExpression',
	CURR_LEVEL_EXP = 'CurrLevelExpression',
	jsep = (function (root) {
		var unary_ops = keys(unary_operators),
			binary_ops = keys(binary_operators),
			binary_op_len = binary_ops.length,
			literals = {
				'true': true,
				'false': false,
				'null': null
			},
			this_str = 'this',
			extend = function(base_obj, extension_obj) {
				for (var prop in extension_obj) {
					if(extension_obj.hasOwnProperty(prop)) {
						base_obj[prop] = extension_obj[prop];
					}
				}
				return base_obj;
			},
			binaryPrecedence = function(op_val) {
				// Taken from the esprima parser's function
				switch (op_val) {
					case '||': return 1;
					case '&&': return 2;
					case '|': return 3;
					case '^': return 4;
					case '&': return 5;
					case '==': case '!=': case '===': case '!==': return 6;
					case '<': case '>': case '<=': case '>=': return 7;
					case '<<': case '>>': case '>>>': return 8;
					case '+': case '-': return 9;
					case '*': case '/': case '%': return 11;
				}
				return 0;
			},
			createBinaryExpression = function (operator, left, right) {
				var type = (operator === '||' || operator === '&&') ? LOGICAL_EXP : BINARY_EXP;
				return {
					type: type,
					operator: operator,
					left: left,
					right: right
				};
			},
			// ch is a character code
			isDecimalDigit = function(ch) {
				return	(ch >= 48 && ch <= 57);   // 0..9
			},
			isIdentifierStart = function(ch) {
				return	(ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
						(ch === 64) || // @
						(ch >= 65 && ch <= 90) ||     // A..Z
						(ch >= 97 && ch <= 122);      // a..z
			},
			isIdentifierPart = function(ch) {
				return	(ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
						(ch >= 65 && ch <= 90) ||         // A..Z
						(ch >= 97 && ch <= 122) ||        // a..z
						(ch >= 48 && ch <= 57);           // 0..9
			},
			DONE = {},


			start_str_regex = new RegExp('^[\'"]'),
			number_regex = new RegExp('^(\\d+(\\.\\d+)?)'),

			do_parse = function(expr) {
				var stack = [],
					index = 0,
					length = expr.length,

					gobbleExpression = function() {
						var nodes = [], ch_i, node;
						while(index < length) {
							ch_i = expr[index];

							if(ch_i === ';' || ch_i ===',') {
								index++; // ignore seperators
							} else {
								if((node = gobbleBinaryExpression())) {
									nodes.push(node);
								} else if(index < length) {
									throw new Error("Unexpected '"+expr[index]+"' at character " + index);
								}
							}
						}

						if(nodes.length === 1) {
							return nodes[0];
						} else {
							return {
								type: COMPOUND,
								body: nodes
							};
						}
					},

					gobbleBinaryOp = function() {
						var biop, i, j, op_len;
						gobbleSpaces();
						outer: for(i = 0; i<binary_op_len; i++) {
							biop = binary_ops[i];
							op_len = biop.length;
							for(j = 0; j<op_len; j++) {
								if(biop[j] !== expr[index + j]) {
									continue outer;
								}
							}
							index += op_len;
							return biop;
						}
						return false;
					},


					gobbleBinaryExpression = function() {
						var ch_i, node, biop, prec, stack, biop_info, left, right, i;

						left = gobbleToken();
						biop = gobbleBinaryOp();
						prec = binaryPrecedence(biop);

						if(prec === 0) {
							return left;
						}

						biop_info = { value: biop, prec: prec};

						right = gobbleToken();
						if(!right) {
							throw new Error("Expected expression after " + biop + " at character " + index);
						}
						stack = [left, biop_info, right];

						while((biop = gobbleBinaryOp())) {
							prec = binaryPrecedence(biop);

							if(prec === 0) {
								break;
							}
							biop_info = { value: biop, prec: prec };

							// Reduce: make a binary expression from the three topmost entries.
							while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
								right = stack.pop();
								biop = stack.pop().value;
								left = stack.pop();
								node = createBinaryExpression(biop, left, right);
								stack.push(node);
							}

							node = gobbleToken();
							if(!node) {
								throw new Error("Expected expression after " + biop + " at character " + index);
							}
							stack.push(biop_info);
							stack.push(node);
						}

						i = stack.length - 1;
						node = stack[i];
						while(i > 1) {
							node = createBinaryExpression(stack[i - 1].value, stack[i - 2], node); 
							i -= 2;
						}

						return node;
					},

					gobbleToken = function() {
						var ch, curr_node, op_index;
						
						gobbleSpaces();
						ch = expr.charCodeAt(index);
						if(ch === 46 && expr.charCodeAt(index+1) === 47) {
							index += 2;
							return {
								type: CURR_LEVEL_EXP,
								argument: gobbleToken()
							};
						} else if(ch === 46 && expr.charCodeAt(index+1) === 46 && expr.charCodeAt(index+2) === 47) {
							index += 3;
							return {
								type: PARENT_EXP,
								argument: gobbleToken()
							};
						}
						
						if(isDecimalDigit(ch) || ch === 46) {
							// Char code 46 is a dot (.)
							return gobbleNumericLiteral();
						} else if(ch === 39 || ch === 34) {
							// Single or double quotes (' or ")
							return gobbleStringLiteral();
						} else if(isIdentifierStart(ch)) {
							return gobbleVariable();
						} else if((op_index = unary_ops.indexOf(ch)) >= 0) {
							index++;
							return {
								type: UNARY_EXP,
								operator: unary_ops[op_index],
								argument: gobbleToken(),
								prefix: true
							};
						} else if(ch === 40) {
							// Open parentheses
							index++;
							return gobbleGroup();
						} else {
							return false;
						}
					},

					gobbleSpaces = function() {
						var ch = expr.charCodeAt(index);
						// space or tab
						while(ch === 32 || ch === 9) {
							ch = expr.charCodeAt(++index);
						}
					},

					gobbleNumericLiteral = function() {
						var number = '';
						while(isDecimalDigit(expr.charCodeAt(index))) {
							number += expr[index++];
						}

						if(expr[index] === '.') {
							number += expr[index++];

							while(isDecimalDigit(expr.charCodeAt(index))) {
								number += expr[index++];
							}
						}

						return {
							type: LITERAL,
							value: parseFloat(number),
							raw: number
						};
					},

					gobbleStringLiteral = function() {
						var str = '', quote = expr[index++], closed = false, ch;

						while(index < length) {
							ch = expr[index++];
							if(ch === quote) {
								closed = true;
								break;
							} else if(ch === '\\') {
								ch = expr[index++];
								switch(ch) {
									case 'n': str += '\n'; break;
									case 'r': str += '\r'; break;
									case 't': str += '\t'; break;
									case 'b': str += '\b'; break;
									case 'f': str += '\f'; break;
									case 'v': str += '\x0B'; break;
								}
							} else {
								str += ch;
							}
						}

						if(!closed) {
							throw new Error('Unclosed quote after "'+str+'"');
						}

						return {
							type: LITERAL,
							value: str,
							raw: quote + str + quote
						};
					},
					
					gobbleIdentifier = function() {
						var ch = expr.charCodeAt(index), start = index, identifier;

						if(isIdentifierStart(ch)) {
							index++;
						}

						while(index < length) {
							ch = expr.charCodeAt(index);
							if(isIdentifierPart(ch)) {
								index++;
							} else {
								break;
							}
						}
						identifier = expr.slice(start, index);

						if(literals.hasOwnProperty(identifier)) {
							return {
								type: LITERAL,
								value: literals[identifier],
								raw: identifier
							};
						} else if(identifier === this_str) {
							return { type: THIS_EXP };
						} else {
							return {
								type: IDENTIFIER,
								name: identifier
							};
						}
					},

					gobbleArguments = function() {
						var ch_i, args = [], node;
						while(index < length) {
							gobbleSpaces();
							ch_i = expr[index];
							if(ch_i === ')') {
								index++;
								break;
							} else if (ch_i === ',') {
								index++;
							} else {
								node = gobbleBinaryExpression();
								if(!node || node.type === COMPOUND) {
									throw new Error('Expected comma at character ' + index);
								}
								args.push(node);
							}
						}
						return args;
					},

					gobbleVariable = function() {
						var ch_i, node, old_index;
						node = gobbleIdentifier();
						ch_i = expr[index];
						while(ch_i === '.' || ch_i === '[' || ch_i === '(') {
							if(ch_i === '.') {
								index++;
								node = {
									type: MEMBER_EXP,
									computed: false,
									object: node,
									property: gobbleIdentifier()
								};
							} else if(ch_i === '[') {
								old_index = index;
								index++;
								node = {
									type: MEMBER_EXP,
									computed: true,
									object: node,
									property: gobbleBinaryExpression()
								};
								gobbleSpaces();
								ch_i = expr[index];
								if(ch_i !== ']') {
									throw new Error('Unclosed [ at character ' + index);
								}
								index++;
							} else if(ch_i === '(') {
								index++;
								node = {
									type: CALL_EXP,
									'arguments': gobbleArguments(),
									callee: node
								};
							}
							ch_i = expr[index];
						}
						return node;
					},

					gobbleGroup = function() {
						var node = gobbleBinaryExpression();
						gobbleSpaces();
						if(expr[index] === ')') {
							index++;
							return node;
						} else {
							throw new Error('Unclosed ( at character ' + index);
						}
					};

				return gobbleExpression();
			};
		return do_parse;
	}(this));

	return cjs;
}(this));

// Export for node
if (typeof module !== 'undefined' && module.exports) {
	module.exports = cjs;
}
