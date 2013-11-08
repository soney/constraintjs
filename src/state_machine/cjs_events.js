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
				console.log(transition);
				transition.run.apply(transition, args);
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
				var fsm = transition.getFSM(),
					from = transition.getFrom(),
					selector = new StateSelector(from),
					curr_timeout_id = false,
					on_selector = function() {
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
			if(!target) { target = window; }

			var listener;

			rv = new CJSEvent(false, false, function(transition) {
				var fsm = transition.getFSM(),
					from = transition.getFrom(),
					state_selector = new StateSelector(from),
					from_state_selector = new TransitionSelector(true, state_selector, new AnyStateSelector()),
					on_selector = function() {
						target.addEventListener(event_type, listener);
					},
					off_selector = function() {
						target.removeEventListener(event_type, listener);
					};

				fsm	.on(state_selector, on_selector)
					.on(from_state_selector, off_selector);

				if(fsm.is(from)) {
					on_selector();
				}
			});
			listener = bind(rv._fire, rv);
		}

		return rv;
	};
