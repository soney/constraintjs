var camel_case = (function() {
	var rdashAlpha = /-([a-z]|[0-9])/ig, rmsPrefix = /^-ms-/;
	var fcamelCase = function(all, letter) {
		return String(letter).toUpperCase();
	};
	return function(string) {
		return string.replace( rmsPrefix, "ms-" ).replace(rdashAlpha, fcamelCase);
	};
}());
cjs.$.extend({
	item: function(key) {
		var my_constraint = this;
		return new Constraint(function() {
			var got = my_constraint.get();
			if(got != null) { return got[cjs.get(key)]; }
			else { return undefined; }
		});
	}
	, indexOf: function(item, equality_check) {
		var got = this.get();
		return index_of(got, item, 0, equality_check);
	}
	, add: function() {
		var my_constraint = this;
		var args = arguments;
		return new Constraint(function() {
			var rv = my_constraint.get();
			each(args, function(arg) { rv += cjs.get(arg); });
			return rv;
		});
	}
	, sub: function() {
		var my_constraint = this;
		var args = arguments;
		return new Constraint(function() {
			var rv = my_constraint.get();
			each(args, function(arg) { rv -= cjs.get(arg); });
			return rv;
		});
	}
	, mul: function() {
		var my_constraint = this;
		var args = arguments;
		return new Constraint(function() {
			var rv = my_constraint.get();
			each(args, function(arg) { rv *= cjs.get(arg); });
			return rv;
		});
	}
	, div: function() {
		var my_constraint = this;
		var args = arguments;
		return new Constraint(function() {
			var rv = my_constraint.get();
			each(args, function(arg) { rv /= cjs.get(arg); });
			return rv;
		});
	}
	, func: function(the_func) {
		var my_constraint = this;
		return new Constraint(function() {
			var rv = the_func(my_constraint.get());
			return rv;
		});
	}
	, map: function(func) {
		var my_constraint = this;
		var old_val, old_rv;
		return new Constraint(function() {
			var val = my_constraint.get();
			if(val === old_val) { return old_rv; }
			else { old_val = val; }
			if(isArray(val)) {
				return old_rv = map(val, func);
			} else {
				return undefined;
			}
		});
	}
});

var State = function(name) {
	this._name = name;
};
(function(my) {
	var proto = my.prototype;
	proto.name = function() { return this._name; };
}(State));

var Transition = function(fsm, from_state, to_state, name) {
	this.fsm = fsm;
	this._from = from_state;
	this._to = to_state;
	this._name = name;
};
(function(my) {
	var proto = my.prototype;
	proto.from = function() { return this._from; };
	proto.to = function() { return this._to; };
	proto.name = function() { return this._name; };
	proto.run = function() {
		var args = toArray(arguments);
		args.unshift(this.to());
		this.fsm.set_state.apply(this.fsm, args);
	};
}(Transition));

