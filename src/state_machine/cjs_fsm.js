// Finite State Machines
// ---------------------

// State keeps track of basic state information (its containing FSM does most of the work)
/**
 * Description
 * @method State
 * @param {} fsm
 * @param {} name
 * @return 
 */
var State = function(fsm, name) {
	this._fsm = fsm; // parent fsm
	this._name = name; // state name (fetch with getName)
	this._id = uniqueId(); // useful for storage
};

(function(my) {
	var proto = my.prototype;
	/**
	 * Description
	 * @method getName
	 * @return MemberExpression
	 */
	proto.getName = function() { return this._name; }; // getter for name
	/**
	 * Description
	 * @method id
	 * @return MemberExpression
	 */
	proto.id = function() { return this._id; }; // getter for id
}(State));

// Simple transition representation (again, the containing FSM does most of the work)
/**
 * Description
 * @method Transition
 * @param {} fsm
 * @param {} from_state
 * @param {} to_state
 * @param {} name
 * @return 
 */
var Transition = function(fsm, from_state, to_state, name) {
	this._fsm = fsm; // parent FSM
	this._from = from_state; // from state (fetch with getFrom)
	this._to = to_state; // to state (fetch with getTo)
	this._name = name; // name (fetch with getName)
	this._id = uniqueId(); // useful for storage
};

