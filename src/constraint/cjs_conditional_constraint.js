(function(cjs) {
	var _ = cjs._;
	var create_conditional_constraint = function() {
		var args = _.toArray(arguments);
		var getter = function() {
			var i;
			for(i = 0; i<args.length; i++) {
				var arg = args[i];
				var condition = arg.condition, value = arg.value;

				if(cjs.get(condition)) {
					return cjs.get(value);
				}
			}
			return undefined;
		};
		return cjs.create("simple_constraint", getter);
	};
	cjs.define("conditional_constraint", create_conditional_constraint);
}(cjs));
