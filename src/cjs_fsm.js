(function(cjs) {
var _ = cjs._;

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
}(StateSelector));

var AnyStateSelector = function() { };
(function(my) {
	var proto = my.prototype;
	proto.matches = function(state) {return state instanceof State;};
}(MultiStateSelector));

var TransitionSelector = function(pre, from_state_selector, to_state_selector) {
	this.is_pre = pre;
	this.from_state_selector = from_state_selector;
	this.to_state_selector = to_state_selector;
};
(function(my) {
	var proto = my.prototype;
	proto.matches = function(transition) {
		if(transition instanceof Transition) {
			var from_state = transition.get_from();
			var to_state = transition.get_to();
			return this.from_state_selector.matches(from_state) &&
					this.to_state_selector.matches(to_state);
		} else { return false; }
	};
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
}(MultiSelector));

var parse_single_state_spec = function(str) {
	if(str === "*") {
		return new AnyStateSelector();
	} else {
		return new StateSelector(str);
	}
};
var parse_state_list_spec = function(str) {
	var state_spec_strs = str.split(",");
	var state_specs = _.map(state_spec_strs, function(state_spec_str) {
		return parse_simple_state_spec(state_spec_str);
	});
	return new MultiSelector(
};

var parse_state_spec = function(str) {
};

var parse_simple_transiton_spec = function(left_str, transition_str, right_str) {
	var left_state_spec = parse_state_spec(left_str);
	var right_state_spec = parse_state_spec(right_str);

	if(transition_str === "<->") {
		var left_to_right_transition = new TransitionSelector(false, left_state_spec, right_state_spec);
		var right_to_left_transition = new TransitionSelector(false, right_state_spec, left_state_spec);
		return new MultiSelector(left_to_right_transition, right_to_left_transition);
	} else if(transition_str === ">-<") {
		var left_to_right_transition;
		var right_to_left_transition;
	} else if(transition_str === "->") {
	} else if(transition_str === ">-") {
	} else if(transition_str === "<-") {
	} else if(transition_str === "-<") {
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
	proto.interested_in = function(obj) {
		return this.selector.matches(obj);
	};
	proto.run = function() {
		this.callback();
	};
}(StateListener));



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
		args.unshift(this.get_to());
		this.fsm.set_state.apply(this.fsm);
	};
}(Transition));

var FSM = function() {
	//this.graph = cjs.create("graph");
	this.states = [];
	this.transitions = [];
	this.state = null;
	this.listeners = [];
	this.chain_state = null;
	this.did_transition = false;
};
(function(my) {
	var proto = my.prototype;
	proto.create_state = function(state_name) {
		var state = new State(this, state_name);
		this.states.push(state);
		return state;
	};
	proto.add_state = function() {
		var state = this.create_state.apply(this, arguments);

		if(this.state === null) { this.state = state; }
		this.chain_state = state;
		return this;
	};
	proto.state_with_name = function(state_name) {
		var index = _.index_where(this.states, function(state) {
			return state.get_name() === state_name;
		});
		if(index >= 0) {
			return this.states[index];
		} else {
			return null;
		}
	};
	proto.get_state = function() {
		return this.state;
	};
	proto.add_transition = function(add_transition_fn, to_state_name) {
		var from_state = this.chain_state;
		var to_state = this.state_with_name(to_state_name);
		if(to_state === null) { to_state = this.create_state(to_state_name); }

		var transition = new Transition(this, from_state, to_state);
		var self = this;
		var do_transition = _.bind(function() {
			if(self.get_state() === from_state) {
				transition.run();
			}
		}, transition);
		add_transition_fn.call(this, do_transition, from_state, to_state, this);

		this.transitions.push(transition);
		return this;
	};
	proto.set_state = function(state) {
		var from_state = this.get_state();
		var to_state = state;
		did_transition = true;

		_.forEach(this.listeners, function(listener) {
			listener({
				type: "pre"
				, from: from_state
				, to: to_state
			});
		});
		this.state = to_state;
		_.forEach(this.listeners, function(listener) {
			listener({
				type: "post"
				, from: from_state
				, to: to_state
			});
		});

	};
	proto.destroy = function() {
		//this.graph.destroy();
		delete this.states;
		delete this.transitions;
		delete this.staet;
		//delete this.graph;
	};
	proto.starts_at = function(state_name) {
		var state = this.state_with_name(state_name);
		if(!this.did_transition) { state = this.create_state(state_name); }
		this.state = state;
		return this;
	};
	proto.is = function(state_name) {
		var state = this.get_state();
		if(state === null) { return false; }
		else { return state.get_name() === state_name; }
	};
}(FSM));

var create_fsm = function() {
	return new FSM();
};
cjs.fsm = create_fsm;

}(cjs));
