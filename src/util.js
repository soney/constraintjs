/*jslint eqnull: true */

// Utility functions
// -----------------

// Many of the functions here are from http://underscorejs.org/
// Save bytes in the minified (but not gzipped) version:
var ArrayProto = Array.prototype, ObjProto = Object.prototype,
	FuncProto = Function.prototype, StringProto = String.prototype;

// Create quick reference variables for speed access to core prototypes.
var slice         = ArrayProto.slice,
	toString      = ObjProto.toString,
	concat        = ArrayProto.concat,
	push          = ArrayProto.push;

// All **ECMAScript 5** native function implementations that we hope to use
// are declared here.
var nativeSome    = ArrayProto.some,
	nativeIndexOf = ArrayProto.indexOf,
	nativeLastIndexOf = ArrayProto.lastIndexOf,
	nativeEvery   = ArrayProto.every,
	nativeForEach = ArrayProto.forEach,
	nativeKeys    = Object.keys,
	nativeFilter  = ArrayProto.filter,
	nativeReduce  = ArrayProto.reduce,
	nativeMap     = ArrayProto.map,
	nativeTrim    = StringProto.trim;

//Bind a function to a context
var bind = function (func, context) { return function () { return func.apply(context, arguments); }; },
	bindArgs = function(func) { var args = rest(arguments, 1); return function() { return func.apply(this, args); }; },
	trim = function(str){
		return nativeTrim ? nativeTrim.call(str) : String(str).replace(/^\s+|\s+$/g, '');
    },
	doc	= root.document,
	sTO = function(a,b) { return root.setTimeout(a,b); },
	cTO = function(a,b) { return root.clearTimeout(a,b); },
	// Binary and unary operators will be used for constraint modifiers and for templates,
	// which allow these operators to be used in constraints
	unary_operators = { "+": function (a) { return +a; }, "-": function (a) { return -a; },
						"~": function (a) { return ~a; }, "!": function (a) { return !a; }
	},
	binary_operators = {"===": function (a, b) { return a === b;}, "!==":function (a, b) { return a !== b; },
						"==":  function (a, b) { return a == b; }, "!=": function (a, b) { return a != b; },
						">":   function (a, b) { return a > b;  }, ">=": function (a, b) { return a >= b; },
						"<":   function (a, b) { return a < b;  }, "<=": function (a, b) { return a <= b; },
						"+":   function (a, b) { return a + b;  }, "-":  function (a, b) { return a - b; },
						"*":   function (a, b) { return a * b;  }, "/":  function (a, b) { return a / b; },
						"%":   function (a, b) { return a % b;  }, "^":  function (a, b) { return a ^ b; },
						"&&":  function (a, b) { return a && b; }, "||": function (a, b) { return a || b; },
						"&":   function (a, b) { return a & b;  }, "|":  function (a, b) { return a | b; },
						"<<":  function (a, b) { return a << b; }, ">>": function (a, b) { return a >> b; },
						">>>": function (a, b) { return a >>> b;}
	};


var getTextContent, setTextContent;
if(doc && !('textContent' in doc.createElement('div'))) {
	getTextContent = function(node) {
		return node && node.nodeType === 3 ? node.nodeValue : node.innerText;
	};
	setTextContent = function(node, val) {
		if(node && node.nodeType === 3) {
			node.nodeValue = val;
		} else {
			node.innerText = val;
		}
	};
} else {
	getTextContent = function(node) { return node.textContent; };
	setTextContent = function(node, val) { node.textContent = val; };
}

var aEL = function(node, type, callback) {
	if(node.addEventListener) {
		node.addEventListener(type, callback);
	} else {
		node.attachEvent("on"+type, callback);
	}
}, rEL = function(node, type, callback) {
	if(node.removeEventListener) {
		node.removeEventListener(type, callback);
	} else {
		node.detachEvent("on"+type, callback);
	}
};

// Establish the object that gets returned to break out of a loop iteration.
var breaker = {};

// Creating a unique id for constraints allows for quicker referencing
var uniqueId = (function () {
	var id = 0;
	return function () { return id++; };
}());

// Create a (shallow-cloned) duplicate of an object.
var clone = function(obj) {
	if (!isObject(obj)) { return obj; }
	return isArray(obj) ? obj.slice() : extend({}, obj);
};

