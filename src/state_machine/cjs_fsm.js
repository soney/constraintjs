// Finite State Machines
// ---------------------

// State keeps track of basic state information (its containing FSM does most of the work)
var State = function(fsm, name) {
	this._fsm = fsm; // parent fsm
	this._name = name; // state name (fetch with getName)
	this._id = uniqueId(); // useful for storage
};

(function(my) {
	var proto = my.prototype;
	proto.getName = function() { return this._name; }; // getter for name
	proto.id = function() { return this._id; }; // getter for id
}(State));

// Simple transition representation (again, the containing FSM does most of the work)
var Transition = function(fsm, from_state, to_state, name) {
	this._fsm = fsm; // parent FSM
	this._from = from_state; // from state (fetch with getFrom)
	this._to = to_state; // to state (fetch with getTo)
	this._name = name; // name (fetch with getName)
	this._id = uniqueId(); // useful for storage
	this._event = false; // the CJSEvent (if created) for this transition
};

(function(my) {
	var proto = my.prototype;
	proto.getFrom = function() { return this._from; }; // from getter
	proto.getTo = function() { return this._to; }; // to getter
	proto.getName = function() { return this._name; }; // name getter
	proto.getFSM = function() { return this._fsm; }; // FSM getter
	proto.id = function() { return this._id; }; // getter for id
	proto.destroy = function() {
		var ev = this._event;
		if(ev) { ev._removeTransition(this); }
		delete this._event;
		delete this._fsm;
		delete this._from;
		delete this._to;
	};
	proto.setEvent = function(event) { this._event = event; };
	proto.run = function() {
		var fsm = this.getFSM();
		// do_transition should be called by the user's code
		if(fsm.is(this.getFrom())) {
			var args = toArray(arguments);
			args.unshift(this.getTo(), this);
			fsm._setState.apply(fsm, args);
		}
	};
}(Transition));

/*
 * The following selector constructors are used internally to keep track of user-specified
 * selectors (a -> b represents the transition from a to b).
 * 
 * Developers using cjs can specify that they want to add listeners for any number of such
 * selectors and they will be dynamically evaluated and called. For instance, if the user
 * adds a selector for any state to stateA (represented as * -> stateA) *before* stateA is
 * created, then if the developer later adds a state named stateA, their callback should be
 * called whenever the fsm transitions to that newly created stateA
 */

// The selector for a state with a supplied name (e.g. stateA)
var StateSelector = function(state_name) {
	this._state_name = state_name;
};
(function(my) {
	var proto = my.prototype;
	proto.matches = function(state) {
		// Supplied object should be a State object with the given name
		return this._state_name === state || (state instanceof State && this._state_name === state.getName());
	};
}(StateSelector));

// Matches any state (e.g. *)
var AnyStateSelector = function() { };
(function(my) {
	var proto = my.prototype;
	// will match any state (but not transition)
	// Checking if it isn't a transition (rather than if it is a State) because sometimes, this is
	// checked against state *names* rather than the state itself
	proto.matches = function(state) { return !(state instanceof Transition);};
}(AnyStateSelector));

// Matches certain transitions (see transition formatting spec)
var TransitionSelector = function(pre, from_state_selector, to_state_selector) {
	this.is_pre = pre; // should fire before the transition (as opposed to after)
	this.from_state_selector = from_state_selector; // the selector for the from state (should be a StateSelector or AnyStateSelector)
	this.to_state_selector = to_state_selector; // selector for the to state
};
(function(my) {
	var proto = my.prototype;
	// Make sure that the supplied object is a transition with the same timing
	proto.matches = function(transition, pre) {
		if(transition instanceof Transition && this.is_pre === pre) { 
			var from_state = transition.getFrom();
			var to_state = transition.getTo();
			// And then make sure both of the states match as well
			return this.from_state_selector.matches(from_state) &&
					this.to_state_selector.matches(to_state);
		} else { return false; }
	};
}(TransitionSelector));

