// A function to hash the arguments passed in. By default, just a concatenation of the arguments' string value
var memoize_default_hash = function () {
	var i, len = arguments.length;
	var rv = "";
	for (i = 0; i < len; i += 1) {
		rv += arguments[i];
	}
	return rv;
},
// A function to check if two sets of arguments are equal; by default just check every value
memoize_default_equals = function (args1, args2) {
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

extend(cjs, {
	/**
	 * Memoize a function to avoid unecessary re-evaluation. Its options are:
	 *
	 * - `hash`: Create a unique value for each set of arguments (call with an argument array)
	 * - `equals`: check if two sets of arguments are equal (call with two argument arrays)
	 * - `context`: The context in which `getter_fn` should be evaliated
	 * - `literal_values`: Whether values should be literal if they are functions
	 *
	 * The return value of this method also has two functions:
	 * - `each`: Iterate through every set of arguments and value that is memoized
	 * - `destroy`: Clear the memoized values to clean up memory
	 *
	 * @method cjs.memoize
	 * @param {function} getter_fn - The function to memoize
	 * @param {object} [options] - A set of options to control how memoization works
	 * @return {function} the moemoized function
	 */
	memoize: function (getter_fn, options) {
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
	}
});
