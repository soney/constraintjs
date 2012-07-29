(function(cjs) {
var _ = cjs._;

(function(proto) {
	proto.on_create = function(time) {
		this.time = time;
		var creation_time = (new Date()).getTime();
		var time_diff = this.time - creation_time;

		window.setTimeout(function() {
			self.fire({
				type: "at_time"
				, time: time
				, current_time: (new Date()).getTime()
				, created_at: creation_time
			});
		}, time_diff);
	};
	proto.clone = function(context) {
		return cjs.create_event("at_time", this.time);
	};
}(cjs._create_event_type("at_time").prototype));

(function(proto) {
	proto.on_create = function(delay) {
		this.delay = delay;
		this.created_at = (new Date()).getTime();
	};
	proto.on_ready = function() {
		var self = this;
		var from_state = this.transition.from_state;
		var timeout;
		var enter_listener = from_state.once_enter(function() {
			if(!_.isUndefined(timeout)) {
				window.clearTimeout(timeout);
				timeout = undefined;
			}
			timeout = window.setTimeout(_.bind(self.notify, self), self.delay);
		});

		from_state.on_exit(function() {
			if(!_.isUndefined(timeout)) {
				window.clearTimeout(timeout);
				timeout = undefined;
			}
			from_state.off(enter_listener);
		});
	};
	proto.notify = function() {
		this.fire({
			type: "timeout"
			, delay: this.delay
			, current_time: (new Date()).getTime()
			, created_at: this.created_at
		});
	};
	proto.clone = function(timeout) {
		return cjs.create_event("timeout", this.delay);
	};
}(cjs._create_event_type("timeout").prototype));

}(cjs));
