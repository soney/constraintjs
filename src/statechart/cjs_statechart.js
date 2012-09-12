(function(cjs) {
var _ = cjs._;

var StatechartTransition = function(statechart, from_state, to_state, event) {
	this._statechart = statechart;
	this._from_state = from_state;
	this._to_state = to_state;
	this.do_run = _.bind(this.run, this);
	this._event = event;

	this._event.on_fire(this.do_run);
	this.id = _.uniqueId();
	this._basis = undefined;
};

(function(my) {
	var proto = my.prototype;
	proto.run = function(event) {
		var statechart = this.get_statechart();
		if(statechart.is(this.from())) {
			statechart._run_transition(this, event);
		}
	};
	proto.involves = function(state) {
		return this.from() === state || this.to() === state;
	};
	proto.destroy = function() {
		this._event.off_fire(this.do_run);
		this._event.destroy();
	};
	proto.from = function() { return this._from_state; }; 
	proto.to = function() { return this._to_state; };
	proto.get_event = function() { return this._event; };
	proto.get_context = function() {
		return this.get_statechart();
	};
	proto.get_statechart = function() { return this._statechart; };
	proto.set_basis = function(basis) { this._basis = basis; };
	proto.get_basis = function() { return this._basis; };
	proto.stringify = function() {
		return "" + this.id + (this._event.type === "red_event" ? ","+this._event.id : "");
	};
}(StatechartTransition));

var StateSelector = function(state_name) {
	this.state_name = state_name;
};
(function(my) {
	var proto = my.prototype;
	proto.matches = function(state) {
		return state instanceof Statechart && state.matches(this.state_name);
	};
	proto.is = function(str) { return str === "state"; };
}(StateSelector));

var AnyStateSelector = function() { };
(function(my) {
	var proto = my.prototype;
	proto.matches = function(state) {return state instanceof Statechart;};
	proto.is = function(str) { return str === "*"; };
}(AnyStateSelector));

var TransitionSelector = function(pre, from_state_selector, to_state_selector) {
	this.is_pre = pre;
	this.from_state_selector = from_state_selector;
	this.to_state_selector = to_state_selector;
};
(function(my) {
	var proto = my.prototype;
	proto.matches = function(transition, pre) {
		if(transition instanceof StatechartTransition) {
			var from_state = transition.from();
			var to_state = transition.to();
			return this.from_state_selector.matches(from_state) &&
					this.to_state_selector.matches(to_state) &&
					this.is_pre === pre;
		} else { return false; }
	};
	proto.is = function(str) { return str === "transition"; };
}(TransitionSelector));

var MultiSelector = function(selectors) {
	this.selectors = selectors;
};

(function(my) {
	var proto = my.prototype;
	proto.matches = function() {
		var match_args = arguments;
		return _.any(this.selectors, function(selector) {
			return selector.matches.apply(selector, match_args);
		});
	};
	proto.is = function(str) { return str === "multi"; };
}(MultiSelector));

var parse_single_state_spec = function(str) {
	if(str === "*") {
		return new AnyStateSelector();
	} else {
		return new StateSelector(str);
	}
};

var parse_state_spec = function(str) {
	var state_spec_strs = str.split(",");
	if(state_spec_strs.length === 1) {
		return parse_single_state_spec(state_spec_strs[0]);
	} else {
		var state_specs = _.map(state_spec_strs, function(state_spec_str) {
			return parse_single_state_spec(state_spec_str);
		});
		return new MultiSelector(state_specs);
	}
};

var parse_transition_spec = function(left_str, transition_str, right_str) {
	var left_to_right_transition, right_to_left_transition;
	var left_state_spec = parse_state_spec(left_str);
	var right_state_spec = parse_state_spec(right_str);

	if(transition_str === "<->") {
		left_to_right_transition = new TransitionSelector(false, left_state_spec, right_state_spec);
		right_to_left_transition = new TransitionSelector(false, right_state_spec, left_state_spec);
		return new MultiSelector(left_to_right_transition, right_to_left_transition);
	} else if(transition_str === ">-<") {
		left_to_right_transition = new TransitionSelector(true, left_state_spec, right_state_spec);
		right_to_left_transition = new TransitionSelector(true, right_state_spec, left_state_spec);
		return new MultiSelector(left_to_right_transition, right_to_left_transition);
	} else if(transition_str === "->") {
		return new TransitionSelector(false, left_state_spec, right_state_spec);
	} else if(transition_str === ">-") {
		return new TransitionSelector(true, left_state_spec, right_state_spec);
	} else if(transition_str === "<-") {
		return new TransitionSelector(false, right_state_spec, left_state_spec);
	} else if(transition_str === "-<") {
		return new TransitionSelector(true, right_state_spec, left_state_spec);
	} else { return null; }
};

var parse_spec = function(str) {
	if(str instanceof Statechart) {
		return new StateSelector(str);
	}

	var transition_separator_regex = /^([a-zA-Z0-9,\-*\.]+)\s*((<->|>-<|->|>-|<-|-<)\s*([a-zA-Z0-9,\-*\.]+))?$/;
	var matches = str.match(transition_separator_regex);
	if(matches === null) {
		return null;
	} else {
		//"A": ["A", "A", undefined, undefined, undefined]
		//"A->b": ["A->b", "A", "->b", "->", "b"]
		if(matches[2] === undefined) {
			var states_str = matches[1];
			return parse_state_spec(states_str);
		} else {
			var from_state_str = matches[1], transition_str = matches[3], to_state_str = matches[4];
			return parse_transition_spec(from_state_str, transition_str, to_state_str);
		}
	}
};

var state_listener_id = 0;
var StateListener = function(selector, callback) {
	this.selector = selector;
	this.callback = callback;
	this.id = state_listener_id++;
};
(function(my) {
	var proto = my.prototype;
	proto.interested_in = function() {
		return this.selector === arguments[0] || this.selector.matches.apply(this.selector, arguments);
	};
	proto.run = function() {
		this.callback();
	};
}(StateListener));

var Statechart = function(type, defer_states_invalidation) {
	this._running = false;
	this._transitions = cjs.create("array");
	this._states = cjs.create("map");
	if(defer_states_invalidation === true) { this._states.defer_invalidation(true); }
	
	this._starts_at = undefined;
	this._parent = undefined;
	this._concurrent = false;

	var self = this;
	this._$complete_state = cjs.create("constraint", function() {
		return self._complete_state_getter();
	});
	this._$local_state = cjs.create("constraint", undefined, true);

	this._listeners = {};
	this._type = _.isUndefined(type) ? "statechart" : type;
	if(this.get_type() !== "pre_init") {
		this.add_state("_pre_init", "pre_init");
	}
	this.id = _.uniqueId();
	this._basis = undefined;
	this._event = cjs.create("constraint", undefined, true);

	this.$state_added = _.bind(this.state_added, this);
	this.$state_removed = _.bind(this.state_removed, this);
	this.$state_moved = _.bind(this.state_moved, this);
	this.$transition_added = _.bind(this.transition_added, this);
	this.$transition_removed = _.bind(this.transition_removed, this);
};
(function(my) {
	var proto = my.prototype;
	proto._set_event = function(event) { this._event = event; };
	proto.get_event = function() { return this._event; };
	proto.set_basis = function(basis) { this._basis = basis; };
	proto.get_basis = function() { return this._basis; };
	proto.get_local_state = function() {
		return this._$local_state.get();
	};
	proto.get_type = function() {
		return this._type;
	};
	proto.state_added = function(event) {
		this._notify("state_added", event);
	};
	proto.state_removed = function(event) {
		this._notify("state_removed", event);
	};
	proto.state_moved = function(event) {
		this._notify("state_moved", event);
	};
	proto.state_renamed = function(event) {
		this._notify("state_renamed", event);
	};
	proto.transition_added = function(event) {
		this._notify("transition_added", event);
	};
	proto.transition_removed = function(event) {
		this._notify("transition_removed", event);
	};
	proto.defer_invalidation = function(to_defer) {
		this._states.defer_invalidation(to_defer);
		this._transitions.defer_invalidation(to_defer);
		this._states.forEach(function(state) {
			state.defer_invalidation(to_defer);
		});
	};
	proto.invalidate = function() {
		this._states.invalidate();
		this._transitions.invalidate();
		this._states.forEach(function(state) {
			state.invalidate();
		});
	};

	proto.add_state = function(state_name, type, index) {
		var state_names = _.isArray(state_name) ? state_name : state_name.split(".");

		if(_.size(state_names) === 1) {
			state_name = _.last(state_names);

			if(this.has_state(state_name)) {
				this.remove_state(state_name);
			}

			var state = type instanceof Statechart ? type : new Statechart(type);
			state.set_parent(this);
			this._states.set(state_name, state, index);
			if(this.is_running()) {
				state.run();
			}

			state._on("state_added", this.$state_added);
			state._on("state_removed", this.$state_removed);
			state._on("state_moved", this.$state_moved);
			state._on("transition_added", this.$transition_added);
			state._on("transition_removed", this.$transition_removed);

			this._notify("state_added", {
				state_name: state_name
				, state: state
				, target: this
			});
		} else {
			var first_state_name = _.first(state_names);
			var state = this.get_state_with_name(first_state_name);
			if(_.isNull(state)) {
				this.add_state(first_state_name);
				state = this.get_state_with_name(first_state_name);
			}

			state.add_state(_.rest(state_names), type);
		}

		if(!this.is_running() && state.get_type() === "pre_init") {
			this._$local_state.set(state, true);
		}

		return this;
	};
	proto.remove_state = function(state_name, also_destroy) {
		var state_names = _.isArray(state_name) ? state_name : state_name.split(".");

		if(_.size(state_names) === 1) {
			state_name = _.last(state_names);

			var state = this.get_state_with_name(state_name);
			if(!_.isNull(state)) {
				var transitions_involving_state = this.transitions_involving_state(state);
				var transitions_not_involving_state = this.transitions_not_involving_state(state);

				this._transitions.set(transitions_not_involving_state);

				state._off("state_added", this.$state_added);
				state._off("state_removed", this.$state_removed);
				state._off("state_moved", this.$state_moved);
				state._off("transition_added", this.$transition_added);
				state._off("transition_removed", this.$transition_removed);

				this._states.unset(state_name);
				this._notify("state_removed", {
					state: state
					, state_name: state_name
					, target: this
				});
				if(also_destroy !== true) {
					state.destroy();
					_.forEach(transitions_involving_state, function(transition) {
						transition.destroy();
					});
				}
			}
		} else {
			var first_state_name = _.first(state_names);
			var state = this.get_state_with_name(first_state_name);
			if(!_.isNull(state)) {
				state.remove_state(_.rest(state_names));
			}
		}

		return this;
	};
	proto.transitions_involving_state = function(state) {
		return this._transitions.filter(function(transition) {
			return transition.involves(state);
		});
	};
	proto.transitions_not_involving_state = function(state) {
		return this._transitions.reject(function(transition) {
			return transition.involves(state);
		});
	};
	proto.rename_state = function(from_name, to_name) {
		this._states.rename(from_name, to_name);
		this._notify("state_renamed", {
			from_name: from_name
			, to_name: to_name
			, target: this
		});
		return this;
	};
	proto.get_state_index = function(state_name) {
		return this._states._key_index(state_name);
	};
	proto.move_state = function(state_name, index) {
		this._states.move(state_name, index);
		this._notify("state_moved", {
			state_name: state_name
			, target: this
			, index: index
		});
		return this;
	};
	proto.destroy = function() {
		this._notify("destroy", {
			target: this
		});
	};
	proto.has_state = function(state_name) {
		return !_.isNull(this.get_state_with_name(state_name));
	};
	proto.in_state = function(state_name) {
		return this.get_state_with_name(state_name);
	};
	proto.starts_at = function(state_name) {
		var pre_init_state = this._find_state("_pre_init");
		this.add_transition(pre_init_state, state_name, cjs.create_event("init", this));
		return this;
	};
	proto.get_transition_by_id = function(transition_id) {
		var len = this._transitions.length();
		for(var i = 0; i<len; i++) {
			var transition = this._transitions.item(i);
			if(transition.id === transition_id) {
				return transition;
			}
		}
		return undefined;
	};
	proto.remove_transition = function(transition, and_destroy) {
		if(and_destroy !== false) {
			transition.destroy();
		}
		this._transitions.set(this._transitions.without(transition));
		this._notify("transition_removed", {
			transition: transition
			, target: this
		});
		return this;
	};
	proto.get_initial_state = function() {
		return this.get_state_with_name(this._starts_at);
	};
	proto.up = proto.parent = function() {
		return this._parent;
	};
	proto.set_parent = function(parent) {
		this._parent = parent;
		return this;
	};
	proto.get_state_with_name = function(state_name) {
		var state_names = _.isArray(state_name) ? state_name : state_name.split(".");

		if(_.isEmpty(state_names)) {
			return this;
		} else {
			var rv = this._states.get(_.first(state_names));
			if(_.isUndefined(rv)) {
				return null;
			} else {
				return rv.get_state_with_name(_.rest(state_names));
			}
		}
	};
	proto.concurrent = function(is_concurrent) {
		this._concurrent = is_concurrent;
		return this;
	};
	proto.is_concurrent = function() {
		return this._concurrent;
	};
	proto._find_state = function(state) {
		if(_.isString(state)) {
			return this.get_state_with_name(state);
		} else {
			return state;
		}
	}
	proto.run = function() {
		this._running = true;
		if(this._concurrent) {
			this._states.forEach(function(state) {
				state.run();
			});
		} else {
			var local_state = this.get_local_state();
			if(!_.isUndefined(local_state)) {
				local_state.run();
			}
		}
		var event = {
			type: "run"
			, timestamp: (new Date()).getTime()
			, target: this
		};
		this._notify("run", event);
		return this;
	};
	proto.is_running = function() {
		return this._running;
	};
	proto._complete_state_getter = function() {
		if(this.is_concurrent()) {
			var active_states = this._states.map(function(state) {
				return state.get_state();
			});
			var rv = [];
			return rv.concat.apply(rv, active_states);
		} else {
			if(this.is_atomic()) {
				return [];
			}

			var local_state = this.get_local_state();
			if(local_state.get_type() === "pre_init") {
				return [local_state];
			} else {
				var rv = [local_state];
				return rv.concat(local_state.get_state());
			}
		}
	};
	proto.get_state = function() {
		return this._$complete_state.get();
	};
	proto.get_state_names = function() {
		return _.map(this.get_state(), function(state) {
			return state.get_name();
		});
	};
	proto.get_substates = function() {
		return this._states.get_values();
	};
	proto.flatten = function() {
		var substates = this.get_substates();
		var flattened_substates = _.flatten(_.map(substates, function(substate) {
			return substate.flatten();
		}), true);

		return [this].concat(flattened_substates);
	};
	proto._set_state = function(state, event) {
		if(this.is_concurrent()) {
			/*
			 * Find the substate immediately below this level and set its state
			 */
			var substates = this.get_substates();
			var parent = state.parent(); 
			while(parent) {
				if(_.indexOf(substates, parent) >= 0) {
					break;
				}
				parent = parent.parent();
			}
			if(parent) {
				parent._set_state(state, event);
			}
		} else {
			var states_left = [];
			var states_entered = [];
			var curr_state = this.get_local_state();

			while(!_.isUndefined(curr_state) && curr_state !== this) {
				states_left.push(curr_state);
				curr_state = curr_state.parent();
			}

			curr_state = state;

			while(!_.isUndefined(curr_state) && curr_state !== this) {
				states_entered.push(curr_state);
				curr_state = curr_state.parent();
			}

			_.forEach(states_left, function(state) {
				state._notify("exit", event);
			});

			_.forEach(states_entered, function(entered_state) {
				if(!entered_state.is_running()) {
					entered_state.run();
				}
				if(entered_state !== state) {
					entered_state._set_state(state);
				}
			});

			state._set_event(event);
			this._$local_state.set(state);

			_.forEach(states_entered, function(state) {
				state._notify("enter", event);
			});
		}
	};
	proto._run_transition = function(transition, event) {
		var from_state = transition.from()
			, to_state = transition.to();
		
		var parentage = [this];
		var parent = this.parent();
		while(parent) {
			parentage.push(parent);
			parent = parent.parent();
		}
		var when_listeners = _.compact(_.flatten(_.map(parentage, function(parent) {
			return parent._listeners.when;
		}, true)));
		_.forEach(when_listeners, function(listener) {
			if(listener.interested_in(transition, true)) {
				listener.run(event, transition, to_state, from_state);
			}
		});
		this._set_state(to_state, event);
		_.forEach(when_listeners, function(listener) {
			if(listener.interested_in(transition, false)) {
				listener.run(event, transition, to_state, from_state);
			}
		});
		_.forEach(when_listeners, function(listener) {
			if(listener.interested_in(transition, false)) {
				listener.run(event, transition, to_state, from_state);
			}
			if(listener.interested_in(to_state)) {
				listener.run(event, transition, to_state, from_state);
			}
		});
	};
	proto.is = function(state) {
		state = this._find_state(state);
		if(this === state) { return true; }

		if(this.is_concurrent()) {
			return this._states.any(function(substate) {
				return substate.is(state);
			});
		} else {
			var local_state = this.get_local_state();
			if(_.isUndefined(local_state)) {
				return false;
			} else {
				return local_state.is(state);
			}
		}
	};

	proto._get_transition = function() {
		var from_state, to_state, event;
		if(arguments.length >= 2) {
			from_state = this._find_state(arguments[0]);
			to_state = this._find_state(arguments[1]);
			event = arguments[2];
		} else {
			from_state = this;
			to_state = this._find_state(arguments[0]);
			event = arguments[1];
		}

		var transition = new StatechartTransition(this, from_state, to_state, event);
		return transition;
	};

	proto.add_transition = function(arg0) {
		var transition;
		if(arguments.length === 1 && arg0 instanceof StatechartTransition) {
			transition = arg0;
		} else {
			transition = this._get_transition.apply(this, arguments);
		}

		this._last_transition = transition;
		this._transitions.push(transition);

		this._transitions.set(_.sortBy(this._transitions.get(), function(transition) {
			return transition.id;
		})); // If transitions are removed and re-inserted, try to keep some consistent ordering
		
		this._notify("transition_added", {
			transition: transition
			, target: this
		});
		return this;
	};
	proto.get_last_transition = function() {
		return this._last_transition;
	};
	proto.get_transitions = function() {
		return _.clone(this._transitions.get());
	};

	proto.name_for_state = function(state) {
		return this._states.key_for_value(state);
	};

	proto.get_name = function(relative_to) {
		var parent = this.parent();
		if(!relative_to) {
			relative_to = this.get_root();
		}

		var my_name = parent ? parent.name_for_state(this) : "";
		if(parent === relative_to) {
			return my_name;
		} else {
			var parent_name = parent ? parent.get_name(relative_to) : "";
			if(parent_name === "") {
				return my_name;
			} else {
				return parent_name + "." + my_name;
			}
		}
	};

	proto.matches = function(state) {
		if(state instanceof Statechart) {
			if(this === state) {
				return true;
			} else {
				var parent = this.parent();
				if(parent) {
					return parent.matches(state);
				} else {
					return false;
				}
			}
		} else if(_.isString(state)) {
			var parent = this.parent();
			var name = "";
			while(!_.isUndefined(parent)) {
				name = this.get_name(parent);

				if(this.get_name(parent) === state) {
					return true;
				}
				
				parent = parent.parent();
			}
			return false;
		} else {
			return false;
		}
	};

	proto.get_substate_names = function() {
		var state_names = this._states.get_keys();
		if(state_names.length === 1) {
			return [];
		} else {
			return state_names;
		}
	};
	proto.get_substates = function() {
		var states = this._states.get_values();
		if(states.length === 1) {
			return [];
		} else {
			return states;
		}
	};

	proto.is_atomic = function() {
		return _.isEmpty(this.get_substates());
	};

	proto.clone = function(parent, context, state_map) {
		var statemap_was_undefined = false;
		if(_.isUndefined(state_map)) {
			state_map = cjs.create("map");
			state_map.defer_invalidation(true);
			statemap_was_undefined = true;
		}

		var new_statechart = new Statechart(this.get_type(), true);

		if(_.has(window, "red")) {
			red._set_constraint_descriptor(new_statechart._states._keys, "State keys " + new_statechart.id + " shadowing " + this.id);
			red._set_constraint_descriptor(new_statechart._states._values, "State values " + new_statechart.id + " shadowing " + this.id);
			red._set_constraint_descriptor(new_statechart._transitions, "Transitions " + new_statechart.id + " shadowing " + this.id);
			red._set_constraint_descriptor(new_statechart._$complete_state, "$complete_state " + new_statechart.id + " shadowing " + this.id);
			red._set_constraint_descriptor(new_statechart._$local_state, "$local_state " + new_statechart.id + " shadowing " + this.id);
		}

		//new_statechart._states.defer_invalidation(true);
		//new_statechart._transitions.defer_invalidation(true);
		new_statechart.defer_invalidation(true);
		new_statechart.set_basis(this);
		state_map.set(this, new_statechart);
		var substates_names = this.get_substate_names();
		for(var i = 0; i<substates_names.length; i++) {
			var substate_name = substates_names[i];
			var substate = this.get_state_with_name(substate_name);
			new_statechart.add_state(substate_name, substate.clone(parent, context, state_map));
		}

		var transitions = this.get_transitions();
		for(var i = 0; i<transitions.length; i++) {
			var transition = transitions[i];
			var from = state_map.get(transition.from());
			var to = state_map.get(transition.to());

			var event = transition.get_event();
			var cloned_event;
			if(event.type === "init") {
				cloned_event = event.clone(parent, context, state_map.get(event.statechart));
			} else if(event.type === "on_enter" || event.type === "on_exit") {
				cloned_event = event.clone(parent, context, state_map.get(event.state));
			} else {
				cloned_event = event.clone(parent, context, this);
			}

			new_statechart.add_transition(from, to, cloned_event);
			var cloned_transition = new_statechart.get_last_transition();
			cloned_transition.set_basis(transition);
		}
		
		new_statechart.defer_invalidation(false);


		return new_statechart;
	};

	proto.reset = function() {
		this.stop();
		this.run();
	};
	proto.stop = function() {
		this._states.forEach(function(state) {
			state.stop();
		});
		if(this.is_running()) {
			this._running = false;

			if(this.get_type() !== "pre_init") {
				this._set_state(this.get_state_with_name("_pre_init"), {
					type: "reset"
				});
			}
		}
	};

	proto._on = function(event_type, func) {
		var listeners;
		if(_.has(this._listeners, event_type)) {
			listeners = this._listeners[event_type];
		} else {
			this._listeners[event_type] = listeners = [];
		}
		listeners.push(func);
		return this;
	};
	proto._off = function(event_type, func) {
		var listeners = this._listeners[event_type];
		this._listeners[event_type] = _.without(this._listeners[event_type], func);
		if(_.isEmpty(this._listeners[event_type])) {
			delete this._listeners[event_type];
		}
		return this;
	};
	proto._once = function(event_type, func) {
		var self = this;
		var listener = function() {
			var rv = func.apply(this, arguments);
			self._off(event_type, func);
			return rv;
		};
		this._on(event_type, listener);
		return listener;
	};
	proto._notify = function(event_type, event) {
		var listeners = this._listeners[event_type];
		_.forEach(listeners, function(func) {
			func(event);
		});
		return this;
	};

	var bind = function(func) {
		var bind_args = _.toArray(_.rest(arguments));
		var rv = function() {
			var args = bind_args.concat(_.toArray(arguments));
			return func.apply(this, args);
		};
		return rv;
	};
	proto.when = function(spec_str, callback) {
		var selector;
		if(_.isString(spec_str)) {
			selector = this.parse_selector(spec_str);
		} else {
			selector = spec_str;
		}
		var listener = new StateListener(selector, callback);
		this._on("when", listener);
		return this;
	};
	proto.off_when = function(spec, func) {
		var to_remove_listeners = _.filter(this._listeners.when, function(listener) {
			return listener.callback === func;
		});
		var self = this;
		_.forEach(to_remove_listeners, function(listener) {
			self._off("when", listener);
		});
		return this;
	};
	proto.on_enter = bind(proto._on, "enter");
	proto.off_enter = bind(proto._off, "enter");
	proto.once_enter = bind(proto._once, "enter");
	proto.on_exit = bind(proto._on, "exit");
	proto.off_exit = bind(proto._off, "exit");
	proto.once_exit = bind(proto._once, "exit");
	proto.parse_selector = function(spec_str) {
		var selector = parse_spec(spec_str);
		if(selector === null) {
			throw new Error("Unrecognized format for state/transition spec. Please see documentation.");
		}
		return selector;
	};
	proto.stringify = function(tab_level, punctuation) {
		var name_spacing = 15;
		var rv = "";
		if(!_.isString(punctuation)) { punctuation = ""; }
		if(!_.isNumber(tab_level)) { tab_level = 0; }
		_.times(tab_level, function() {
			rv += "    ";
		});
		var name = punctuation + this.id + ": " + this.get_name(this.parent());
		rv += name;
		_.times(Math.max(1, name_spacing - name.length), function() {
			rv += " ";
		});
		rv += _.map(this.transitions_from(this), function(transition) {
			var to = transition.to().get_name();
			var event = transition.get_event();
			return event.type + " -(" + transition.stringify() + ")-> " + to;
		}).join(", ");
		var self = this;
		_.forEach(this.get_substates(), function(substate) {
			rv += "\n";
			var punctuation = "";
			if(self.is_concurrent()) {
				punctuation = "| ";
			} else if(self.is(substate)) {
				punctuation = "* ";
			}
			rv += substate.stringify(tab_level + 1, punctuation);
		});
		return rv;
	};
	proto.local_transitions_from = function(state) {
		return this._transitions.filter(function(transition) {
			return transition.from() === state;
		});
	};
	proto.local_transitions_to = function(state) {
		return this._transitions.filter(function(transition) {
			return transition.to() === state;
		});
	};
	proto.local_transitions_involving = function(state) {
		return this._transitions.filter(function(transition) {
			return transition.involves(state);
		});
	};
	proto.transitions_from = function(state) {
		var root = this.get_root();
		return root._do_transitions_from(state);
	};
	proto._do_transitions_from = function(state) {
		var rv = this.local_transitions_from(state);
		return rv.concat(_.flatten(_.map(this.get_substates(), function(substate) {
			return substate._do_transitions_from(state);
		})));
	};
	proto.transitions_to = function(state) {
		var root = this.get_root();
		return root._do_transitions_to(state);
	};
	proto._do_transitions_to = function(state) {
		var rv = this.local_transitions_to(state);
		return rv.concat(_.flatten(_.map(this.get_substates(), function(substate) {
			return substate._do_transitions_to(state);
		})));
	};
	proto.transitions_involving = function(state) {
		var root = this.get_root();
		return root._do_transitions_involving(state);
	};
	proto._do_transitions_involving = function(state) {
		var rv = this.local_transitions_involving(state);
		return rv.concat(_.flatten(_.map(this.get_substates(), function(substate) {
			return substate._do_transitions_involving(state);
		})));
	};
	proto.get_root = function() {
		var rv = this;
		var parent = rv.parent();
		while(parent) {
			rv = parent;
			parent = parent.parent();
		}
		return rv;
	};
}(Statechart));

var create_statechart = function() {
	return new Statechart();
};
cjs.statechart = create_statechart;
cjs.define("statechart", cjs.statechart);
cjs.is_statechart = function(obj) {
	return obj instanceof Statechart;
};

}(cjs));
