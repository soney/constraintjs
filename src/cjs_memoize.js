	var memoize_default_hash = function () {
		var i, len = arguments.length;
		var rv = "";
		for (i = 0; i < len; i += 1) {
			rv += arguments[i];
		}
		return rv;
	};
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

	cjs.memoize = function (getter_fn, options) {
		options = extend({
			hash: memoize_default_hash,
			equals: memoize_default_equals,
			context: false,
			literal_values: false
		}, options);

		var args_map = cjs.map({
			hash: options.hash,
			equals: options.equals,
			literal_values: options.literal_values
		});

		var get_constraint = function () {
			var args = arguments,
				my_context = options.context || this;
			var constraint = args_map.get_or_put(args, function () {
				return new Constraint(function () {
					return getter_fn.apply(my_context, args);
				});
			});
			return constraint;
		};

		var rv = function () {
			var constraint = get_constraint.apply(this, arguments);
			return constraint.get();
		};
		rv.destroy = function () {
			args_map.each(function (constraint) {
				constraint.destroy();
			}).destroy();
		};
		rv.set_cached_value = function () {
			var args = slice.call(arguments, 0, arguments.length - 1);

			var constraint = get_constraint.apply(this, args);
			var value = arguments[arguments.length-1];
			constraint.set_cached_value(value);
		};
		return rv;
	};