// Multiple possibilities (read OR, not AND)
var MultiSelector = function() {
	this.selectors = toArray(arguments); // all of the selectors to test
};
(function(my) {
	var proto = my.prototype;
	proto.matches = function() {
		var match_args = arguments;
		// See if any selectors match
		return any(this.selectors, function(selector) {
			return selector.matches.apply(selector, match_args);
		});
	};
}(MultiSelector));

// return a selector object from a string representing a single state
var parse_single_state_spec = function(str) {
	if(str === "*") {
		return new AnyStateSelector();
	} else {
		return new StateSelector(str);
	}
};

// Parse one side of the transition
var parse_state_spec = function(str) {
	// Split by , and remove any excess spacing
	var state_spec_strs = map(str.split(","), function(ss) { return trim(ss); }); 

	// The user only specified one state
	if(state_spec_strs.length === 1) {
		return parse_single_state_spec(state_spec_strs[0]);
	} else { // any number of states
		var state_specs = map(state_spec_strs, parse_single_state_spec);
		return new MultiSelector(state_specs);
	}
};

// The user specified a transition
var parse_transition_spec = function(left_str, transition_str, right_str) {
	var left_to_right_transition, right_to_left_transition;
	var left_state_spec = parse_state_spec(left_str);
	var right_state_spec = parse_state_spec(right_str);

	// Bi-directional, after transition
	if(transition_str === "<->") {
		left_to_right_transition = new TransitionSelector(false, left_state_spec, right_state_spec);
		right_to_left_transition = new TransitionSelector(false, right_state_spec, left_state_spec);
		return new MultiSelector(left_to_right_transition, right_to_left_transition);
	} else if(transition_str === ">-<") { // bi-directional, before transition
		left_to_right_transition = new TransitionSelector(true, left_state_spec, right_state_spec);
		right_to_left_transition = new TransitionSelector(true, right_state_spec, left_state_spec);
		return new MultiSelector(left_to_right_transition, right_to_left_transition);
	} else if(transition_str === "->") { // left to right, after transition
		return new TransitionSelector(false, left_state_spec, right_state_spec);
	} else if(transition_str === ">-") { // left to right, before transition
		return new TransitionSelector(true, left_state_spec, right_state_spec);
	} else if(transition_str === "<-") { // right to left, after transition
		return new TransitionSelector(false, right_state_spec, left_state_spec);
	} else if(transition_str === "-<") { // right to left, before transition
		return new TransitionSelector(true, right_state_spec, left_state_spec);
	} else { return null; } // There shouldn't be any way to get here...
};

var transition_separator_regex = /^([\sa-zA-Z0-9,\-_*]+)((<->|>-<|->|>-|<-|-<)([\sa-zA-Z0-9,\-_*]+))?$/;
// Given a string specifying a state or set of states, return a selector object
var parse_spec = function(str) {
	var matches = str.match(transition_separator_regex);
	if(matches === null) {
		return null; // Poorly formatted specification
	} else {
		if(matches[2]) {
			// The user specified a transition: "A->b": ["A->b", "A", "->b", "->", "b"]
			var from_state_str = matches[1], transition_str = matches[3], to_state_str = matches[4];
			return parse_transition_spec(from_state_str, transition_str, to_state_str);
		} else {
			// The user specified a state: "A": ["A", "A", undefined, undefined, undefined]
			var states_str = matches[1];
			return parse_state_spec(states_str);
		}
	}
};


// StateListener
var state_listener_id = 0;
var StateListener = function(selector, callback, context) {
	this._context = context || root; // 'this' in the callback
	this._selector = selector; // used to record interest
	this._callback = callback; // the function to call when selector matches
	this._id = state_listener_id++; // unique id
};
(function(my) {
	var proto = my.prototype;
	// Used to determine if run should be called by the fsm
	proto.interested_in = function() { return this._selector.matches.apply(this._selector, arguments); };
	// Run the user-specified callback
	proto.run = function() { this._callback.apply(this._context, arguments); };
}(StateListener));

/**
 * ***Note:*** The preferred way to create a FSM is through the `cjs.fsm` function
 * This class represents a finite-state machine to track the state of an interface or component
 *
 * @private
 * @class cjs.FSM
 * @classdesc A finite-state machine
 * @param {string} ...state_names - Any number of state names for the FSM to have
 * @see cjs.fsm
 */
