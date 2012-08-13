(function(cjs) {
	var _ = cjs._;
	var create_statechart_constraint = function(statechart, specs) {
		var	spec_map = cjs.create("map")
			, current_state
			, current_value
			, current_selector;
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
				return _.compact(spec_map.map(function(selector_and_value, state_spec) {
					var selector = selector_and_value.selector;
					var value = selector_and_value.value;
					if(selector.matches(state)) {
						return {state: state, value: value, selector: selector};
					}
					return false;
				}));
			}), true);
		};

		var get_value = function() {
			var values = get_values();
			return _.first(values) || {state: undefined, value: undefined, selector: undefined};
		};

		var getter = function() {
			var value = current_value;
			if(_.isFunction(value)) {
				return value(state);
			} else if(value && value.get) {
				return value.get();
			} else {
				return cjs.get(value);
			}
		};

		var constraint = cjs.create("constraint", getter);

		constraint.set_value_for_state = function(state_spec, value) {
			var sc = cjs.get(statechart);
			var selector = sc.parse_selector(state_spec);
			var replacing_existing_value = false;
			if(state_spec === current_state) {
				replacing_existing_value = true;
			}
			spec_map.set(state_spec, {selector: selector, value: value});

			var callback =  function() {
				on_state_change();
			};
			sc.when(selector, callback);
			uninstall_funcs.push(_.bind(sc.off_when, sc, selector, callback));

			if(current_state && selector.matches(current_state)) {
				on_state_change(replacing_existing_value);
			} else {
				on_state_change();
			}
		};

		constraint.unset_value_for_state = function(state_spec) {
			spec_map.unset(state_spec);
			uninstall_listeners();
			install_listeners();
		};

		constraint.move_value_for_state = function(state_spec, to_index) {
			spec_map.move(state_spec, to_index);
		};
		constraint.get_value_for_state = function(state) {
			var matching_values = [];
			spec_map.forEach(function(selector_and_value, state_spec) {
					var selector = selector_and_value.selector;
					var value = selector_and_value.value;
					if(selector.matches(state)) {
						matching_values.push(value);
					}
				});
			return _.first(matching_values);
		};
		constraint._event = cjs(null);

		var on_state_change = function(forced) {
			forced = forced===true;
			var s_and_v = get_value();

			var state = s_and_v.state;
			var value = s_and_v.value;
			var selector = s_and_v.selector;

			if(forced || current_state !== state) {
				if(value === cjs.STAY) {
					current_value = current_value;
				} else if(value === cjs.STAYVALUE) {
					current_value = current_value.snapshot();
				} else {
					current_value = value;
				}
				current_state = state;
				current_selector = selector;
				constraint._event.set(state.get_event());
			}

			constraint.nullifyAndEval();
		};


		var uninstall_funcs = [];
		var uninstall_listeners = function() {
				_.forEach(uninstall_funcs, function(uninstall_func) {
					uninstall_func();
				});
				uninstall_funcs = [];
			};
		var install_listeners = function(statechart) {
			uninstall_listeners();
			if(!cjs.is_statechart(statechart)) {
				return;
			}
			spec_map.forEach(function(selector_and_value, state_spec) {
					var selector = selector_and_value.selector;
					var value = selector_and_value.value;
					var callback =  function() {
						on_state_change();
					};
					statechart.when(selector, callback);
					uninstall_funcs.push(_.bind(statechart.off_when, statechart, selector, callback));
			});
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
