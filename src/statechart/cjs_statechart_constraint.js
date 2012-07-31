(function(cjs) {
	var _ = cjs._;
	var create_statechart_constraint = function(statechart, specs) {
		var state_spec_strs = _.keys(specs)
			, selectors = []
			, values = []
			, last_transition_value;

		var getter = function() {
			var i;
			var statechart_got = cjs.get(statechart);
			if(!cjs.is_statechart(statechart_got)) {
				return undefined;
			}
			var state = statechart_got.get_state();
			for(i = 0; i<selectors.length; i++) {
				var selector = selectors[i];
				if(selector.matches(state)) {
					var value = values[i];
					if(_.isFunction(value)) {
						return value(state);
					} else {
						return cjs.get(value);
					}
				}
			}
			return last_transition_value;
		};

		var constraint = cjs.create("constraint", getter);

		var uninstall_listeners = function(){};
		var install_listeners = function(statechart) {
			var uninstall_funcs = [];
			uninstall_listeners();
			if(!cjs.is_statechart(statechart)) {
				return;
			}

			selectors = _.map(state_spec_strs, function(state_spec_str) {
				return statechart.parse_selector(state_spec_str);
			});
			values = _.values(specs);

			_.forEach(selectors, function(selector) {
				if(selector.is("transition")) {
					var callback =  function() {
						last_transition_value = constraint.nullifyAndEval();
					};
					statechart.when(selector, callback);
					uninstall_funcs.push(_.bind(statechart.off_when, statechart, callback));
				} else {
					var callback = function() {
						last_transition_value = constraint.nullifyAndEval();
					}
					statechart.on(selector, callback);
					uninstall_funcs.push(_.bind(statechart.off_when, statechart, callback));
				}
			});
			uninstall_listeners = function() {
				_.forEach(uninstall_funcs, function(uninstall_func) {
					uninstall_func();
				});
			};
		};

		if(cjs.is_constraint(statechart)) {
			statechart.onChange(function(val) {
				uninstall_listeners();
				install_listeners(val);
			});
			install_listeners(statechart.get());
		} else {
			install_listeners(statechart);
		}

		return constraint;
	};
	cjs.define("statechart_constraint", create_statechart_constraint);
	cjs.constraint.statechart = create_statechart_constraint;
}(cjs));