// Returns the keys of an object
var keys = nativeKeys || function (obj) {
	if (obj !== Object(obj)) { throw new TypeError('Invalid object'); }
	var keys = [], key, len = 0;
	for (key in obj) {
		if (hOP.call(obj, key)) {
			keys[len++] = key;
		}
	}
	return keys;
};

// Get the last element of an array. Passing **n** will return the last N
// values in the array.
var last = function(array, n) {
	if (!array) {
		return void 0;
	} else if (n===undefined) {
		return array[array.length - 1];
	} else {
		return slice.call(array, Math.max(array.length - n, 0));
	}
};

// Determine if at least one element in the object matches a truth test.
// Delegates to **ECMAScript 5**'s native `some` if available.
var any = function(obj, iterator, context) {
	var result = false;
	if (!obj) { return result; }
	if (nativeSome && obj.some === nativeSome) { return obj.some(iterator, context); }
	each(obj, function(value, index, list) {
		if (result || (result = iterator.call(context, value, index, list))) { return breaker; }
	});
	return !!result;
};

// Returns everything but the first entry of the array.
// Especially useful on the arguments object. Passing an **n** will return
// the rest N values in the array.
var rest = function(array, n) {
	return slice.call(array, n === undefined ? 1 : n);
};

// Trim out all falsy values from an array.
var compact = function(array) {
	return filter(array, identity);
};

