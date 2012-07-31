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
}(StatechartTransition));

var StateSelector = function(state_name) {
	this.state_name = state_name;
};
(function(my) {
	var proto = my.prototype;
	proto.matches = function(state) {
		return state.matches(this.state_name);
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
			var from_state = transition.get_from();
			var to_state = transition.get_to();
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
	var transition_separator_regex = new RegExp("^([a-zA-Z0-9,\\-*\\.]+)((<->|>-<|->|>-|<-|-<)([a-zA-Z0-9,\\-*\\.]+))?$");
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

var Statechart = function(type) {
	this._running = false;
	this.transitions = [];
	this._states = cjs.create("map");
	
	this._starts_at = undefined;
	this._parent = undefined;
	this._concurrent = false;
	this._active_state = undefined;
	this.listeners = [];
	this._type = _.isUndefined(type) ? "statechart" : type;
	if(this.get_type() !== "pre_init") {
		this.add_state("_pre_init", "pre_init");
		this._active_state = this.get_state_with_name("_pre_init");
	}
	this._context = undefined;
	this.id = _.uniqueId();
};
(function(my) {
	var proto = my.prototype;
	proto.get_context = function() { return this._context; };
	proto.set_context = function(context) { this._context = context; return this; };
	proto.get_type = function() {
		return this._type;
	};
	proto.add_state = function(state_name, type) {
		var state_names = _.isArray(state_name) ? state_name : state_name.split(".");

		if(_.size(state_names) === 1) {
			state_name = _.last(state_names);

			if(this.has_state(state_name)) {
				this.remove_state(this.get_state_with_name(state_name));
			}


			var state = type instanceof Statechart ? type : new Statechart(type);
			state.set_parent(this);
			this._states.set(state_name, state);
		} else {
			var first_state_name = _.first(state_names);
			var state = this.get_state_with_name(first_state_name);
			if(_.isNull(state)) {
				this.add_state(first_state_name);
				state = this.get_state_with_name(first_state_name);
			}

			state.add_state(_.rest(state_names), type);
		}

		return this;
	};
	proto.remove_state = function(state) {
		var transitions_involving_state = [];
		var transitions_not_involving_state = [];
		_.forEach(this.transitions, function(transition) {
			if(transition.involves(state)) {
				transitions_involving_state.push(transition);
			} else {
				transitions_not_involving_state.push(transition);
			}
		});
		this.transitions = transitions_not_involving_state;
		this._states.unset(state);
		return this;
	};
	proto.has_state = function(state_name) {
		return !_.isUndefined(this.get_state_with_name(state_name));
	};
	proto.in_state = function(state_name) {
		return this.get_state_with_name(state_name);
	};
	proto.starts_at = function(state_name) {
		var pre_init_state = this._find_state("_pre_init");
		this.add_transition(pre_init_state, state_name, cjs.create_event("init", this));
		return this;
	};
	proto.remove_transition = function(transition) {
		transition.destroy();
		this.transitions = _.without(this.transitions, transition);
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
			if(!_.isUndefined(this._active_state)) {
				this._active_state.run();
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
	proto.get_state = function() {
		if(this._concurrent) {
			var active_states = this._states.map(function(state) {
				return state.get_state();
			}).to_obj();
			var rv = [];
			return rv.concat.apply(rv, active_states);
		} else {
			if(this.is_atomic()) {
				return [];
			}

			var active_state = this._active_state;
			if(active_state.get_type() === "pre_init") {
				return [active_state];
			} else {
				var rv = [active_state];
				return rv.concat(active_state.get_state());
			}
		}
	};
	proto.get_state_names = function() {
		return _.map(this.get_state(), function(state) {
			return state.get_name();
		});
	};
	proto._set_state = function(state, event) {
		var states_left = [];
		var states_entered = [];
		var curr_state = this._active_state;

		while(!_.isUndefined(curr_state) && curr_state !== this) {
			states_left.push(curr_state);
			curr_state = curr_state.parent();
		}

		curr_state = this._active_state;

		while(!_.isUndefined(curr_state) && curr_state !== this) {
			states_entered.push(curr_state);
			curr_state = curr_state.parent();
		}

		_.forEach(states_left, function(state) {
			state._notify("exit", event);
		});
		this._active_state = state;
		if(!this._active_state.is_running()) {
			this._active_state.run();
		}
		_.forEach(states_entered, function(state) {
			state._notify("enter", event);
		});
	};
	proto._run_transition = function(transition, event) {
		var from_state = transition.from()
			, to_state = transition.to();
		_.forEach(this.listeners, function(listener) {
			if(listener.interested_in(transition, true)) {
				listener.run(event, transition, to_state, from_state);
			}
		});
		console.log(to_state);
		this._set_state(to_state, event);
		_.forEach(this.listeners, function(listener) {
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

		if(this._concurrent) {
			return this._states.any(function(state) {
				return state.is(state);
			});
		} else {
			if(_.isUndefined(this._active_state)) {
				return false;
			} else {
				return this._active_state.is(state);
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
		this.transitions.push(transition);
		return transition;
	};

	proto.add_transition = function() {
		var from_state, to_state, event;
		if(arguments.length >=3)  {
			from_state = arguments[0];
			to_state = arguments[1];
			event = arguments[2];
		} else {
			from_state = this;
			to_state = arguments[0];
			event = arguments[1];
		}

		var transition = this._get_transition(from_state, to_state, event);
		
		return this;
	};
	proto.get_transitions = function() {
		return _.clone(this.transitions);
	};

	proto.name_for_state = function(state) {
		return this._states.key_for_value(state);
	};

	proto.get_name = function(relative_to) {
		var parent = this.parent();
		if(!relative_to) {
			relative_to = parent;
		}

		while(!_.isUndefined(parent)) {
			var parent_name = parent.get_name();
			var my_name = parent.name_for_state(this);
			if(parent_name.length === 0) {
				return my_name;
			} else {
				return parent_name + "." + my_name;
			}
		}
		return "";
	};

	proto.matches = function(state) {
		if(state instanceof Statechart) {
			return this === state;
		} else if(_.isString(Statechart)) {
			var parent = this.parent();
			var name = "";
			while(!_.isUndefined(parent)) {
				name = this.get_name(parent);

				if(name === state) {
					return true;
				}
				
				parent = parent.parent();
			}
			return false;
		} else {
			return false;
		}
	};

	proto.get_substates = function() {
		var state_names = this._states.get_keys();
		if(state_names.length === 1) {
			return [];
		} else {
			return state_names;
		}
	};

	proto.is_atomic = function() {
		return _.isEmpty(this.get_substates());
	};

	proto.clone = function(context, state_map) {
		if(_.isUndefined(state_map)) {
			state_map = red._create_map();
		}

		var new_statechart = new RedStatechart(this.get_type());
		state_map.set(this, new_statechart);
		var substates_names = this.get_substates();
		for(var i = 0; i<substates_names.length; i++) {
			var substate_name = substates_names[i];
			var substate = this.get_state_with_name(substate_name);
			new_statechart.add_state(substate_name, substate.clone(context, state_map));
		}

		var transitions = this.get_transitions();
		for(var i = 0; i<transitions.length; i++) {
			var transition = transitions[i];
			var from = state_map.get(transition.from());
			var to = state_map.get(transition.to());

			var event = transition.get_event().clone(this);

			new_statechart.add_transition(from, to, event);
		}
		
		return new_statechart;
	};

	proto.on = proto.addEventListener = function(spec_str, callback) {
		var selector;
		if(_.isString(spec_str)) {
			selector = this.parse_selector(spec_str);
		} else {
			selector = spec_str;
		}
		var listener = new StateListener(selector, callback);
		this.listeners.push(listener);
		return this;
	};
	proto.off = proto.removeEventListener = function(listener_callback) {
		this.listeners = _.reject(this.listeners, function(listener) {
			return listener.callback === listener_callback;
		});
		return this;
	};


/*
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
	proto.when = function(spec, func) {
		var listener = parse_spec(spec, func);

	};
	proto.when = bind(proto._on, "when");
	proto.off_when = bind(proto._off, "when");
	proto.on_enter = bind(proto._on, "enter");
	proto.off_enter = bind(proto._off, "enter");
	proto.once_enter = bind(proto._once, "enter");
	proto.on_exit = bind(proto._on, "exit");
	proto.off_exit = bind(proto._off, "exit");
	proto.once_exit = bind(proto._once, "exit");
	*/
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