var FSM = function() {
	this._states = [];
	this._transitions = [];
	this.$state = cjs.$(null);
	this._chain_state = undefined;
	this._listeners = {};
};
(function(my) {
	var proto = my.prototype;
	proto.state_with_name = function(state_name) {
		var state_index = index_where(this._states, function(state) { return state.name() === state_name; } );
		if(state_index >= 0) { return this._states[state_index]; }
		else { return null; }
	};
	proto.add_state = function(state_name) {
		var state = this.create_or_find_state(state_name);
		this._chain_state = state;
		return this;
	};
	proto.create_or_find_state = function(state_name) {
		if(state_name instanceof State) {
			return this.create_or_find_state(state_name.name());
		}
		var state = this.state_with_name(state_name);
		if(state === null) {
			state = new State(state_name);
			this._states.push(state);
		}
		return state;
	};
	proto.get_state = function() { return this.$state.get(); };
	var get_state_regex = function(state_name) { 
		var valid_chars = "[^\\-<>a-zA-Z0-9]*";
		return valid_chars + "\\*|("+state_name+")" + valid_chars;
	};
	proto.set_state = function(state, event) {
		var old_state = this.get_state();
		var old_state_name = old_state ? old_state.name() : "";
		var new_state_name = state ? state.name() : "";
		var pre_transition_listeners = [];
		var post_transition_listeners = [];
		var old_state_regex = get_state_regex(old_state_name);
		var new_state_regex = get_state_regex(new_state_name);
		each(this._listeners, function(listeners, spec) {
			if(spec.match(new RegExp("^"+new_state_regex+"$"))) {
				post_transition_listeners.push.apply(post_transition_listeners, listeners);
			} else if(spec.match(new RegExp("^" + old_state_regex + "(->|<->)" + new_state_regex+"$"))) {
				post_transition_listeners.push.apply(post_transition_listeners, listeners);
			} else if(spec.match(new RegExp("^" + old_state_regex + "(>-|>-<)" + new_state_regex+"$"))) {
				pre_transition_listeners.push.apply(pre_transition_listeners, listeners);
			}
		});
		var fsm = this;
		each(pre_transition_listeners, function(listener) { listener(event, new_state_name, old_state_name, fsm); });
		this.$state.set(state);
		each(post_transition_listeners, function(listener) { listener(event, new_state_name, old_state_name, fsm); });
	};

	proto.add_transition = function(add_transition_fn) {
		var do_transition = this.get_transition.apply(this, slice.call(arguments, 1));
		add_transition_fn.call(this, do_transition, this);

		return this;
	};
	proto.get_transition = function(arg1, arg2, arg3) {
		var from_state, to_state, name;
		if(arguments.length >= 2) {
			from_state = this.create_or_find_state(arg1);
			to_state = this.create_or_find_state(arg2);
			name = arg3;
		} else {
			from_state = this._chain_state;
			to_state = this.create_or_find_state(arg1);
			name = arg2;
		}
		var transition = new Transition(this, from_state, to_state, name);
		this._transitions.push(transition);
		return  bind(function() {
			if(this.is(from_state.name())) {
				transition.run.apply(transition, arguments);
			}
		}, this);
	};
	proto.start_at = function(state_name) {
		var state = this.state_with_name(state_name);
		this.set_state(state);
		return this;
	};
	proto.is = function(state) {
		var my_state = this.get_state();
		return my_state === state || (my_state !== null && my_state.name() === state);
	};
	proto.on = function(state_spec, func) {
		var listeners = this._listeners[state_spec];
		if(!isArray(listeners)) {
			listeners = this._listeners[state_spec] = [];
		}

		listeners.push(func);
	};
}(FSM));
cjs.fsm = function() { return new FSM(); };
cjs.is_fsm = function(obj) { return obj instanceof FSM; };
cjs.FSM = FSM;

cjs.on = function(event_type, target) {
	var rv = function(do_something) { target.addEventListener(event_type, do_something); };

	var context = this;
	rv.guard = function(guard_func) {
		return function(do_something) {
			target.addEventListener(event_type, function() {
					var args = toArray(arguments);
					if(guard_func.apply(context, args)) {
						do_something.apply(context, args);
					}
				});
		};
	};
	rv.destroy = function() { target.removeEventListener(event_type, do_something); };
	return rv;
};


