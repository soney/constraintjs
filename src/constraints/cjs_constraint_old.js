(function(cjs) {
	var _ = cjs._;
	var create_constraint = function(arg0, arg1) {
		if(arguments.length === 0) {
			return cjs.create("simple_constraint", undefined);
		} else if(arguments.length === 1) {
			return cjs.create("simple_constraint", arg0);
		} else if(arguments.length === 2) {
			if(arg0 instanceof cjs.type("FSM")) {
				return cjs.create("fsm_constraint", arg0, arg1);
			} else if(_.isBoolean(arg1)) {
				return cjs.create("simple_constraint", arg0, arg1);
			}
		}

		var args = _.toArray(arguments);

		if(_.all(arguments, function(arg) {
				return _.has(arg, "condition") && arg.hasOwnProperty("value");
			})) {
			args.unshift("coditional_constraint");
			return cjs.create.apply(cjs, args);
		}
		args.unshift("simple_constraint");
		return cjs.create.apply(cjs, args);
	};

	var Constraint = cjs.type("simple_constraint");
	create_constraint.fn = function(name, func) {
		Constraint.prototype[name] = function() {
			var args = _.toArray(arguments);
			var self = this;
			var rv = cjs.create("simple_constraint", function() {
				var val = cjs.get(self);
				return func.apply(this, ([val]).concat(args));
			});

			rv.basis = this;
			rv.basis_args = args;

			return rv;
		};
		create_constraint[name] = function(arg0) {
			var args = _.toArray(arguments);
			if(args.length === 0) { return cjs.create("simple_constraint"); }
			else {
				var initial_constraint = cjs.create("simple_constraint", arg0);
				var other_args = _.rest(args, 1);
				return initial_constraint[name].apply(initial_constraint, other_args);
			}
		};
	};

	cjs.async = create_constraint.async = function() {
		var args = _.toArray(arguments);
		args.unshift("async_constraint");
		return cjs.create.apply(cjs, args);
	};

	cjs.constraint = create_constraint;
}(cjs));