var FSM = function() {
	this._states = {}; // simple substate representations
	this._transitions = []; // simple transition representations
	this._curr_state = null; // the currently active state
	this._listeners = []; // listeners for every selector
	this._chain_state = null; // used internally for chaining
	this._did_transition = false; // keeps track of if any transition has run (so that when the user specifies
								// a start state, it knows whether or not to change the current state

	/**
	 * The name of this FSM's active state
	 * @property {Constraint} cjs.FSM.state
	 * @example
	 *
	 *     var my_fsm = cjs.fsm("state1", "state2");
	 *     my_fsm.state.get(); // 'state1'
	 */
	this.state = cjs(function() { // the name of the current state
		if(this._curr_state) { return this._curr_state._name; }
		else { return null; }
	}, {
		context: this
	});

	// Option to pass in state names as arguments
	this.addState.apply(this, flatten(arguments, true));
};
(function(my) {
	var proto = my.prototype;
	/** @lends cjs.FSM.prototype */

	// Find the state with a given name
	var getStateWithName = function(fsm, state_name) {
		return fsm._states[state_name];
	};

	/**
	 * Create states and set the current "chain state" to that state
	 *
	 * @method addState
	 * @param {string} ...state_names - Any number of state names to add. The last state becomes the chain state
	 * @return {FSM} - `this`
	 *
	 * @example
	 *
	 *     var fsm = cjs.fsm()
	 *                  .addState('state1')
	 *                  .addState('state2')
	 *                  .addTransition('state2', cjs.on('click'));
	 */
	proto.addState = function() {
		var state;
		each(arguments, function(state_name) {
			state = getStateWithName(this, state_name);
			if(!state) {
				state = this._states[state_name] = new State(this, state_name);
				// if there isn't an active state,
				// make this one the starting state by default
				if(this._curr_state === null) { this._curr_state = state; }
			}
		}, this);

		if(state) { this._chain_state = state; }

		return this;
	};

	/**
	 * Returns the name of the state this machine is currently in. Constraints that depend on the return
	 * value will be automatically updated.
	 *
	 * @method getState
	 * @return {string} - The name of the currently active state
	 * @example
	 *
	 *     var my_fsm = cjs.fsm("state1", "state2");
	 *     my_fsm.getState(); // 'state1'
	 */
	proto.getState = function() {
		return this.state.get();
	};
	
	/**
	 * Add a transition between two states
	 *
	 * @method addTransition
	 * @param {string} to_state - The name of the state the transition should go to
	 * @return {function} - A function that tells the transition to run
	 * @example
	 *
	 *     var x = cjs.fsm();
	 *     x.addState("b")
	 *      .addState("a");
	 *     var run_transition = x.addTransition("b");
	 *     //add a transition from a to b
	 *     window.addEventListener("click", run_transition);
	 *     // run that transition when the window is clicked
	 */
	/**
	 * (variant 2)
	 * @method addTransition^2
	 * @param {string} to_state - The name of the state the transition should go to
	 * @param {CJSEvent|function} add_transition_fn - A `CJSEvent` or a user-specified function for adding the event listener
	 * @return {FSM} - `this`
	 * @example
	 *
	 *     var x = cjs.fsm();
	 *     x.addState("b")
	 *      .addState("a")
	 *      .addTransition("b", cjs.on('click'));
	 *     // add a transition from a to b that runs when the window is clicked
	 * @example
	 *
	 *     var x = cjs.fsm();
	 *     x.addState("b")
	 *      .addState("a")
	 *      .addTransition("b", function(run_transition) {
	 *          window.addEventListener("click", run_transition);
	 *      });
	 *     // add a transition from a to b that runs when the window is clicked
	 */
	/**
	 * (variant 3)
	 * @method addTransition^3
	 * @param {string} from_state - The name of the state the transition should come from
	 * @param {string} to_state - The name of the state the transition should go to
	 * @return {function} - A function that tells the transition to run
	 * @example
	 *
	 *     var x = cjs.fsm("a", "b");
	 *     var run_transition = x.addTransition("a", "b"); //add a transition from a to b
	 *     window.addEventListener("click", run_transition); // run that transition when the window is clicked
	 */
	/**
	 * (variant 4)
	 * @method addTransition^4
	 * @param {string} from_state - The name of the state the transition should come from
	 * @param {string} to_state - The name of the state the transition should go to
	 * @param {CJSEvent|function} add_transition_fn - A `CJSEvent` or a user-specified function for adding the event listener
	 * @return {FSM} - `this`
	 *
	 * @example
	 *
	 *     var x = cjs.fsm("a", "b");
	 *     x.addTransition("a", "b", cjs.on("click"));
	 * @example
	 *
	 *     var x = cjs.fsm("a", "b");
	 *     var run_transition = x.addTransition("a", "b", function(run_transition) {
	 *         window.addEventListener("click", run_transition);
	 *     }); // add a transition from a to b that runs when the window is clicked
	 */
	proto.addTransition = function(a, b, c) {
		var from_state, to_state, transition, add_transition_fn, return_transition_func = false;

		if(arguments.length === 0) {
			throw new Error("addTransition expects at least one argument");
		} else if(arguments.length === 1) { // make a transition from the last entered state to the next state
			return_transition_func = true;
			from_state = this._chain_state;
			to_state = a;
		} else if(arguments.length === 2) {
			if(isFunction(b) || b instanceof CJSEvent) { // b is the function to add the transition
				from_state = this._chain_state;
				to_state = a;
				add_transition_fn = b;
			} else { // from and to states specified
				from_state = a;
				to_state = b;
				return_transition_func = true;
			}
		} else {
			from_state = a;
			to_state = b;
			add_transition_fn = c;
		}
		if(isString(from_state) && !has(this._states, from_state)) { this._states[from_state] = new State(this, from_state); }
		if(isString(to_state) && !has(this._states, to_state)) { this._states[to_state] = new State(this, to_state); }

		// do_transition is a function that can be called to activate the transition
		// Creates a new transition that will go from from_state to to_state
		transition = new Transition(this, from_state, to_state);
		this._transitions.push(transition);
		if(return_transition_func) {
			return bind(transition.run, transition);
		} else {
			if(add_transition_fn instanceof CJSEvent) {
				add_transition_fn._addTransition(transition);
				transition.setEvent(add_transition_fn);
			} else {
				// call the supplied function with the code to actually perform the transition
				add_transition_fn.call(this, bind(transition.run, transition), this);
			}
			return this;
		}
	};

	/**
	 * Changes the active state of this FSM.
	 * This function should, ideally, be called by a transition instead of directly.
	 *
	 * @private
	 * @method _setState
	 * @param {State|string} state - The state to transition to
	 * @param {Transition} transition - The transition that ran
	 */
	proto._setState = function(state, transition, event) {
		var from_state = this.getState(), // the name of my current state
			to_state = isString(state) ? getStateWithName(this, state) : state,
			listener_args = this._listeners.length > 0 ?
				([event, transition, to_state, from_state]).concat(rest(arguments, 3)) : false;
		if(!to_state) {
			throw new Error("Could not find state '" + state + "'");
		}
		this.did_transition = true;


		// Look for pre-transition callbacks
		each(this._listeners, function(listener) {
			if(listener.interested_in(transition, true)) {
				listener.run.apply(listener, listener_args); // and run 'em
			}
		});
		this._curr_state = to_state;
		this.state.invalidate();
		// Look for post-transition callbacks..
		// and also callbacks that are interested in state entrance
		each(this._listeners, function(listener) {
			if(listener.interested_in(transition, false) ||
					listener.interested_in(to_state)) {
				listener.run.apply(listener, listener_args); // and run 'em
			}
		});
	};

	/**
	 * Remove all of the states and transitions of this FSM. Useful for cleaning up memory
	 *
	 * @method destroy
	 */
	proto.destroy = function() {
		this.state.destroy();
		this._states = {};
		each(this._transitions, function(t) { t.destroy(); });
		this._transitions = [];
		this._curr_state = null;
	};

	/**
	 * Specify which state this FSM should begin at.
	 *
	 * @method startsAt
	 * @param {string} state_name - The name of the state to start at
	 * @return {FSM} - `this`
	 * @example
	 *
	 *     var my_fsm = cjs.fsm("state_a", "state_b");
	 *     my_fsm.startsAt("state_b");
	 */
	proto.startsAt = function(state_name) {
		var state = getStateWithName(this, state_name); // Get existing state
		if(!state) {
			// or create it if necessary
			state = this._states[state_name] = new State(this, state_name);
		}
		if(!this.did_transition) {
			// If no transitions have occurred, set the current state to the one they specified
			this._curr_state = state;
			this.state.invalidate();
		}
		this._chain_state = state;
		return this;
	};

	/**
	 * Check if the current state is `state_name`
	 *
	 * @method is
	 * @param {string} state_name - The name of the state to check against
	 * @return {boolean} - `true` if the name of the active state is `state_name`. `false` otherwise
	 * @example
	 *
	 *     var my_fsm = cjs.fsm("a", "b");
	 *     my_fsm.is("a"); // true, because a is the starting state
	 */
	proto.is = function(state_name) {
		// get the current state name & compare
		var state = this.getState();
		return state === null ? false : (state === (isString(state_name) ? state_name : state_name.getName()));
	};

	/**
	 * Call a given function when the finite-state machine enters a given state.
	 * `spec` can be of the form:
	 * - `'*'`: any state
	 * - `'state1'`: A state named `state1`
	 * - `'state1 -> state2'`: Immediately **after** state1 transitions to state2
	 * - `'state1 >- state2'`: Immediately **before** state1 transitions to state2
	 * - `'state1 <-> state2'`: Immediately **after** any transition between state1 and state2
	 * - `'state1 >-< state2'`: Immediately **before** any transition between state1 and state2
	 * - `'state1 <- state2'`: Immediately **after** state2 transitions 2 state1
	 * - `'state1 -< state2'`: Immediately **before** state2 transitions 2 state1
	 * - `'state1 -> *'`: Any transition from state1
	 * - `'* -> state2'`: Any transition to state2
	 *
	 * @method on
	 * @param {string} spec - A specification of which state to call the callback
	 * @param {function} callback - The function to be called
	 * @param {object} [context] - What `this` should evaluate to when `callback` is called
	 * @return {FSM} - `this`
	 *
	 * @see FSM.prototype.off
	 * @example
	 *
	 *     var x = cjs.fsm("a", "b");
	 *     x.on("a->b", function() {...});
	 */
	proto.on = proto.addEventListener = function(spec_str, callback, context) {
		var selector;
		if(isString(spec_str)) {
			selector = parse_spec(spec_str);
			if(selector === null) {
				throw new Error("Unrecognized format for state/transition spec.");
			}
		} else {
			selector = spec_str;
		}
		var listener = new StateListener(selector, callback, context);
		this._listeners.push(listener);
		return this;
	};

	/**
	 * Remove the listener specified by an on call; pass in just the callback
	 *
	 * @method off
	 * @param {function} callback - The function to remove as a callback
	 * @return {FSM} - `this`
	 *
	 * @see FSM.prototype.on
	 */
	proto.off = proto.removeEventListener = function(listener_callback) {
		this._listeners = filter(this._listeners, function(listener) {
			return listener.callback !== listener_callback;
		});
		return this;
	};
}(FSM));
/** @lends */

extend(cjs, {
	/** @expose cjs.FSM */
	FSM: FSM,
	/**
	 * Create an FSM
	 * @method cjs.fsm
	 * @constructs FSM
	 * @param {string} ...state_names - An initial set of state names to add to the FSM
	 * @return {FSM} - A new FSM
	 * @see FSM
	 * @example Creating a state machine with two states
	 *
	 *     var my_state = cjs.fsm("state1", "state2");
	 */
	fsm: function() { return new FSM(arguments); },
	/**
	 * Determine whether an object is an FSM
	 * @method cjs.isFSM
	 * @param {*} obj - An object to check
	 * @return {boolean} - `true` if `obj` is an `FSM`, `false` otherwise
	 */
	isFSM: function(obj) { return obj instanceof FSM; }
});