var FSMConstraint = function(fsm, values) {
	this._curr_constraint = cjs.$(null);
	this._fsm = fsm;
	this._listeners = {};
	var precedence = -1;
	var init_value = null;
	each(values, function(value, selector) {
		this.set(selector, value);
		if(selector === "INIT" && precedence < 1) { precedence = 1; init_value = value; }
		else if(selector === "*" && precedence < 2) { precedence = 2; init_value = value; }
		else if(this._fsm.is(selector) && precedence < 3) { precedence = 3; init_value = value; }
	}, this);
	if(init_value !== null) { this._curr_constraint.set(init_value); }

	var value = bind(function() {
		return this._curr_constraint.get();
	}, this);
	FSMConstraint.superclass.constructor.call(this, value);
};
(function(my) {
	proto_extend(my, Constraint);
	var proto = my.prototype;
	proto.set = function(selector, value) {
		if(has(this._listeners, selector)) {
			this.unset(selector);
		}
		var listener = this._listeners[selector] = bind(function(event) {
			if(isFunction(value)) {
				var args = toArray(arguments);
				this._curr_constraint.set(function() {
					return value.apply(this, args);
				});
			} else {
				this._curr_constraint.set(value);
			}
		}, this);
		this._fsm.on(selector, listener);
		return this;
	};
	proto.unset = function(selector) {
		var listener = this._listeners[selector];
		if(listener) {
			this._fsm.off(selector, listener);
			delete this._listeners[selector];
		}
		return this;
	};
	proto.destroy = function() {
		each(this._listeners, function(listener, selector) {
			this._fsm.off(selector, listener);
		}, this);
		this._curr_constraint.destroy();
		my.superclass.destroy.apply(this, arguments);
	};
}(FSMConstraint));
cjs.fsm_$ = function(fsm, values) { return new FSMConstraint(fsm, values); };
cjs.is_fsm_$ = function(obj) { return obj instanceof FSMConstraint; };
cjs.FSMConstraint = FSMConstraint;

var ConditionalConstraint = function() {
	this._condition_map = cjs.map();
	each(arguments, function(arg) {
		if(arg) { this.set(arg.condition, arg.value); }
	}, this);

	var value = bind(function() {
		var keys = this._condition_map.keys();
		for(var i = 0; i<keys.length; i++) {
			var key = keys[i];
			var key_val;
			if(isFunction(key)) { key_val = key(); }
			else { key_val = key; }

			if(key_val == true || key_val === "else") {
				var val = this._condition_map.item(key);
				if(isFunction(val)) { return val(key_val); }
				else { return val; }
			}
		}
	}, this);
	ConditionalConstraint.superclass.constructor.call(this, value);
};
(function(my) {
	proto_extend(my, Constraint);
	var proto = my.prototype;
	proto.set = function() {
		var cm = this._condition_map;
		cm.item.apply(cm, arguments);
		return this;
	};
	proto.unset = function(condition) {
		cm.unset.apply(cm, arguments);
		return this;
	};
}(ConditionalConstraint));
cjs.conditional_$ = function() { return construct(ConditionalConstraint, arguments); };
cjs.is_conditional_$ = function(obj) { return obj instanceof FSMConstraint; };
cjs.ConditionalConstraint = ConditionalConstraint;

var dom_setter = function(elems, set_func) {
	if(isElement(elems)) {
		set_func(elems);
	} else if(isArray(elems)) {
		each(elems, function(elem) { dom_setter(elem, set_func); });
	} else if(has(window, "jQuery") && elems instanceof jQuery) {
		for(var i = 0; i<elems.length; i++) {
			set_func(elems[i]);
		}
	} else if(cjs.is_$(elems)) {
		dom_setter(elems.get(), set_func);
	} else if(cjs.is_array(elems)) {
		dom_setter(elems.get(), set_func);
	}
};


cjs.text = function(elems, val) {
	cjs.liven(function() {
		var v = cjs.get(val);
		dom_setter(elems, function(elem) {
			elem.textContent = v;
		});
	});
};

cjs.html = function(elems, val) {
	cjs.liven(function() {
		var v = cjs.get(val);
		dom_setter(elems, function(elem) {
			elem.innerHTML = v;
		});
	});
};

cjs.val = function(elems, val) {
	cjs.liven(function() {
		var v = cjs.get(val);
		dom_setter(elems, function(elem) {
			elem.val = v;
		});
	});
};

cjs.class = function(elems, val) {
	cjs.liven(function() {
		var v;
		if(cjs.is_$(val)) {
			v = val.get();
		} else if(cjs.is_array(val)) {
			v = val.get();
		} else {
			v = val;
		}

		if(isArray(v)) { v = v.join(" "); }

		dom_setter(elems, function(elem) {
			elem.className = v;
		});
	});
};

cjs.css = function(elems, attr_name, val) {
	cjs.liven(function() {
		var k = camel_case(cjs.get(attr_name));
		var v = cjs.get(val);
		dom_setter(elems, function(elem) { elem.style[k] = v; });
	});
};

