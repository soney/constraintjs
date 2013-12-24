/**
 * Creates an event that can be used in a finite-state machine transition
 * @private
 * @class cjs.CJSEvent
 * @classdesc A constraint object communicates with the constraint solver to store and maintain constraint values
 */
var CJSEvent = function(parent, filter, onAddTransition, onRemoveTransition) {
	this._listeners = []; // parent events that want to know when I fire
	this._transitions = []; // a list of transitions that I'm attached to
	this._on_add_transition = onAddTransition; // optional listener for when a transition is added
	this._on_remove_transition = onRemoveTransition; // optional listener for when a transition is removed
	this._live_fns = {}; // one per transitions
	if(parent) {
		parent._listeners.push({event:this, filter: filter}); // add an item to my parent's listener if i have a parent
	}
};

(function(my) {
	/** @lends cjs.CJSEvent.prototype */
	var proto = my.prototype;

	/**
	 * Create a transition that calls filter whenever it fires to ensure that it should fire
	 *
	 * @method guard
	 * @param {function} [filter] - Returns `true` if the event should fire and false otherwise
	 * @return {CJSEvent} A new event that only fires when `filter` returns a truthy value
	 */
	proto.guard = function(filter) {
		return new CJSEvent(this, filter);
	};

	/**
	 * Add a transition to my list of transitions that this event is attached to
	 *
	 * @private
	 * @method _addTransition
	 * @param {Transition} transition - The transition this event is attached to
	 */
	proto._addTransition = function(transition) {
		this._transitions.push(transition);
		if(this._on_add_transition) {
			this._live_fns[transition.id()] = this._on_add_transition(transition);
		}
	};

	/**
	 * Remove a transition from my list of transitions
	 *
	 * @private
	 * @method _removeTransition
	 * @param {Transition} transition - The transition this event is attached to
	 */
	proto._removeTransition = function(transition) {
		if(remove(this._transitions, transition)) {
			if(this._on_remove_transition) {
				this._on_remove_transition(transition);
			}

			// clear the live fn
			var tid = transition.id();
			this._live_fns[tid].destroy();
			delete this._live_fns[tid];
		}
	};

	/**
	 * When I fire, go through every transition I'm attached to and fire it then let any interested listeners know as well
	 *
	 * @private
	 * @method _fire
	 * @param {...*} events - Any number of events that will be passed to the transition
	 */
	proto._fire = function() {
		var events = arguments;
		each(this._transitions, function(transition) {
			transition.run.apply(transition, events);
		});
		each(this._listeners, function(listener_info) {
			var listener = listener_info.event,
				filter = listener_info.filter;

			if(!filter || filter.apply(root, events)) {
				listener._fire.apply(listener, events);
			}
		});
	};
}(CJSEvent));
/** @lends */

var isElementOrWindow = function(elem) { return elem === root || isElement(elem); },
	do_trim = function(x) { return x.trim(); },
	split_and_trim = function(x) { return map(x.split(" "), do_trim); },
	timeout_event_type = "timeout";

extend(cjs, {
	/** @expose cjs.CJSEvent */
	CJSEvent: CJSEvent,
	/**
	 * Create a new event for use in a finite state machine transition
	 *
	 * @constructs CJSEvent
	 * @method cjs.on
	 * @param {string} event_type - the type of event to listen for (e.g. mousedown, timeout)
	 * @param {...element|number} [target=window] - Any number of target objects to lisen to
	 * @return {CJSEvent} - An event that can be attached to 
	 */
	on:	function(event_type) {
			var rest_args = arguments.length > 1 ? rest(arguments) : root,
				// no parent, no filter by default
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
								// If the event is 'timeout'
								if(event_type === timeout_event_type) {
									// clear the previous timeout
									if(timeout_id) {
										cTO(timeout_id);
										timeout_id = false;
									}

									// and set a new one
									var delay = cjs.get(rest_args[0]);
									if(!isNumber(delay) || delay < 0) {
										delay = 0;
									}

									timeout_id = sTO(listener, delay);
								} else {
									each(targets, function(target) {
										// otherwise, add the event listener to every one of my targets
										target.addEventListener(event_type, listener);
									});
								}
							});
						},
						off_listener = function() {
							each(event_type_val, function(event_type) {
								each(targets, function(target) {
									if(event_type === timeout_event_type) {
										// If the event is 'timeout'
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
							// only use DOM elements (or the weindow) as my target
							targets = filter(get_dom_array(rest_args), isElementOrWindow);

							// when entering the state, add the event listeners, then remove them when leaving the state
							fsm	.on(state_selector, on_listener)
								.on(from_state_selector, off_listener);

							if(fsm.is(from)) {
								// if the FSM is already in the transition's starting state
								on_listener();
							}
						});
					return live_fn;
				});
			return event;
		}
});
