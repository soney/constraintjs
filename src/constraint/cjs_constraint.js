(function(cjs, root) {
	var _ = cjs._;
	var constraint_solver = cjs._constraint_solver;
	var get_time = function() { return (new Date()).getTime(); };

	var Listener = function(constraint, callback, update_interval, context) {
		this.context = context;
		this.update_interval = update_interval;
		this.last_update = 0;

		this.update_timeout = null;

		this.callback = callback;
		this.constraint = constraint;
		//if(context === undefined) debugger;
		this.last_val = null;
	};
	(function(my) {
		var proto = my.prototype;
		proto.run = function() {
			var context = this.context || root;
			this.last_update = get_time();
			var val = this.constraint.get();
			if(this.last_val !== val) {
				this.callback.call(context, val, this.last_val);
				this.last_val = val;
			}
		};
		proto.on_change = function() {
			if(_.isNumber(this.update_interval) && this.update_interval >= 0) {
				var curr_time = get_time();
				if(curr_time - this.last_update < this.update_interval) {
					this.__callback_args = arguments;
					if(!_.has(this, "__callback_timeout")) {
						this.__callback_timeout = _.delay(_.bind(function() {
							this.run.apply(this, this.__callback_args);
							delete this.__callback_timeout;
							delete this.__callback_args;
						}, this), this.last_update + this.update_interval - curr_time);
					}
				} else {
					this.run.apply(this, arguments);
				}
			} else {
				this.run.apply(this, arguments);
			}
		};
	}(Listener));

	var Constraint = function() {
		var node = constraint_solver.addObject(this);

		this.literal = false;
		this.set.apply(this, arguments);
		this.listeners = [];
		this.cs_listener_id = null;

		this.history = {
			value: undefined
			, time: undefined
		};
		this.id = "constraint_"+node.getId();
		this.destroy_callbacks = [];
		this.bindings = [];
	};

	(function(my) {
		var proto = my.prototype;
		proto.destroy = function() {
			_.forEach(this.destroy_callbacks, function(callback) {
				callback();
			});
			_.forEach(this.bindings, function(binding) {
				binding.destroy();
			});
			constraint_solver.removeObject(this);
		};
		proto.on_destroy = function() {
			this.destroy_callbacks.push.apply(this.destroy_callbacks, arguments);
		};
		proto.off_destroy = function(func) {
			_.remove_all(this.destroy_callbacks, func);
		};
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
			if(_.has(this, "value")) {
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

		proto._on = function(event_type, callback) {
			var node = constraint_solver.getNode(this);
			var listener_id = constraint_solver.add_listener(event_type, node, callback);
			return _.bind(this._off, this, listener_id);
		};
		proto._off = function(listener_id) {
			constraint_solver.remove_listener(listener_id);
		};

		proto.onChange = function(callback, update_interval, context) {
			context = context || this;
			var listener = new Listener(this, callback, update_interval, context);

			this.listeners.push(listener);
			if(this.cs_listener_id === null) {
				this.cs_listener_id = this._on("nullify", _.bind(this.update_on_change_listeners, this));
			}
			this.last_listener = listener;
			return this;
		};
		proto.offChange = function(id) {
			this.listeners = _.reject(this.listeners, function(listener) {
				return listener === id || listener.callback === id;
			});
			if(this.listeners.length === 0) {
				if(this.cs_listener_id !== null) {
					this._off(this.cs_listener_id);
					this.cs_listener_id = null;
				}
			}
			return this;
		};
		proto.update_on_change_listeners = function() {
			_.defer(_.bind(function() {
				/*
				var old_value = this.history.value;
				var old_timestamp = this.history.timestamp;
				var value = this.get();
				if(value !== old_value) {
					var event = {
						value: value
						, timestamp: get_time()
						//, constraint: this
						, old_value: old_value
						, old_timestamp: old_timestamp
					};
					*/
					_.forEach(this.listeners, function(listener) {
						listener.on_change();
					});
					/*
				}
				*/
			}, this));
		};
		proto.influences = proto.depends_on_me = function(recursive) {
			return constraint_solver.influences(this, recursive);
		};
		proto.depends_on = function(recursive) {
			return constraint_solver.dependsOn(this, recursive);
		};
		proto.length = function() {
			var val = this.get();
			return val.length;
		};
		proto.push_binding = function(binding) {
			this.bindings.push(binding);
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

	cjs.constraint = create_constraint;
	cjs.define("constraint", cjs.constraint);

	cjs.constraint.raw_mixin = function(propname, propval) {
		Constraint.prototype[propname] = function() {
			var args = _.toArray(arguments);
			args.unshift(this);
			return propval.apply(this, args);
		};
		cjs.constraint[propname] = function() {
			var args = _.toArray(arguments);
			return propval.apply(this, args);
		};
	};

	cjs.constraint.mixin = function(arg0, arg1) {
		var mixin_obj;
		if(_.isString(arg0)) {
			mixin_obj = {};
			mixin_obj[arg0] = arg1;
		} else {
			mixin_obj = arg0;
		}

		_.forEach(mixin_obj, function(propval, propname) {
			cjs.constraint.raw_mixin(propname, function() {
				var args = _.toArray(arguments);
				var val = cjs.get(_.first(args));
				return cjs.create("constraint", function() {
					return propval.apply(this, ([val]).concat(_.rest(args)));
				});
			});
		});
	};

	cjs.is_constraint = function(obj, recursive) {
		if(obj instanceof Constraint) {
			return true;
		} else {
			if(recursive === true) {
				if(_.isArray(obj)) {
					return _.any(obj, function(o) {
						return cjs.is_constraint(o, recursive);
					});
				}
				return false;
			} else {
				return false;
			}
		}
	};
	cjs.get = function(obj, recursive) {
		var rv;
		if(cjs.is_constraint(obj)) {
			rv = obj.get();
		} else {
			rv = obj;
		}

		if(recursive === true) {
			if(_.isArray(rv)) {
				rv = _.map(rv, function(elem) {
					return cjs.get(elem, recursive);
				});
			}
			return rv;
		} else {
			return rv;
		}
	};
	cjs.get_item = function(obj, index) {
		var o = cjs.get(obj);
		var i = cjs.get(index);

		return o[i];
	};
}(cjs, this));