cjs.attr = function(elems, attr_name, val) {
	cjs.liven(function() {
		var k = cjs.get(attr_name);
		var v = cjs.get(val);
		dom_setter(elems, function(elem) { elem.setAttribute(k, v); });
	});
};

var insert_at = function(child_node, parent_node, index) {
	var children = parent_node.childNodes;
	if(children.length <= index) {
		parent_node.appendChild(child_node);
	} else {
		var before_child = children[index];
		parent_node.insertBefore(child_node, before_child);
	}
};
var move_child = function(parent_node, to_index, from_index) {
	var children = parent_node.childNodes;
	if(children.length > from_index) {
		var child_node = children[from_index];
		if(parent_node) {
			if(from_index < to_index) { //If it's less than the index we're inserting at...
				to_index++; //Increase the index by 1, to make up for the fact that we're removing me at the beginning
			}
			insert_at(child_node, parent_node, to_index);
		}
	}
};

cjs.children = function(elems, children) {
	dom_setter(elems, function(elem) { elem.innerHTML = ""; });
	var ad = array_differ();
	cjs.liven(function() {
		var diff = ad(cjs.get(children, true));
		dom_setter(elems, function(elem) {
			each(diff.removed, function(info) {
				elem.removeChild(elem.children[info.index]);
			});
			each(diff.added, function(info) {
				insert_at(info.item, elem, info.to);
			});
			each(diff.moved, function(info) {
				move_child(elem, info.from, info.to);
			});
		});
	});
};

var getColorValue = function(color) {
    var t = document.createElement('div');
    t.style.display = 'none';
    t.style.color = color;
    document.body.appendChild(t);

    var style = window.getComputedStyle(t, null);
    var colorValue = style.getPropertyCSSValue('color').getRGBColorValue();
    document.body.removeChild(t);

    var hex = function(x) {
        return ('0' + parseInt(x, 10).toString(16)).slice(-2);
    }

    var hexString = '#';
    with(colorValue) {
        hexString += hex(red.cssText) + hex(green.cssText) + hex(blue.cssText);
    }

    return hexString;
};

var timings = {
	linear: function(percentage, start, end, current) {
		return percentage;
	}
	, _default: function(percentage) {
		return percentage;
	}
};
var speeds = {
	slow: 600
	, fast: 200
	, _default: 400
};
var defaults = {
	speed: "_default"
	, in_filter: function(x) {
		return x;
	}
	, out_filter: function(x) {
		return x;
	}
	, timing: "linear"
	, fps: 30
};
var get_time = function() {
	return (new Date()).getTime();
};

var hex_to_rgb = function(str) {
	var rv = [];
	for(var i = 1; i<6; i+=2) {
		rv.push(parseInt(str.substr(i, 2), 16));
	}
	return rv;
};
function decimalToHex(d, padding) {
    var hex = Number(d).toString(16);
    padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

    while (hex.length < padding) {
        hex = "0" + hex;
    }

    return hex;
}
var rgb_to_hex = function(arr) {
	var rv = "#";
	each(arr, function(item) { rv += decimalToHex(Math.round(item), 2); });
	return rv;
};

var Animation = function(options, unfiltered_from, unfiltered_to) {
	this.options = options;

	this.unfiltered_from = unfiltered_from;
	this.unfiltered_to = unfiltered_to;

	this.from = options.in_filter(this.unfiltered_from);
	this.to = options.in_filter(this.unfiltered_to);

	this.current = this.start;
	this.timing = isString(options.timing) ? (timings[options.timing] || timings._default) : options.timing;
	this.speed = isString(options.speed) ? (speeds[options.speed] || speeds._default) : options.speed;

	this.start_time = null;
	this.end_time = null;

	this.started = false;
	this.done = false;
};
(function(my) {
	var proto = my.prototype;
	proto.get = function(time) {
		if(!this.started) {
			return options.out_filter(this.from);
		} else if(this.done) {
			return options.out_filter(this.to);
		}
		time = time || get_time();
		var raw_percentage = (time - this.start_time) / (this.end_time - this.start_time);
		var percentage = this.timing(raw_percentage, this.start_time, this.end_time, this.current);

		var current_value;

		if(isArray(this.from) && isArray(this.to) &&  this.from.length === this.to.length) {
			current_value = map(this.from, function(from, index) {
				var to = this.to[index];
				return to * percentage + from * (1 - percentage);
			}, this);
		} else {
			current_value = this.to * percentage + this.from * (1 - percentage);
		}

		return this.options.out_filter(current_value);
	}
	proto.start = function() {
		this.start_time = get_time();
		this.end_time = this.start_time + this.speed;
		this.started = true;
	};
	proto.stop = function() {
		this.done = true;
		return this;
	};
}(Animation));


