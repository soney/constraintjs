	var create_fsm_binding = function(fsm, specs) {
		var state_spec_strs = _.keys(specs),
			selectors = _.map(state_spec_strs, function(state_spec_str) {
				return fsm.parse_selector(state_spec_str);
			}),
			bindings = _.values(specs);

				
		var last_binding;
		var deactivate_fns = [];
		var activate = function() {
			fsm.on("*", function() {
				if(last_binding) {
					last_binding.deactivate();
				}
			});
			deactivate_fns.push(fsm.last_callback());

			each(selectors, function(selector, index) {
				var binding = bindings[index];
				if(selector.is("transition")) {
					fsm.on(selector, function() {
						last_binding = undefined;
						binding.activate();
						binding.deactivate();
					});
					deactivate_fns.push(fsm.last_callback());
				} else {
					fsm.on(selector, function() {
						if(!_.isUndefined(last_binding)) {
							last_binding.deactivate();
						}
						binding.activate();
						last_binding = binding;
					});
					deactivate_fns.push(fsm.last_callback());
					if(fsm.is(selector)) {
						binding.activate();
						last_binding = binding;
					}
				}
			});
		};

		var deactivate = function() {
			each(deactivate_fns, function(deactivate_fn) {
				fsm.off(deactivate_fn);
			});
		};
		var update = function() {
			each(bindings, function(binding) {
				if(binding.is_activated()) {
					binding.update();
				}
			});
		};

		var binding = cjs.create("binding", {
			activate: activate,
			deactivate: deactivate,
			update: update
		});

		return binding;
	};

	cjs.binding.mixin("bind_check_fsm", function(objs, arg0, arg1, arg2) {
		var setter;
		if(cjs.is_fsm(arg0)) {
			var fsm = arg0;
			var vals = arg1;
			setter = arg2;
			var bindings = {};
			each(vals, function(constraint, key) {
				bindings[key] = cjs.binding.bind(objs, constraint, setter, false);
			});
			return cjs.create("fsm_binding", fsm, bindings);
		} else {
			var constraint = arg0;
			setter = arg1;
			return cjs.binding.bind(objs, constraint, setter);
		}

	});
