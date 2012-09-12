(function(cjs) {
var _ = cjs._;

(function(proto) {
	proto.on_create = function(statechart) {
		this.statechart = statechart;
		statechart._on("run", _.bind(this.do_transition, this));
	};
	proto.do_transition = function() {
		this.fire({
			type: "init"
		});
	};
	proto.clone = function (parent, context, sc) {
		return cjs.create_event("init", sc);
	};
}(cjs._create_event_type("init").prototype));

(function(proto) {
	proto.on_create = function(state) {
		this.state = state;
		this.state.on_enter(_.bind(this.do_transition, this));
	};
	proto.do_transition = function() {
		this.fire({
			type: "on_enter"
			, state: this.state
		});
	};
	proto.clone = function (parent, context, sc) {
		return cjs.create_event("on_enter", this.state);
	};
}(cjs._create_event_type("on_enter").prototype));

(function(proto) {
	proto.on_create = function(state) {
		this.state = state;
		this.state.on_exit(_.bind(this.do_transition, this));
	};
	proto.do_transition = function() {
		this.fire({
			type: "on_exit"
			, state: this.state
		});
	};
	proto.clone = function (parent, context, sc) {
		return red.create_event("on_exit", this.state);
	};
}(cjs._create_event_type("on_exit").prototype));

}(cjs));
