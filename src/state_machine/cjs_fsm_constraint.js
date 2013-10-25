	var create_fsm_constraint = function(fsm, specs) {
		var state_spec_strs = _.keys(specs),
			selectors = [],
			values = [],
			last_transition_value;

		var getter = function() {
			var i;
			var fsm_got = cjs.get(fsm);
			if(!cjs.is_fsm(fsm_got)) {
				return undefined;
			}
			var state = fsm_got.get_state();
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

		var constraint = cjs(getter);

		var uninstall_listeners = function(){};
		var install_listeners = function(fsm) {
			var uninstall_funcs = [];
			uninstall_listeners();
			if(!cjs.is_fsm(fsm)) {
				return;
			}

			selectors = _.map(state_spec_strs, function(state_spec_str) {
				return fsm.parse_selector(state_spec_str);
			});
			values = _.values(specs);

			each(selectors, function(selector) {
				if(selector.is("transition")) {
					fsm.on(selector, function() {
						last_transition_value = constraint.nullifyAndEval();
					});
					uninstall_funcs.push(_.bind(fsm.off, fsm, fsm.last_callback()));
				} else {
					fsm.on(selector, function() {
					//	constraint.nullify();
						last_transition_value = constraint.nullifyAndEval();
					});
					uninstall_funcs.push(_.bind(fsm.off, fsm, fsm.last_callback()));
				}
			});
			uninstall_listeners = function() {
				each(uninstall_funcs, function(uninstall_func) {
					uninstall_func();
				});
			};
		};

		if(cjs.is_constraint(fsm)) {
			fsm.onChange(function(val) {
				uninstall_listeners();
				install_listeners(val);
			});
			install_listeners(fsm.get());
		} else {
			install_listeners(fsm);
		}

		return constraint;
	};
