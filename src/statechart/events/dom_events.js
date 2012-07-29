(function(cjs) {
var _ = cjs._;

(function(proto) {
	proto.on_create = function(type, target) {
		this.type = type; this.target = target;
		target.addEventListener(type, _.bind(this.fire, this));
	};
	proto.clone = function() {
		return red.create_event("dom_event", this.type, this.target);
	};
}(cjs._create_event_type("dom_event").prototype));
}(cjs));
