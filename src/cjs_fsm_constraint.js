(function(cjs) {
	var _ = cjs._;
	var create_fsm_constraint = function(fsm, specs) {
		var state_spec_strs = _.keys(specs)
			, selectors = _.map(state_spec_strs, function(state_spec_str) {
				return fsm.parse_selector(state_spec_str);
			})
			, values = _.values(specs);

		var getter = function() {
			var i;
			var state = fsm.get_state();
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
			return undefined;
		};
		var constraint = cjs.create("simple_constraint", getter);
		
		_.forEach(selectors, function(selector) {
			if(selector.is("transition")) {
				fsm.on(selector, function() {
					constraint.nullifyAndEval();
				});
			} else {
				fsm.on(selector, function() {
					constraint.nullify();
				});
			}
		});
		return constraint;
	};
	cjs.define("fsm_constraint", create_fsm_constraint);
}(cjs));
