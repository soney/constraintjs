(function(cjs, root) {
	var _ = cjs._;
	var create_async_constraint = function(invoke_callback, timeout_interval) {
		var async_fsm = cjs	.create("fsm")
							.add_state("pending")
							.add_transition(function(do_transition ) {
								if(_.isNumber(timeout_interval)) {
									root.setTimeout(function() {
										do_transition("timeout");
									}, timeout_interval);
								}
							}, "rejected", false)
							.add_state("resolved")
							.add_state("rejected")
							.starts_at("pending");

		var do_resolved_transition = async_fsm.get_transition("pending", "resolved", false);
		var do_rejected_transition = async_fsm.get_transition("pending", "rejected", false);

		if(_.isNumber(timeout_interval)) {
			root.setTimeout(function() {
				do_rejected_transition("timeout");
			}, timeout_interval);
		}
		var resolved = function(value) {
			resolved_value = value;
			do_resolved_transition(value);
		};

		var rejected = function(message) {
			rejected_value = message;
			do_rejected_transition(message);
		};

		invoke_callback(resolved, rejected);


		var constraint = cjs.create("fsm_constraint", async_fsm, {
			"pending": undefined
			, "resolved": function() {
				return cjs.get(resolved_value);
			}
			, "rejected": function() {
				return cjs.get(rejected_value);
			}
		});

		constraint.is_pending = function() {
			return constraint.$state.get() === "pending";
		};
		constraint.is_resolved = function() {
			return constraint.$state.get() === "resolved";
		};
		constraint.is_rejected = function() {
			return constraint.$state.get() === "rejected";
		};

		constraint.state = async_fsm;


		return constraint;
	};
	cjs.define("async_constraint", create_async_constraint);
	cjs.constraint.async = create_async_constraint;
}(cjs, this));
