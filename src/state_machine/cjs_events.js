	var CJSEvent = function(parent, filter, onAddTransition, onRemoveTransition) {
		this._do_transition = false;
		this._listeners = [];
		this._transitions = [];
		this._on_add_transition = onAddTransition;
		this._on_remove_transition = onRemoveTransition;
		this._live_fns = {};
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
				this._live_fns[transition.id()] = this._on_add_transition(transition);
			}
		};
		proto._removeTransition = function(transition) {
			var index = indexOf(this._transitions, transition);
			if(index >= 0) {
				this._transitions.splice(index, 1);
				if(this._on_remove_transition) {
					this._on_remove_transition(transition);
				}
				var tid = transition.id();
				this._live_fns[tid].destroy();
				delete this._live_fns[tid];
			}
		};
		proto._fire = function() {
			var args = arguments;
			each(this._transitions, function(transition) {
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

	var isElementOrWindow = function(elem) { return elem === root || isElement(elem); },
		do_trim = function(x) { return x.trim(); },
		split_and_trim = function(x) { return map(x.split(" "), do_trim); },
		timeout_event_type = "timeout";

	cjs.on = function(event_type) {
		var rest_args = arguments.length > 1 ? slice.call(arguments, 1) : root,
			event = new CJSEvent(false, false, function(transition) {
				var targets = [],
					timeout_id = false,
					event_type_val = [],
					listener = bind(transition.run, transition),
					fsm = transition.getFSM(),
					from = transition.getFrom(),
					state_selector = new StateSelector(from),
					from_state_selector = new TransitionSelector(true, state_selector, new AnyStateSelector()),
					on_listener = function() {
						each(event_type_val, function(event_type) {
							if(event_type === timeout_event_type) {
								if(timeout_id) {
									cTO(timeout_id);
									timeout_id = false;
								}

								var delay = cjs.get(rest_args[0]);
								if(!isNumber(delay) || delay < 0) {
									delay = 0;
								}

								timeout_id = sTO(listener, delay);
							} else {
								each(targets, function(target) {
									target.addEventListener(event_type, listener);
								});
							}
						});
					},
					off_listener = function() {
						each(event_type_val, function(event_type) {
							each(targets, function(target) {
								if(event_type === timeout_event_type) {
									if(timeout_id) {
										cTO(timeout_id);
										timeout_id = false;
									}
								} else {
									target.removeEventListener(event_type, listener);
								}
							});
						});
					},
					live_fn = cjs.liven(function() {
						off_listener();

						event_type_val = split_and_trim(cjs.get(event_type));
						targets = filter(get_dom_array(rest_args), isElementOrWindow);

						fsm	.on(state_selector, on_listener)
							.on(from_state_selector, off_listener);
						if(fsm.is(from)) {
							on_listener();
						}
					});
				return live_fn;
			});
		return event;
	};
