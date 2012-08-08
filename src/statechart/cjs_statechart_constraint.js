(function(cjs) {
	var _ = cjs._;
	var create_statechart_constraint = function(statechart, specs) {
		var state_spec_strs = []
			, selectors = []
			, values = []
			, current_state
			, current_value;
		if(specs) {
			state_spec_strs  = _.keys(specs);
		}

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


		var constraint = cjs.create("constraint", getter);

		constraint.set_value_for_state = function(state, value) {
			specs.set(state, value);
		};
		constraint.get_value_for_state = function(state) {
			return specs.get(state);
		};

		var on_state_change = function() {
			var s_and_v = get_value();

			var state = s_and_v.state;
			var value = s_and_v.value;

			if(current_state !== state) {
				if(value === cjs.STAY) {
					current_value = current_value;
				} else if(value === cjs.STAYVALUE) {
					current_value = current_value.snapshot();
				} else {
					current_value 
				}
				current_state = state;
			//} else {
				//current_value = value;
			}


			constraint.nullifyAndEval();
		};

		var getter = function() {
			var value = current_value;
			if(_.isFunction(value)) {
				return value(state);
			} else {
				return cjs.get(value);
			}
		};

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
					on_state_change();
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
		on_state_change();
		return constraint;
	};
	cjs.define("statechart_constraint", create_statechart_constraint);
	cjs.constraint.statechart = create_statechart_constraint;

	cjs.STAY = function(){};
	cjs.STAYVALUE = function(){};
}(cjs));
