// Array Constraints
// -----------------

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

	// Return a constraint whose value is bound to my value for key
	proto.getConstraint = function(key) {
		return new Constraint(function() {
			// Call cjs.get on the key so the key can also be a constraint
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

extend(cjs, {
	array: function (value) { return new ArrayConstraint(value); },
	ArrayConstraint: ArrayConstraint,
	isArrayConstraint: is_array
});
