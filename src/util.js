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
