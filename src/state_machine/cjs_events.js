	var CJSEvent = function(parent, filter, onAddTransition) {
		this._do_transition = false;
		this._listeners = [];
		this._transitions = [];
		this._on_add_transition = onAddTransition;
		if(parent) {
			parent._listeners.push({event:this, filter: filter});
		}
	};

	(function(my) {
		var proto = my.prototype;
		proto.guard = function(filter) {
			return new CJSEvent(this, filter);
		};
		proto._addTransition = function(transition) {
			this._transitions.push(transition);
			if(this._on_add_transition) {
				this._on_add_transition(transition);
			}
		};
		proto._fire = function() {
			var args = arguments;
			each(this._transitions, function(transition) {
				transition.apply(transition, args);
			});
			each(this._listeners, function(listener_info) {
				var listener = listener_info.event,
					filter = listener_info.filter;

				if(!filter || filter.apply(root, args)) {
					listener._fire.apply(listener, args);
				}
			});
		};
	}(CJSEvent));

	cjs.on = function(event_type, target) {
		var rv;
		if(event_type === "timeout") {
			rv = new CJSEvent(false, false, function(transition) {
				var fsm = transition.getFSM();
				var from = transition.getFrom();
				var selector = new StateSelector(from);
				var curr_timeout_id = false;
				var on_selector = function() {
					if(curr_timeout_id) {
						root.clearTimeout(curr_timeout_id);
					}
					curr_timeout_id = root.setTimeout(function() {
						curr_timeout_id = false;
						transition.run();
					}, target);
				};
				fsm.on(selector, on_selector);
				if(fsm.is(from)) {
					on_selector();
				}
			});
		} else {
			rv = new CJSEvent();
			target.addEventListener(event_type, bind(rv._fire, rv));
		}

		return rv;
	};
