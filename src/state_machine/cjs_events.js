	var CJSEvent = function(parent, filter) {
		this._do_transition = false;
		this._listeners = [];
		if(parent) {
			parent._listeners.push(this);
		}
	};

	(function(my) {
		var proto = my.prototype;
		proto.guard = function(filter) {
			return new CJSEvent(this, filter);
		};
		proto._setTransitionFN = function(do_transition, fsm) {
			this._do_transition = do_transition;
		};
		proto._fire = function() {
			var args = arguments;
			if(this._do_transition) {
				this._do_transition.apply(this, args);
			}
			each(this._listeners, function(listener) {
				listener._fire.apply(listener, args);
			});
		};
	}(CJSEvent));

	cjs.on = function(event_type, target) {
		var rv = new CJSEvent();

		if(event_type === "timeout") {
		} else if(event_type === "interval") {
		} else if(event_type === "frame") {
		} else {
			target.addEventListener(event_type, bind(rv._fire, rv));
		}

		return rv;
	};
