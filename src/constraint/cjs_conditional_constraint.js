(function(cjs) {
	var _ = cjs._;
	var create_conditional_constraint = function() {
		var args = _.map(arguments, function(arg) {
			var rv = {};
			if(_.has(arg, "condition")) {
				if(_.isFunction(arg.condition)) {
					rv.condition = cjs.create("constraint", arg.condition);
				} else {
					rv.condition = arg.condition;
				}
			}
			if(_.has(arg, "value")) {
				if(_.isFunction(arg.value)) {
					rv.value = cjs.create("constraint", arg.value);
				} else {
					rv.value = arg.value;
				}
			}
			return rv;
		});

		var getter = function() {
			var i, len;
			for(i = 0,len=args.length; i<args.length; i++) {
				var arg = args[i];
				var condition = arg.condition, value = arg.value;

				if(!_.has(arg, "condition") || cjs.get(condition)) {
					return cjs.get(value);
				}
			}
			return undefined;
		};
		return cjs.create("constraint", getter);
	};
	cjs.define("conditional_constraint", create_conditional_constraint);
}(cjs));
