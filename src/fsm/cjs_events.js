(function(cjs) {
var _ = cjs._;

cjs.on = function(event_type, target) {
	var context = this;

	var rv = function(do_something) {
		target.addEventListener(event_type, do_something);
	};

	rv.guard = function(guard_func) {
		return function(do_something) {
			target.addEventListener(event_type, function() {
				var args = _.toArray(arguments);
				if(guard_func.apply(context, args)) {
					do_something.apply(context, args);
				}
			});
		};
	};

	return rv;
};

}(cjs));