cjs.$.extend("anim", function(based_on, options) {
	var based_on = this;
	options = extend({}, defaults, options);

	var current_animation = null;
	var current_animation_end_timeout = null;
	var invalidation_interval = null;

	var old_val = based_on.get();
	var new_constraint = new Constraint(function() {
		if(current_animation === null) {
			return old_val;
		} else {
			var rv = current_animation.get();
			return rv;
		}
	});

	var on_change_func = function() {
		//var animate_from = new_constraint.get();
		var animate_from;
		var orig_animate_to = animate_to = based_on.get();

		if(current_animation_end_timeout === null) {
			animate_from = old_val;
		} else {
			animate_from = new_constraint.get();
			root.clearTimeout(current_animation_end_timeout);
		}

		var default_anim_options = {};
		if(isString(animate_from) && isString(animate_to)) {
			animate_from = hex_to_rgb(getColorValue(animate_from));
			animate_to = hex_to_rgb(getColorValue(animate_to));

			default_anim_options.out_filter = rgb_to_hex;
		}

		var anim_options = extend({}, options, default_anim_options);

		current_animation = new Animation(anim_options, animate_from, animate_to);
		current_animation.start();

		invalidation_interval = setInterval(new_constraint.invalidate, 1000/options.fps);
		current_animation_end_timeout = root.setTimeout(function() {
			current_animation_end_timeout = null;
			current_animation = null;
			root.clearInterval(invalidation_interval);
			invalidation_interval = null;
			new_constraint.invalidate();
		}, current_animation.speed);
		old_val = orig_animate_to;
	};

	based_on.onChange(on_change_func);

	new_constraint.destroy = function() {
		Constraint.prototype.destroy.apply(this);
		based_on.offChange(on_change_func);
	};

	return new_constraint;
});

cjs.async_$ = function(invoke_callback, timeout_interval) {
	var async_fsm = cjs	.fsm()
						.add_state("pending")
						.add_transition(function(do_transition ) {
							if(isNumber(timeout_interval)) {
								root.setTimeout(function() {
									do_transition("timeout");
								}, timeout_interval);
							}
						}, "rejected")
						.add_state("resolved")
						.add_state("rejected")
						.start_at("pending");

	var do_resolved_transition = async_fsm.get_transition("pending", "resolved");
	var do_rejected_transition = async_fsm.get_transition("pending", "rejected");

	if(isNumber(timeout_interval)) {
		root.setTimeout(function() {
			do_rejected_transition("timeout");
		}, timeout_interval);
	}
	var resolved_value, rejected_value;
	var resolved = function(value) {
		resolved_value = value;
		do_resolved_transition(value);
	};

	var rejected = function(message) {
		rejected_value = message;
		do_rejected_transition(message);
	};

	invoke_callback(resolved, rejected);


	var constraint = cjs.fsm_$(async_fsm, {
		"pending": undefined
		, "resolved": function() {
			return cjs.get(resolved_value);
		}
		, "rejected": function() {
			return cjs.get(rejected_value);
		}
	});


	constraint.state = async_fsm;

	constraint.item = function() {
		if(arguments.length === 1 && arguments[0] === "state") {
			return this.state;
		} else {
			return Constraint.prototype.item.apply(this, arguments);
		}
	};

	return constraint;
};
