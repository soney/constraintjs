(function(cjs) {
var _ = cjs._;

var State = function(fsm, name) {
	this._name = name;
	this.fsm = fsm;
	//var graph = this.fsm.get_graph();
	//this.node = graph.create_node();
};

(function(my) {
	var proto = my.prototype;
	proto.get_name = function() { return this._name; };
	proto.get_node = function() { return this.node; };
}(State));

var Transition = function(fsm, from_state, to_state, name) {
	this.fsm = fsm;
	this.from = from_state;
	this.to = to_state;
	this.name = name;

	//var graph = this.fsm.get_graph();
	//this.edge = graph.addEdge(this.get_from().get_node(), this.get_to().get_node());
};
(function(my) {
	var proto = my.prototype;
	proto.get_from = function() { return this.from; };
	proto.get_to = function() { return this.to; };
	proto.get_name = function() { return this.name; };
	proto.run = function() {
		var args = _.toArray(arguments);
		args.unshift(this);
		args.unshift(this.get_to());
		this.fsm.set_state.apply(this.fsm, args);
	};
}(Transition));

var StateSelector = function(state_name) {
	this.state_name = state_name;
};
(function(my) {
	var proto = my.prototype;
	proto.matches = function(state) {
		if(state instanceof State) {
			return this.state_name === state.get_name();
		} else { return false; }
	};
	proto.is = function(str) { return str === "state"; };
}(StateSelector));

var AnyStateSelector = function() { };
(function(my) {
	var proto = my.prototype;
	proto.matches = function(state) {return state instanceof State;};
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
		if(transition instanceof Transition) {
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
	var transition_separator_regex = new RegExp("^([a-zA-Z0-9,\\-*]+)((<->|>-<|->|>-|<-|-<)([a-zA-Z0-9,\\-*]+))?$");
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
		return this.selector.matches.apply(this.selector, arguments);
	};
	proto.run = function() {
		this.callback();
	};
}(StateListener));

var FSM = function() {
	//this.graph = cjs.create("graph");
	this.states = [];
	this.transitions = [];
	this._state = null;
	this.listeners = [];
	this.chain_state = null;
	this.did_transition = false;

	this.state = cjs.create("constraint", _.bind(function() {
		if(this._state) {
			return this._state.get_name();
		} else {
			return null;
		}
	}, this));
};
(function(my) {
	var proto = my.prototype;
	proto.create_state = function(state_name) {
		var state = new State(this, state_name);
		this.states.push(state);
		return state;
	};
	proto.add_state = function(state_name) {
		var state = this.state_with_name(state_name);
		if(state === null) {
			state = this.create_state.apply(this, arguments);
			if(this.get_state() === null) { this._state = state; }
		}

		this.chain_state = state;
		return this;
	};
	proto.state_with_name = function(state_name) {
		var rv = _.find(this.states, function(state) {
			return state.get_name() === state_name;
		});
		if(rv === undefined) { return null; }
		else { return rv; }
	};
	proto.get_state = function() {
		return this._state;
	};
	proto.add_transition = function(add_transition_fn, to_state_name) {
		var from_state = this.chain_state;
		var to_state = this.state_with_name(to_state_name);
		if(to_state === null) { to_state = this.create_state(to_state_name); }

		var transition = new Transition(this, from_state, to_state);
		var self = this;
		var do_transition = function() {
			if(self.is(from_state)) {
				var args = _.toArray(arguments);
				transition.run.apply(transition, args);
			}
		};
		add_transition_fn.call(this, do_transition, from_state, to_state, this);

		this.transitions.push(transition);
		return this;
	};
	proto.set_state = function(state, transition) {
		var from_state = this.get_state();
		var to_state = state;
		this.did_transition = true;

		_.forEach(this.listeners, function(listener) {
			if(listener.interested_in(transition, true)) {
				listener.run(transition, to_state, from_state);
			}
		});
		this._state = to_state;
		this.state.nullify();
		_.forEach(this.listeners, function(listener) {
			if(listener.interested_in(transition, false)) {
				listener.run(transition, to_state, from_state);
			}
			if(listener.interested_in(to_state)) {
				listener.run(transition, to_state, from_state);
			}
		});
	};
	proto.destroy = function() {
		//this.graph.destroy();
		delete this.states;
		delete this.transitions;
		delete this._state;
		//delete this.graph;
	};
	proto.starts_at = function(state_name) {
		var state = this.state_with_name(state_name);
		if(state === null) {
			state = this.create_state(state_name);
		}
		if(!this.did_transition) {
			this._state = state;
		}
		return this;
	};
	proto.is = function(state_name) {
		var state = this.get_state();
		if(state === null) { return false; }
		else {
			if(_.isString(state_name)) {
				return state.get_name() === state_name;
			} else {
				return state === state_name;
			}
		}
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
	proto.parse_selector = function(spec_str) {
		var selector = parse_spec(spec_str);
		if(selector === null) {
			throw new Error("Unrecognized format for state/transition spec. Please see documentation.");
		}
		return selector;
	};
}(FSM));

var create_fsm = function() {
	return new FSM();
};
cjs.fsm = create_fsm;
cjs.define("fsm", cjs.fsm);
}(cjs));
