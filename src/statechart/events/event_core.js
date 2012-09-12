(function(cjs) {
var _ = cjs._;

var CJSEvent = function() {
	this._initialize();
	this.on_create.apply(this, arguments);
};

(function(my) {
	var proto = my.prototype;
	proto._initialize = function() {
		this.listeners = [];
		this.fire = _.bind(this._fire, this);
	};
	proto.on_create = function() {};
	proto.on_fire = proto.add_listener = function(listener) {
		this.listeners.push(listener);
	};
	proto.off_fire = proto.remove_listener = function(listener) {
		this.listeners = _.without(listener);
	};
	proto._fire = function() {
		var args = arguments;
		_.forEach(this.listeners, function(listener) {
			listener.apply(this, args);
		});
	};
	proto.guard = function(func) {
		var new_event = new RedEvent();
		this.on_fire(function() {
			if(func.apply(this, arguments)) {
				new_event.fire.apply(new_event, arguments);
			}
		});
		return new_transition;
	};
	proto.clone = function() {
		return new RedEvent();
	};
	proto.destroy = function(){};
}(CJSEvent));

var event_types = {};

cjs.create_event = function(event_type) {
	var Constructor = event_types[event_type];

	var rv = new Constructor();
	rv.on_create.apply(rv, _.rest(arguments));
	rv.type = event_type;
	return rv;
};

cjs._create_event_type = function(name) {
	var Constructor = function() {
		this._initialize();
	};
	_.proto_extend(Constructor, CJSEvent);
	event_types[name] = Constructor;
	return Constructor;
};

}(cjs));
