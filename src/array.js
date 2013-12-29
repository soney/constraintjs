// Array Constraints
// -----------------

var isPositiveInteger = function (val) {
	return isNumber(val) && Math.round(val) === val && val >= 0;
};

/**
 * ***Note:*** The preferred constructor for arrays is `cjs.array`
 *
 * This class is meant to emulate standard arrays, but with constraints
 * It contains many of the standard array functions (push, pop, slice, etc)
 * and makes them constraint-enabled.
 *
 *     x[1] = y[2] + z[3] === x.item(1, y.item(2) + z.item(3))
 *
 * Options:
 *
 * - `equals`: the function to check if two values are equal, *default:* `===`
 * - `value`: an array for the initial value of this constraint
 *
 * @class cjs.ArrayConstraint
 * @classdesc A class that adds constraint to arrays
 * @param {Object} [options] - A set of options to control how the array constraint is evaluated
 *
 * @see cjs
 * @see cjs.array
 */
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
	/**
	 * Any iterator in forEach can return this object to break out of its loop.
	 * @property {object} cjs.ArrayConstraint.BREAK
	 */
	my.BREAK = {};

	/** @lends cjs.ArrayConstraint.prototype */


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
		return val;
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


	/**
	 * Change the equality check; useful for indexOf
	 *
	 * @method setEqualityCheck
	 * @param {function} equality_check - A new function to check for equality between two items in this array
	 * @return {cjs.ArrayConstraint} `this`
	 */
	proto.setEqualityCheck = function (equality_check) {
		this.$equality_check.set(equality_check);
		return this;
	};

	/**
	 * The forEach() method executes a provided function once per array element.
	 * 
	 * @method forEach
	 * @param {function} callback - Function to execute for each element.
	 * @param {*} thisArg - Object to use as `this` when executing `callback`.
	 * @return {cjs.ArrayConstraint} `this`
	 * @example
	 *     var arr = cjs(['a','b','c']);
	 *     arr.forEach(function(val, i) {
	 *         console.log(val);
	 *         if(i === 1) {
	 *             return cjs.ArrayConstraint.BREAK;
	 *         }
	 *     }); // 'a' ... 'b'
	 */
	proto.forEach = function (callback, thisArg) {
		var i, len = this.length();
		thisArg = thisArg || root; // Set thisArg to window if not specified
		for (i = 0; i < len; i += 1) {
			if (callback.call(thisArg, _get(this, i), i) === my.BREAK) { // "break" equivalent
				return this;
			}
		}
		return this;
	};

	/**
	 *  The map() method creates a new array (not array constraint) with the results of calling a provided
	 *  function on every element in this array.
	 * 
	 * @method map
	 * @param {function} callback - Function that produces an element of the new Array from an element of the current one.
	 * @param {*} thisArg - Object to use as `this` when executing `callback`.
	 * @return {array} - The result of calling `callback` on every element
	 * @example
	 *     var arr = cjs([1,2,3]);
	 *     arr.map(function(x) { return x+1;}) // [2,3,4]
	 */
	proto.map = function (callback, thisArg) {
		var rv = [];
		thisArg = thisArg || root;
		this.forEach(function(val, i) {
			rv[i] = callback.call(thisArg, val, i);
		});
		return rv;
	};

	/**
	 * Replaces the whole array
	 *
	 * @method setValue
	 * @param {array} arr - The new value
	 * @return {cjs.ArrayConstraint} - `this`
	 * @example
	 *     var arr = cjs([1,2,3]);
	 *     arr.toArray(); //[1,2,3]
	 *     arr.setValue(['a','b','c']);
	 *     arr.toArray(); //['a','b','c']
	 */
	proto.setValue = function (arr) {
		cjs.wait(); // Don't run nullified functions quite yet
		_clear(this);
		this.push.apply(this, arr);
		cjs.signal(); // OK, now run them
		return this;
	};

	/**
	 * Convert my value to a standard JavaScript array
	 *
	 * @method item
	 * @return {array} - A standard JavaScript array
	 * @see toArray
	 * @example
	 *     var arr = cjs([1,2,3]);
	 *     arr.item(); //[1,2,3]
	 */
	/**
	 * Get item `key`
	 *
	 * @method item^2
	 * @param {number} key - The array index
	 * @return {*} - The value at index `key`
	 * @example
	 *     var arr = cjs(['a','b']);
	 *     arr.item(0); //['a']
	 */
	/**
	 * Set item i
	 *
	 * @method item^3
	 * @param {number} key - The array index
	 * @param {*} value - The new value
	 * @return {*} - `value`
	 * @example
	 *     var arr = cjs(['a','b']);
	 *     arr.item(0,'x');
	 *     arr.toArray(); // ['x','b']
	 */
	proto.item = function (key, val) {
		if(arguments.length === 0) { // Just return an array if called with no arguments
			return this.toArray();
		} else if (arguments.length === 1) { // Get if called with one argument
			return _get(this, key);
		} else if (arguments.length > 1) { // Put if called with more than one argument
			return _put(this, key, val);
		}
	};

	/**
	 * Clear this array and try to clean up any memory.
	 *
	 * @method destroy
	 * @param {boolean} [silent=false] - If set to `true`, avoids invalidating any dependent constraints.
	 */
	proto.destroy = function (silent) {
		_clear(this, silent);
		this.$len.destroy(silent);
	};

	/**
	 * Get the length of the array.
	 *
	 * @method length
	 * @return {number} - The length of the array
	 * @example
	 *     var arr = cjs(['a','b']);
	 *     arr.length(); // 2
	 */
	proto.length = function () {
		return this.$len.get(); // Remember that length is a constraint
	};
	
	/**
	 * The push() method mutates an array by appending the given elements and returning the new length of the array.
	 *
	 * @method push
	 * @param {*} ...elements - The set of elements to append to the end of the array
	 * @return {number} - The new length of the array
	 *
	 * @see pop
	 * @see shift
	 * @see unshift
	 * @see splice
	 * @example
	 *     var arr = cjs(['a','b']);
	 *     arr.push('c','d'); // 4
	 *     arr.toArray(); // ['a','b','c','d']
	 */
	proto.push = function () {
		var i, len = arguments.length, value_len = this._value.length;
		//Make operation atomic
		cjs.wait();
		// Add every item that was passed in
		for (i = 0; i < len; i++) {
			_put(this, value_len+i, arguments[i]);
		}
		cjs.signal();
		return this.length(); // return the new length
	};

	/**
	 * The pop() method removes the last element from an array and returns that element.
	 *
	 * @method pop
	 * @return {*} - The value that was popped off or `undefined`
	 * 
	 * @see push
	 * @see shift
	 * @see unshift
	 * @see splice
	 * @example
	 *     var arr = cjs(['a','b']);
	 *     arr.pop(); // 'b'
	 *     arr.toArray(); // ['a']
	 */
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

	/**
	 * Converts this array to a JavaScript array
	 *
	 * @method toArray
	 * @return {array} - This object as a JavaScript array
	 * @example
	 *     var arr = cjs(['a','b']);
	 *     arr.toArray(); // ['a', 'b']
	 */
	proto.toArray = function () {
		return this.map(identity); // just get every element
	};

	/**
	 * Returns the *first* item where calling filter is truthy
	 * 
	 * @method indexWhere
	 * @param {function} filter - The function to call on every item
	 * @param {*} thisArg - Object to use as `this` when executing `callback`.
	 * @return {number} - The first index where calling `filter` is truthy or `-1`
	 * @example
	 *     var arr = cjs(['a','b','b']);
	 *     arr.indexWhere(function(val, i) {
	 *         return val ==='b';
	 *     }); // 1
	 */
	proto.indexWhere = function (filter, thisArg) {
		var i, len = this.length(), $val;
		thisArg = thisArg || this;

		for (i = 0; i < len; i += 1) {
			$val = this._value[i];
			if (filter.call(thisArg, $val.get(), i)) { return i; }
		}

		return -1; // -1 if not found
	};
	/**
	 * Returns the *last* item where calling filter is truthy
	 * 
	 * @method lastIndexWhere
	 * @param {function} filter - The function to call on every item
	 * @param {*} thisArg - Object to use as `this` when executing `callback`.
	 * @return {number} - The last index where calling `filter` is truthy or `-1`
	 *
	 * @example
	 *     var arr = cjs(['a','b','a']);
	 *     arr.lastIndexWhere(function(val, i) {
	 *         return val ==='a';
	 *     }); // 2
	 */
	proto.lastIndexWhere = function (filter, thisArg) {
		var i, len = this.length(), $val;
		thisArg = thisArg || this;

		for (i = len - 1; i >= 0; i -= 1) {
			$val = this._value[i];
			if (filter.call(thisArg, $val.get(), i)) { return i; }
		}

		return -1; // -1 if not found
	};

	/**
	 * Returns the *first* index of `item`
	 * 
	 * @method indexOf
	 * @param {*} item - The item we are searching for
	 * @param {function} [equality_check] - How to check whether two objects are equal, defaults to the option that was passed in)
	 * @return {number} - The item's index or `-1`
	 *
	 * @example
	 *     var arr = cjs(['a','b','a']);
	 *     arr.indexOf('a'); // 0
	 */
	proto.indexOf = function (item, equality_check) {
		equality_check = equality_check || this.$equality_check.get();
		var filter = function (x) { return equality_check(x, item); };
		return this.indexWhere(filter);
	};

	/**
	 * Returns the *last* index of `item`
	 * 
	 * @method lastIndexOf
	 * @param {*} item - The item we are searching for
	 * @param {function} [equality_check] - How to check whether two objects are equal, defaults to the option that was passed in)
	 * @return {number} - The item's index or `-1`
	 * @example
	 *     var arr = cjs(['a','b','a']);
	 *     arr.indexOf('a'); // 2
	 */
	proto.lastIndexOf = function (item, equality_check) {
		equality_check = equality_check || this.$equality_check.get();
		var filter = function (x) { return equality_check(x, item); };
		return this.lastIndexWhere(filter);
	};

	/**
	 * Return `true` if `filter` against any item in my array is truthy
	 * 
	 * @method some
	 * @param {function} filter - The function to check against
	 * @param {*} thisArg - Object to use as `this` when executing `filter`.
	 * @return {boolean} - `true` if some item matches `filter`. `false` otherwise
	 * @see every
	 * @example
	 *     var arr = cjs([1,3,5]);
	 *     arr.some(function(x) { return x%2===0; }); // false
	 */
	proto.some = function(filter, thisArg) {
		return this.indexWhere(filter, thisArg) >= 0;
	};

	/**
	 * Return `true` if `filter` against every item in my array is truthy
	 * 
	 * @method every
	 * @param {function} filter - The function to check against
	 * @param {*} thisArg - Object to use as `this` when executing `filter`.
	 * @return {boolean} - `true` if some item matches `filter`. `false` otherwise
	 * @see some
	 * @example
	 *     var arr = cjs([2,4,6]);
	 *     arr.some(function(x) { return x%2===0; }); // true
	 */
	proto.every = function(filter, thisArg) {
		var rv = true;
		this.forEach(function() {
			if(!filter.apply(thisArg, arguments)) { // break on the first non-obeying element
				rv = false;
				return my.BREAK;
			}
		});
		return rv;
	};

	/**
	 * The splice() method changes the content of an array, adding new elements while removing old elements.
	 *
	 * @method splice
	 * @param {number} index - Index at which to start changing the array. If greater than the length of the array,
	 * no elements will be removed.
	 * @param {number} howMany - An integer indicating the number of old array elements to remove.
	 * If howMany is 0, no elements are removed. In this case, you should specify at least one new element.
	 * If howMany is greater than the number of elements left in the array starting at index,
	 * then all of the elements through the end of the array will be deleted.
	 * @param {*} ...elements - The elements to add to the array. If you don't specify any elements,
	 * splice simply removes elements from the array.
	 * @return {array.*} - An array containing the removed elements. If only one element is removed,
	 * an array of one element is returned. If no elements are removed, an empty array is returned.
	 *
	 * @see push
	 * @see pop
	 * @see shift
	 * @see unshift
	 * @example
	 *     var arr = cjs(['a','b','c']);
	 *     arr.splice(0,2,'x','y'); //['a','b']
	 *     arr.toArray(); // ['x','y','c']
	 */
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

	/**
	 * The shift() method removes the first element from an array and returns that element.
	 * This method changes the length of the array.
	 *
	 * @method shift
	 * @return {*} - The element that was removed
	 *
	 * @see unshift
	 * @see push
	 * @see pop
	 * @see splice
	 * @example
	 *     var arr = cjs(['a','b','c']);
	 *     arr.shift(); // 'a'
	 *     arr.toArray(); //['b','c']
	 */
	proto.shift = function () {
		var rv_arr = this.splice(0, 1);
		return rv_arr[0];
	};

	/**
	 * The unshift() method adds one or more elements to the beginning of an array and returns the new length
	 * of the array.
	 *
	 * @method unshift
	 * @param {*} ...elements - The elements to be added
	 * @return {number} - The new array length
	 *
	 * @see shift
	 * @see push
	 * @see pop
	 * @see splice
	 * @example
	 *     var arr = cjs(['a','b','c']);
	 *     arr.unshift('x','y'); // 5
	 *     arr.toArray(); //['x','y','a','b','c']
	 */
	proto.unshift = function () {
		this.splice.apply(this, ([0, 0]).concat(toArray(arguments)));
		return this.length();
	};

	/**
	 * The concat() method returns a new array comprised of this array joined with other array(s) and/or value(s).
	 *
	 * @method concat
	 * @param {*} ...values - Arrays and/or values to concatenate to the resulting array.
	 * @return {array} The concatenated array
	 * @example
	 *     var arr1 = cjs(['a','b','c']),
	 *     arr2 = cjs(['x']);
	 *     arr1.concat(arr2); // ['a','b','c','x']
	 */
	proto.concat = function () {
		// Every argument could either be a JS array or array constraint
		var args = map(arguments, function(arg) {
			return is_array(arg) ? arg.toArray() : arg;
		});
		var my_val = this.toArray();
		return my_val.concat.apply(my_val, args);
	};

	/**
	 * The slice() method returns a portion of an array.
	 *
	 * @method slice
	 * @param {number} [begin=0] - Zero-based index at which to begin extraction.
	 * @param {number} [end=this.length] - Zero-based index at which to end extraction. slice extracts up to but not including end.
	 * @return {array} A JavaScript array
	 * @example
	 *     var arr = cjs(['a','b','c']);
	 *     arr.slice(1); // ['b','c']
	 */
	proto.slice = function () {
		// Just call the normal slice with the same arguments
		var sliced_arr = this._value.slice.apply(this._value, arguments);
		return map(sliced_arr, function(x) {
			return x ? x.get() : undefined;
		});
	};

	/**
	 * Return a constraint whose value is bound to my value for key
	 *
	 * @method itemConstraint
	 * @param {number|Constraint} key - The array index
	 * @return {Constraint} - A constraint whose value is `this[key]`
	 * @example
	 *     var arr = cjs(['a','b','c']);
	 *     var first_item = arr.itemConstraint(0);
	 *     first_item.get(); // 'a'
	 *     arr.item(0,'x');
	 *     first_item.get(); // 'x'
	 */
	proto.itemConstraint = function(key) {
		return new Constraint(function() {
			// Call cjs.get on the key so the key can also be a constraint
			return this.item(cjs.get(key));
		}, {
			context: this
		});
	};

	/**
	 * The filter() method creates a new array with all elements that pass the test implemented by the provided function.
	 *
	 * @method filter
	 * @param {function} callback - Function to test each element of the array.
	 * @param {*} [thisObject] - Object to use as this when executing callback.
	 * @return {array} A filtered JavaScript array
	 */
	/**
	 * The join() method joins all elements of an array into a string.
	 *
	 * @method join
	 * @param {string} [separator=','] - Specifies a string to separate each element of the array.
	 * The separator is converted to a string if necessary. If omitted, the array elements are separated with a comma.
	 * @return {string} The joined string
	 */
	/**
	 * The sort() method sorts the elements of an array in place and returns the array.
	 * The default sort order is lexicographic (not numeric).
	 *
	 * @method sort
	 * @param {function} [compreFunction] - Specifies a function that defines the sort order. If omitted,
	 * the array is sorted lexicographically (in dictionary order) according to the string conversion of each element.
	 * @return {array} A sofrted JavaScript array
	 */
	/**
	 * The reverse() method reverses an array in place. The first array element becomes the last and the last becomes the first.
	 *
	 * @method reverse
	 * @return {array} A JavaScript array whose value is the reverse of mine
	 */
	/**
	 * The toString() method returns a string representing the specified array and its elements.
	 *
	 * @method toString
	 * @return {string} A string representation of this array.
	 */
	each(["filter", "join", "sort", "reverse", "toString"], function (fn_name) {
		// All of these functions will just convert to an array and return that
		proto[fn_name] = function () {
			var my_val = this.toArray();
			return my_val[fn_name].apply(my_val, arguments);
		};
	});
}(ArrayConstraint));
/** @lends */

/**
 * Determine whether an object is an array constraint
 * @method cjs.isArrayConstraint
 * @param {*} obj - An object to check
 * @return {boolean} - `true` if `obj` is a `cjs.ArrayConstraint`, `false` otherwise
 */
is_array = function(obj) {
	return obj instanceof ArrayConstraint;
};

extend(cjs, {
	/**
	 * Create an array constraint
	 * @method cjs.array
	 * @constructs cjs.ArrayConstraint
	 * @param {Object} [options] - A set of options to control how the array constraint is evaluated
	 * @return {cjs.ArrayConstraint} - A new array constraint object
	 * @see cjs.ArrayConstraint
	 * @example
	 *     var arr = cjs.array({
	 *         value: [1,2,3]
	 *     });
	 */
	array: function (options) { return new ArrayConstraint(options); },
	/** @expose cjs.ArrayConstraint */
	ArrayConstraint: ArrayConstraint,
	/** @expose cjs.isArrayConstraint */
	isArrayConstraint: is_array
});