// Determine whether all of the elements match a truth test.
// Delegates to **ECMAScript 5**'s native `every` if available.
var every = function(obj, iterator, context) {
	iterator = iterator || identity;
	var result = true;
	if (!obj) {
		return result;
	} else if (nativeEvery && obj.every === nativeEvery) {
		return obj.every(iterator, context);
	} else {
		each(obj, function(value, index, list) {
			if (!(result = result && iterator.call(context, value, index, list))) {
				return breaker;
			}
		});
		return !!result;
	}
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

// Is a given value a number?
var isNumber = function (obj) {
		return toString.call(obj) === '[object Number]';
	},
	// Is a given value an array?
	// Delegates to ECMA5's native Array.isArray
	isArray = Array.isArray || function (obj) {
		return toString.call(obj) === '[object Array]';
	},
	// Is a given value a function?
	isFunction = function (obj) {
		return toString.call(obj) === '[object Function]';
	},
	// Is the given value a String?
	isString = function (obj) {
		return toString.call(obj) === '[object String]';
	},
	// Is a given variable an object?
	isObject = function (obj) {
		return obj === Object(obj);
	},
	// Is a given value a DOM element?
	isElement = function(obj) {
		return !!(obj && obj.nodeType === 1);
	},
	// Any element of any type?
	isAnyElement = function(obj) {
		return !!(obj && (obj.nodeType > 0));
	},
	// Is a given variable an arguments object?
	isArguments = function (obj) {
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

// `hasOwnProperty` proxy, useful if you don't know if obj is null or not
var hOP = ObjProto.hasOwnProperty,
	has = function (obj, key) {
		return hOP.call(obj, key);
	},
	hasAny = function(obj) {
		return any(rest(arguments), function(x) { return has(obj, x); });
	};

// Run through each element and calls `iterator` where `this` === `context`

var each = function(obj, iterator, context) {
	var i, length;
	if (!obj) { return; }
	if (nativeForEach && obj.forEach === nativeForEach) {
		obj.forEach(iterator, context);
	} else if (obj.length === +obj.length) {
		i=0; length = obj.length;
		for (; i < length; i++) {
			if (iterator.call(context, obj[i], i, obj) === breaker) return;
		}
	} else {
		var kys = keys(obj);
		i=0; length = kys.length;
		
		for (; i < length; i++) {
			if (iterator.call(context, obj[kys[i]], kys[i], obj) === breaker) return;
		}
	}
	return obj;
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
var filter = function(obj, iterator, context) {
	var results = [];
	if (!obj) { return results; }
	if (nativeFilter && obj.filter === nativeFilter) { return obj.filter(iterator, context); }
	each(obj, function(value, index, list) {
		if (iterator.call(context, value, index, list)) { results.push(value); }
	});
	return results;
};

// Extend a given object with all the properties in passed-in object(s).
var extend = function (obj) {
	each(slice.call(arguments, 1), function(source) {
		if (source) {
			for (var prop in source) {
				if(source.hasOwnProperty(prop)) {
					obj[prop] = source[prop];
				}
			}
		}
	});
	return obj;
};
	
// Return the first item in arr where test is true
var indexWhere = function (arr, test, start_index) {
		var i, len = arr.length;
		for (i = start_index || 0; i < len; i++) {
			if (test(arr[i], i)) { return i; }
		}
		return -1;
	},
	lastIndexWhere = function(arr, test) {
		var i, len = arr.length;
		for (i = len-1; i >= 0; i--) {
			if (test(arr[i], i)) { return i; }
		}
		return -1;
	};

// The default equality check function
var eqeqeq = function (a, b) { return a === b; };

// Return the first item in arr equal to item (where equality is defined in equality_check)
var indexOf = function (arr, item, start_index, equality_check) {
		if(!equality_check && !start_index && nativeIndexOf && arr.indexOf === nativeIndexOf) {
			return arr.indexOf(item);
		} else {
			equality_check = equality_check || eqeqeq;
			return indexWhere(arr, function (x) { return equality_check(item, x); }, start_index);
		}
	}, lastIndexOf = function(arr, item, equality_check) {
		if(nativeLastIndexOf && arr.lastIndexOf === nativeLastIndexOf) {
			return arr.lastIndexOf(item);
		} else {
			equality_check = equality_check || eqeqeq;
			return lastIndexWhere(arr, function (x) { return equality_check(item, x); });
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

var sparse_indexof = function(arr,item,start_index,equals) {
	//indexOf is wonky with sparse arrays
	var i = start_index,len = arr.length;
	while(i<len) {
		if(equals(arr[i], item)) {
			return i;
		}
		i++;
	}
	return -1;
},
popsym = function (index, x, y, symbols, r, n, equality_check) {
	// Longest common subsequence between two arrays, based on
	// the [rosetta code implementation](http://rosettacode.org/wiki/Longest_common_subsequence#JavaScript)
		var s = x[index],
			pos = symbols[s] + 1;
		pos = sparse_indexof(y, s, pos > r ? pos : r, equality_check || eqeqeq);
		if (pos < 0) { pos = n; }
		symbols[s] = pos;
		return pos;
	},
	indexed_lcs = function (x, y, equality_check) {
		var symbols = {}, r = 0, p = 0, p1, L = 0, idx, i,
			m = x.length, n = y.length, S = new Array(m < n ? n : m);
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

// "Subtracts" `y` from `x` (takes `x-y`) and returns a list of items in `x` that aren't in `y`
var diff = function (x, y, equality_check) {
	var i, j, xi,
		y_clone = clone(y),
		x_len = x.length,
		y_len = y.length,
		diff = [],
		diff_len = 0;

	// If there aren't any items, then the difference is the same as `x`.
	// not bothering to return a clone here because diff is private none of my code
	// modifies the return value
	if(y_len === 0 || x_len === 0) {
		return x;
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

// Returns the items that are in both x and y, but also accounts for the count of equivalent items (as defined by equality_check)
// Examples:
// `x = [1,2,2,3]`, `y = [1,2,4]` -> `[1,2]`;
// `x = [1,1,1]`,   `y = [1,1]`   -> `[1,1]`
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

// Utility functions for `array_source_map`
var get_index_moved = function(info) {
		var item = info[1].item;
		return {item: item, from: info[0].index, to: info[1].index, from_item: info[0].item, to_item: item};
	}, 
	add_indicies = function(arr) {
		// suppose you have array `arr` defined by:
		// arr = []; arr[10] = 'hi';
		// Looping through arr with arr.forEach (or cjs's map) would only produce the 10th item.
		// this function is declared to make sure every item is looped through
		var i = 0, len = arr.length, rv = [];
		while(i<len) {
			rv[i] = {item: arr[i], index: i};
			i++;
		}
		return rv;
	},
	add_from_to_indicies = function(info) {
		return {item: info.item, from: info.indicies[0], to: info.indicies[1]};
	},
	get_index = function(x) { return x.index; },
	get_to = function(x) { return x.to; },
	add_from_and_from_item = function(x) {
		return { from: x.index, from_item: x.item };
	};

// Get where every item came from and went to and return that map
var array_source_map = function (from, to, equality_check) {
	var eq = equality_check || eqeqeq,
		item_aware_equality_check = function (a, b) { return eq(a ? a.item : a, b ? b.item : b); },
		indexed_from = add_indicies(from),
		indexed_to = add_indicies(to),
		indexed_common_subsequence = map(indexed_lcs(from, to), add_from_to_indicies),
		indexed_removed = diff(indexed_from, indexed_common_subsequence, item_aware_equality_check),
		indexed_added = diff(indexed_to, indexed_common_subsequence, item_aware_equality_check),
		indexed_moved = map(dualized_intersection(indexed_removed, indexed_added, item_aware_equality_check), get_index_moved);

	indexed_added = diff(indexed_added, indexed_moved, item_aware_equality_check);
	indexed_removed = diff(indexed_removed, indexed_moved, item_aware_equality_check);

	var added_indicies = map(indexed_added, get_index),
		moved_indicies = map(indexed_moved, get_to),
		ics_indicies = map(indexed_common_subsequence, get_to),
		to_mappings = [],
		i = 0, len = to.length, info, info_index, item;
	while(i<len) {
		item = to[i];
		// Added items
		if ((info_index = indexOf(added_indicies, i)) >= 0) {
			info = indexed_added[info_index];
			to_mappings[i] = { to: i, to_item: item, item: item };
		} else if ((info_index = indexOf(moved_indicies, i)) >= 0) {
			info = indexed_moved[info_index];
			to_mappings[i] = { to: i, to_item: item, item: item, from: info.from, from_item: info.from_item };
		} else if ((info_index = indexOf(ics_indicies, i)) >= 0) {
			info = indexed_common_subsequence[info_index];
			to_mappings[i] = { to: i, to_item: item, item: item, from: info.from, from_item: from[info.from] };
		}
		i++;
	}

	return to_mappings.concat(map(indexed_removed, add_from_and_from_item));
};

// These utility functions help compute the array diff (without having to re-declare them every time get_array_diff is called
var has_from = function(x) { return x.hasOwnProperty("from"); },
	not_has_from = function(x) { return !has_from(x); },
	has_to = function(x) { return x.hasOwnProperty("to"); },
	not_has_to = function(x) { return !has_to(x); },
	has_from_and_to = function(x) { return has_from(x) && has_to(x); },
	unequal_from_to = function(x) { return has_from_and_to(x) && x.from !== x.to; },
	sort_by_from_fn = function(a, b) {
		// This is equivalent to (but faster than):

		//     if (a_has_from && b_has_from) { return a.from - b.from; }
		//     else if (a_has_from && !b_has_from) { return -1; }
		//     else if (!a_has_from && b_has_from) { return 1; }
		//     else { return 0; }
		var a_has_from = has_from(a), b_has_from = has_from(b);
		return a_has_from && b_has_from ? a.from - b.from : b_has_from - a_has_from;
	};

/**
 *
 * `arrayDiff` returns an object with attributes:
 * `removed`, `added`, and `moved`.
 * Every item in `removed` has the format: `{item, index}`
 * Every item in `added` has the format: `{item, index}`
 * Every item in `moved` has the format: `{from_index, to_index}`
 * Every item in `index_changed` has the format: `{from_index, to_index}`
 *
 * When `oldArray` removes every item in `removed`, adds every item in `added`,
 * and moves every item in `moved` (in that order), it will result in an array
 * that is equivalent to `newArray`. Note: this function is used internally to
 * determine how to keep DOM nodes in sync with an underlying model with the
 * smallest number of modifications to the DOM tree.
 *
 * @method cjs.arrayDiff
 * @param {array[*]} from_val - The 'former' array
 * @param {array[*]} to_val - The 'new' array
 * @param {function} [equality_check] - A function that checks for equality between items
 * @return {Object} - added, removed, and moved items
 *
 * @example Taking the diff between `old_array` and `new_array` with the default equality check
 *
 *     var old_array = ['a','b','c'],
 *         new_array = ['c','b','d'],
 *         diff = cjs.arrayDiff(old_array, new_array);
 *		
 *     // diff === {
 *     //   added: [ { item: 'd', to: 2, to_item: 'd' } ],
 *     //   removed: [ { from: 0, from_item: 'a' } ],
 *     //   moved: [ { item: 'c', from: 2, insert_at: 0, move_from: 1, to: 0 } ],
 *     //   index_changed: [ { from: 2, from_item: 'c', item: 'c', to: 0, to_item: 'c' } ]
 *     // }
 *		
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