(function(my) {
	var proto = my.prototype;
	/**
	 * Description
	 * @method getFrom
	 * @return MemberExpression
	 */
	proto.getFrom = function() { return this._from; }; // from getter
	/**
	 * Description
	 * @method getTo
	 * @return MemberExpression
	 */
	proto.getTo = function() { return this._to; }; // to getter
	/**
	 * Description
	 * @method getName
	 * @return MemberExpression
	 */
	proto.getName = function() { return this._name; }; // name getter
	/**
	 * Description
	 * @method getFSM
	 * @return MemberExpression
	 */
	proto.getFSM = function() { return this._fsm; }; // FSM getter
	/**
	 * Description
	 * @method id
	 * @return MemberExpression
	 */
	proto.id = function() { return this._id; }; // getter for id
	/**
	 * Description
	 * @method run
	 * @return 
	 */
	proto.run = function() {
		var fsm = this.getFSM();
		// do_transition should be called by the user's code
		if(fsm.is(this.getFrom())) {
			var args = toArray(arguments);
			args.unshift(this);
			args.unshift(this.getTo());
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
/**
 * Description
 * @method StateSelector
 * @param {} state_name
 * @return 
 */
var StateSelector = function(state_name) {
	this._state_name = state_name;
};
(function(my) {
	var proto = my.prototype;
	/**
	 * Description
	 * @method matches
	 * @param {} state
	 * @return LogicalExpression
	 */
	proto.matches = function(state) {
		// Supplied object should be a State object with the given name
		return state instanceof State && (this._state_name === state || this._state_name === state.getName());
	};
}(StateSelector));

// Matches any state (e.g. *)
/**
 * Description
 * @method AnyStateSelector
 * @return 
 */
var AnyStateSelector = function() { };
(function(my) {
	var proto = my.prototype;
	// will match any state (but not transition)
	/**
	 * Description
	 * @method matches
	 * @param {} state
	 * @return BinaryExpression
	 */
	proto.matches = function(state) {return state instanceof State;};
}(AnyStateSelector));

// Matches certain transitions (see transition formatting spec)
/**
 * Description
 * @method TransitionSelector
 * @param {} pre
 * @param {} from_state_selector
 * @param {} to_state_selector
 * @return 
 */
var TransitionSelector = function(pre, from_state_selector, to_state_selector) {
	this.is_pre = pre; // should fire before the transition (as opposed to after)
	this.from_state_selector = from_state_selector; // the selector for the from state (should be a StateSelector or AnyStateSelector)
	this.to_state_selector = to_state_selector; // selector for the to state
};
(function(my) {
	var proto = my.prototype;
	// Make sure that the supplied object is a transition with the same timing
	/**
	 * Description
	 * @method matches
	 * @param {} transition
	 * @param {} pre
	 * @return 
	 */
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

// Multiple possiblities (read OR, not AND)
/**
 * Description
 * @method MultiSelector
 * @param {} selectors
 * @return 
 */
var MultiSelector = function(selectors) {
	this.selectors = selectors; // all of the selectors to test
};
(function(my) {
	var proto = my.prototype;
	/**
	 * Description
	 * @method matches
	 * @return CallExpression
	 */
	proto.matches = function() {
		var match_args = arguments;
		// See if any selectors match
		return any(this.selectors, function(selector) {
			return selector.matches.apply(selector, match_args);
		});
	};
}(MultiSelector));

// return a selector object from a string representing a single state
/**
 * Description
 * @method parse_single_state_spec
 * @param {} str
 * @return 
 */
var parse_single_state_spec = function(str) {
	if(str === "*") {
		return new AnyStateSelector();
	} else {
		return new StateSelector(str);
	}
};

// Parse one side of the transition
/**
 * Description
 * @method parse_state_spec
 * @param {} str
 * @return 
 */
var parse_state_spec = function(str) {
	// Split by , and remove any excess spacing
	var state_spec_strs = map(str.split(","), function(ss) { return ss.trim(); }); 

	// The user only specified one state
	if(state_spec_strs.length === 1) {
		return parse_single_state_spec(state_spec_strs[0]);
	} else { // any number of states
		var state_specs = map(state_spec_strs, parse_single_state_spec);
		return new MultiSelector(state_specs);
	}
};

// The user specified a transition
/**
 * Description
 * @method parse_transition_spec
 * @param {} left_str
 * @param {} transition_str
 * @param {} right_str
 * @return 
 */
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

var transition_separator_regex = new RegExp("^([\\sa-zA-Z0-9,\\-_*]+)((<->|>-<|->|>-|<-|-<)([\\sa-zA-Z0-9,\\-_*]+))?$");
// Given a string specifying a state or set of states, return a selector object
/**
 * Description
 * @method parse_spec
 * @param {} str
 * @return 
 */
var parse_spec = function(str) {
	var matches = str.match(transition_separator_regex);
	if(matches === null) {
		return null; // Poorly formatted specification
	} else {
		if(matches[2] === undefined) {
			// The user specified a state: "A": ["A", "A", undefined, undefined, undefined]
			var states_str = matches[1];
			return parse_state_spec(states_str);
		} else {
			// The user specified a transition: "A->b": ["A->b", "A", "->b", "->", "b"]
			var from_state_str = matches[1], transition_str = matches[3], to_state_str = matches[4];
			return parse_transition_spec(from_state_str, transition_str, to_state_str);
		}
	}
};


// StateListener
var state_listener_id = 0;
/**
 * Description
 * @method StateListener
 * @param {} selector
 * @param {} callback
 * @param {} context
 * @return 
 */
var StateListener = function(selector, callback, context) {
	this._context = context || root; // 'this' in the callback
	this._selector = selector; // used to record interest
	this._callback = callback; // the function to call when selector matches
	this._id = state_listener_id++; // unique id
};
(function(my) {
	var proto = my.prototype;
	// Used to determine if run should be called by the fsm
	/**
	 * Description
	 * @method interested_in
	 * @return CallExpression
	 */
	proto.interested_in = function() { return this._selector.matches.apply(this._selector, arguments); };
	// Run the user-specified callback
	/**
	 * Description
	 * @method run
	 * @return 
	 */
	proto.run = function() { this._callback.apply(this._context, arguments); };
}(StateListener));

/**
 * Description
 * @method FSM
 * @return 
 */
var FSM = function() {
	this._states = {}; // simple substate representations
	this._transitions = []; // simple transition representations
	this._curr_state = null; // the currently active state
	this._listeners = []; // listeners for every selector
	this._chain_state = null; // used internally for chaining
	this._did_transition = false; // keeps track of if any transition has run (so that when the user specifies
								// a start state, it knows whether or not to change the current state

	this.state = cjs(function() { // the name of the current state
		if(this._curr_state) { return this._curr_state.getName(); }
		else { return null; }
	}, {
		context: this
	});

	// Option to pass in state names as arguments
	var state_names = flatten(arguments, true);
	each(state_names, this.addState, this);
};
(function(my) {
	var proto = my.prototype;
	// Creates and returns a new state object with name state
	/**
	 * Description
	 * @method createState
	 * @param {} state_name
	 * @return state
	 */
	proto.createState = function(state_name) {
		var state = new State(this, state_name);
		this._states[state_name] = state;
		return state;
	};

	// Either creates a state with name state_name or sets the current
	// chain state to that state
	/**
	 * Description
	 * @method addState
	 * @param {} state_name
	 * @return ThisExpression
	 */
	proto.addState = function(state_name) {
		var state = this.stateWithName(state_name);
		if(state === null) {
			state = this.createState.apply(this, arguments);
			if(this._curr_state === null) { this._curr_state = state; } // if there isn't an active state,
																	// make this one the starting state by default
		}

		this._chain_state = state;
		return this;
	};
	// Find the state with a given name
	/**
	 * Description
	 * @method stateWithName
	 * @param {} state_name
	 * @return LogicalExpression
	 */
	proto.stateWithName = function(state_name) {
		return this._states[state_name] || null;
	};

	// Returns the name of the state this machine is currently in
	/**
	 * Description
	 * @method getState
	 * @return CallExpression
	 */
	proto.getState = function() {
		return this.state.get();
	};
	
	// Add a transition from the last state that was added (the chain state) to a given state
	// add_transition_fn will be called with the code to do a transition as a parameter
	/**
	 * Description
	 * @method addTransition
	 * @param {} a
	 * @param {} b
	 * @param {} c
	 * @return 
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
		} else if(arguments.length > 2) {
			from_state = a;
			to_state = b;
			add_transition_fn = c;
		}

		// do_transition is a function that can be called to activate the transition
		transition = this._getTransition(from_state, to_state);
		if(return_transition_func) {
			return bind(transition.run, transition);
		} else {
			if(add_transition_fn instanceof CJSEvent) {
				add_transition_fn._addTransition(transition);
			} else {
				// call the supplied function with the code to actually perform the transition
				add_transition_fn.call(this, bind(transition.run, transition), this);
			}
			return this;
		}
	};

	// Creates a new transition that will go from from_state to to_state
	/**
	 * Description
	 * @method _getTransition
	 * @param {} from_state
	 * @param {} to_state
	 * @return transition
	 */
	proto._getTransition = function(from_state, to_state) {
		if(isString(from_state)) {
			from_state = this.stateWithName(from_state);
		}
		if(isString(to_state)) {
			to_state = this.stateWithName(to_state);
		}
		
		var transition = new Transition(this, from_state, to_state);
		this._transitions.push(transition);

		return transition;
	};
	// This function should, ideally, be called by a transition instead of directly
	/**
	 * Description
	 * @method _setState
	 * @param {} state
	 * @param {} transition
	 * @return 
	 */
	proto._setState = function(state, transition) {
		var from_state = this.getState(); // the name of my current state
		var to_state = isString(state) ? this.stateWithName(state) : state;
		if(!to_state) {
			throw new Error("Could not find state '" + state + "'");
		}
		this.did_transition = true;

		// Look for pre-transition callbacks
		each(this._listeners, function(listener) {
			if(listener.interested_in(transition, true)) {
				listener.run(transition, to_state, from_state); // and run 'em
			}
		});
		this._curr_state = to_state;
		this.state.invalidate();
		// Look for post-transition callbacks..
		// and also callbacks that are interested in state entrance
		each(this._listeners, function(listener) {
			if(listener.interested_in(transition, false)) {
				listener.run(transition, to_state, from_state); // and run 'em
			} else if(listener.interested_in(to_state)) {
				listener.run(transition, to_state, from_state); // and run 'em
			}
		});
	};
	/**
	 * Description
	 * @method destroy
	 * @return 
	 */
	proto.destroy = function() {
		this.state.destroy();
		this._states = {};
		this._transitions = [];
		this._curr_state = null;
	};
	/**
	 * Description
	 * @method startsAt
	 * @param {} state_name
	 * @return ThisExpression
	 */
	proto.startsAt = function(state_name) {
		var state = this.stateWithName(state_name); // Get existing state
		if(state === null) {
			// or create it if necessary
			state = this.create_state(state_name);
		}
		if(!this.did_transition) {
			// If no transitions have occured, set the current state to the one they specified
			this._curr_state = state;
		}
		this._chain_state = state;
		return this;
	};
	/**
	 * Description
	 * @method is
	 * @param {} state_name
	 * @return 
	 */
	proto.is = function(state_name) {
		// get the current state name...
		var state = this.getState();
		if(state === null) { return false; }
		else {
			// ...and compare
			if(isString(state_name)) {
				return state === state_name;
			} else {
				return state === state_name.getName();
			}
		}
	};
	// A function to be called when the given string is true
	/**
	* Description
	* @method addEventListener
	* @param {} spec_str
	* @param {} callback
	* @param {} context
	* @return ThisExpression
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

	// Remove the listener specified by an on call; pass in just the callback
	/**
	* Description
	* @method removeEventListener
	* @param {} listener_callback
	* @return ThisExpression
	*/
	proto.off = proto.removeEventListener = function(listener_callback) {
		this._listeners = filter(this._listeners, function(listener) {
			return listener.callback !== listener_callback;
		});
		return this;
	};
}(FSM));

extend(cjs, {
	/**
	 * Description
	 * @method fsm
	 * @return NewExpression
	 */
	fsm: function() { return new FSM(arguments); },

	/**
	 * Description
	 * @method isFSM
	 * @param {} obj
	 * @return BinaryExpression
	 */
	isFSM: function(obj) { return obj instanceof FSM; }
});
