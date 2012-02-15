(function(cjs, root) {
	var _ = cjs._;
	var constraint_solver = cjs._constraint_solver;
	var get_time = function() { return (new Date()).getTime(); };

	cjs.fn = {};

	var Listener = function(callback, context, name) {
		this.context = context;
		this.callback = callback;
		this.name = name;
	};
	(function(my) {
		var proto = my.prototype;
		proto.get_name = function() { return this.name; };
		proto.run = function() {
			var context = this.context || root;

			this.callback.apply(context, arguments);
		};
	}(Listener));

	var Constraint = function() {
		constraint_solver.addObject(this);
		this.literal = false;
		this.set.apply(this, arguments);
		this.listeners = [];
		this.cs_listener_id = null;

		this.history = {
			value: undefined
			, time: undefined
		};
	};

	(function(my) {
		my.prototype = cjs.fn;

		var proto = my.prototype;
		proto.nullify = function() {
			constraint_solver.nullify(this);
		};
		proto.nullifyAndEval = function() {
			//Create a copy of what our value was
			var history = _.clone(this.history);

			//The historical value will be erased in nullifyAndEval, as we will get re-evaled...
			var new_value = constraint_solver.nullifyAndEval(this);

			//...so repopulate the history as if we just only got nullified.
			this.history.value = history.value;
			this.history.time = history.time;

			// And act as if we were just nullified...
			this.on_nullified();

			return new_value;
		};
		proto.cs_eval = function() {
			var rv;
			if(this.hasOwnProperty("value")) {
				if(this.literal) {
					rv = this.value;
				} else if(_.isFunction(this.value)){
					rv = this.value();
				} else {
					rv = cjs.get(this.value);
				}
			}

			this.history.value = rv;
			this.history.time = get_time();

			return rv;
		};
		proto.set = function(value, literal, update_fn) {
			var was_literal = this.literal;
			var old_value = this.value;

			if(arguments.length < 2) {
				this.literal = !_.isFunction(value) && !cjs.is_constraint(value);
			} else {
				this.literal = literal === true;
			}

			this.value = value;

			
			if(was_literal !== this.literal || old_value !== this.value) {
				this.nullify();
			}

			if(_.isFunction(update_fn)) {
				this.update(update_fn);
			}
			return this;
		};
		proto.get = function() {
			return constraint_solver.getValue(this);
		};
		proto.update = function(arg0) {
			if(arguments.length === 0) {
				this.nullify();
			} else {
				var self = this;
				var do_nullify = function() {
					self.nulllify();
				};
				if(_.isFunction(arg0)) {
					arg0(do_nullify);
				}
			}
			return this;
		};
		proto.onChange = function(callback, context, name) {
			var listener = new Listener(callback, context, name);

			this.listeners.push(listener);
			if(this.cs_listener_id === null) {
				this.cs_listener_id = constraint_solver.add_listener("nullify", _.bind(this.on_nullified, this));
			}
			return this;
		};
		proto.offChange = function(id) {
			this.listeners = _.reject(this.listeners, function(listener) {
				return listener === id || listener.get_name() === id;
			});
			if(this.listeners.length === 0) {
				if(this.cs_listener_id !== null) {
					constraint_solver.removeEventListener(this.cs_listener_id);
					this.cs_listener_id = null;
				}
			}
			return this;
		};
		proto.on_nullified = function() {
			_.defer(_.bind(function() {
				var old_value = this.history.value;
				var old_timestamp = this.history.timestamp;
				var value = this.get();
				if(value !== old_value) {
					var event = {
						value: value
						, timestamp: get_time()
						, constraint: this
						, old_value: old_value
						, old_timestamp: old_timestamp
					};
					_.forEach(this.listeners, function(listener) {
						listener.run(value, event);
					});
				}
			}, this));
		};
	}(Constraint));

	var create_constraint = function(arg0, arg1, arg2, arg3) {
		var constraint;
		if(arguments.length === 0) {
			constraint = new Constraint(undefined);
		} else if(arguments.length === 1) {
			constraint = new Constraint(arg0);
		} else {
			if(arguments.length === 2 && _.isBoolean(arg1)) {
				constraint = new Constraint(arg0, arg1);
			} else {
				constraint = new Constraint(arg0, arg1, arg2, arg3);
			}
		}

		return constraint;
	};

	cjs.define("simple_constraint", create_constraint);


	var is_constraint = function(obj) {
		return obj instanceof Constraint;
	};
	cjs.is_constraint = is_constraint;
	cjs.get = function(obj) {
		if(is_constraint(obj)) {
			return obj.get();
		} else {
			return obj;
		}
	};
	cjs.type("simple_constraint", Constraint);
}(cjs, this));
