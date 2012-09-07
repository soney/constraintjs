(function(cjs) {
	var _ = cjs._;
	var constraint_solver = cjs._constraint_solver;

	cjs.define("live_function", function(fn) {
		var constraint = {
			cs_eval: function() {
				return fn.apply(this, arguments);
			}
		};

		var nullify = function() {
			constraint_solver.nullify(constraint);
		};

		var on_nullify = function() {
			constraint_solver.getValue(constraint);
		};
		var node = constraint_solver.addObject(constraint, { auto_add_outgoing_dependencies: false });
		var listener_id = constraint_solver.add_listener("nullify", node, on_nullify);

		var rv = {
			destroy: function() {
				constraint_solver.remove_listener(listener_id);
				constraint_solver.removeObject(constraint);
			}
		};

		constraint_solver.getValue(constraint);
		return rv;
	});

	cjs.liven = function(fn) {
		return cjs.create("live_function", fn);
	};
}(cjs));
