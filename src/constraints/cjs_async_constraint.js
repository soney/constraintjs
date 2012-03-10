(function(cjs, root) {
	var _ = cjs._;
	var create_async_constraint = function(invoke_callback, timeout_interval) {
		var do_resolved_transition, do_rejected_transition, resolved_value, rejected_value;
		var resolved_func = function(do_transition) {
			do_resolved_transition = do_transition;
		};

		var rejected_func = function(do_transition) {
			do_rejected_transition = do_transition;
		};

		var resolved = function(value) {
			resolved_value = value;
			do_resolved_transition(value);
		};

		var rejected = function(message) {
			rejected_value = message;
			do_rejected_transition(message);
		};

		invoke_callback(resolved, rejected);

		var async_fsm = cjs	.fsm()
							.add_state("pending")
							.add_transition(resolved_func, "resolved")
							.add_transition(rejected_func, "rejected")
							.add_transition(function(do_transition ) {
								if(_.isNumber(timeout_interval)) {
									root.setTimeout(function() {
										do_transition("timeout");
									}, timeout_interval);
								}
							}, "rejected")
							.add_state("resolved")
							.add_state("rejected")
							.starts_at("pending");


		var $state = cjs.create("fsm_constraint", async_fsm, {
			"pending": "pending"
			, "resolved": "resolved"
			, "rejected": "rejected"
		});

		var constraint = cjs.create("fsm_constraint", async_fsm, {
			"pending": undefined
			, "resolved": function() {
				return cjs.get(resolved_value);
			}
			, "rejected": function() {
				return cjs.get(rejected_value);
			}
		});

		constraint.$state = $state;
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
}(cjs, this));
