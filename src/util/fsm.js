(function(cjs) {
var _ = cjs._;
var Node = cjs.type("node");
var Edge = cjs.type("edge");

var State = function(fsm, name) {
	this._name = name;
	this.fsm = fsm;
	var graph = this.fsm.get_graph();
	this.node = graph.create_node();
};

(function(my) {
	var proto = my.prototype;
	proto.get_name = function() { return this._name; };
}(State));

var create_state = function(fsm, name) {
	return new State(fsm, name);
};

var Transition = function(fsm, from_state, to_state, name) {
	this.fsm = fsm;
	this.from = from_state;
	this.to = to_state;
	this.name = name;

	var graph = this.fsm.get_graph();
	this.node = graph.create_node();
};
(function(my) {
	var proto = my.prototype;
	proto.get_from = function() { return this.from; };
	proto.get_to = function() { return this.to; };
	proto.get_name = function() { return this.name; };

}(Transition));

var create_transition = function(fsm, from_state, to_state, name) {
	return new Transition(fsm, from_state, to_state, name);
};

var FSM = function() {
	this.graph = cjs.create("graph");
	this.states = [];
	this.transitions = [];
	this.state = null;
	this.listeners = [];
};
(function(my) {
	var proto = my.prototype;
	proto.add_state = function() {
		var args = _.toArray(arguments);
		args.unshift(this); // Push this to the beginning of the args
		var state = create_state.apply(this, args);
		this.states.push(state);
		return state;
	};
	proto.add_transition = function() {
		var args = _.toArray(arguments);
		args.unshift(this); // Push this to the beginning of the args
		var transition = create_transition.apply(this, args);
		this.transitions.push(transition);
		return transition;
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
	proto.set_state = function(state_name) {
		var from_state = this.get_state();
		var to_state = this.state_with_name(state_name);

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
		this.graph.destroy();
		delete this.states;
		delete this.transitions;
		delete this.staet;
		delete this.graph;
	};
	proto.get_graph = function() { return this.graph; };
}(FSM));

cjs.define("fsm", function() {
	return new FSM();
});

}(cjs));
