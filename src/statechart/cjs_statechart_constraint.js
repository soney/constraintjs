(function(cjs) {
	var _ = cjs._;
	var create_statechart_constraint = function(statechart, specs) {
		var state_spec_strs = _.keys(specs)
			, selectors = []
			, values = []
			, last_state
			, last_value;

		var get_state = function() {
			var statechart_got = cjs.get(statechart);
			if(!cjs.is_statechart(statechart_got)) {
				return undefined;
			}
			return statechart_got.get_state();
		};

		var get_values = function() {
			return _.flatten(_.map(get_state(), function(state) {
				return _.compact(_.map(selectors, function(selector, i) {
					if(selector.matches(state)) {
						return {state: state, value: values[i]};
					}
					return false;
				}));
			}), true);
		};

		var get_value = function() {
			return _.first(get_values()) || {state: undefined, value: undefined};
		};


		var getter = function() {
			var state_and_value = get_value();
			var state = state_and_value.state
				, value = state_and_value.value;

			if(_.isFunction(value)) {
				return value(state);
			} else {
				return cjs.get(value);
			}
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
				var callback =  function() {
					last_transition_value = constraint.nullifyAndEval();
				};
				statechart.when(selector, callback);
				uninstall_funcs.push(_.bind(statechart.off_when, statechart, selector, callback));
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

	cjs.STAY = function(){};
	cjs.STAYVALUE = function(){};
}(cjs));
