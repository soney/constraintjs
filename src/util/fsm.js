(function(cjs) {

var State = function(name) {
	this._name = name;
};

(function(my) {
	var proto = my.prototype;

}(State));

var create_state = function(name) {
	return new State(name);
};

var Transition = function(from_state, to_state) {
	this.from = from_state;
	this.to = to_state;
};
(function(my) {
	var proto = my.prototype;

}(Transition));

var create_transition = function(from_state, to_state) {
	return new Transition(from_state, to_state);
};

var FSM = function() {
	this.states = [];
	this.transitions = [];
};
(function(my) {
	var proto = my.prototype;
	proto.add_state = function() {
		var state = create_state.apply(this, arguments);
	};
	proto.add_transition = function() {
		var transition = create_transition.apply(this, arguments);
	};
}(FSM));


}(cjs));
