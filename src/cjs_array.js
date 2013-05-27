	var get_categorical_listeners = function (proto, events) {
		proto._initialize_listeners = function () {
			this._semaphore = 0;
			this.__running_listeners = false;
			this._queued_events = [];
			var listeners = this._listeners = {};
			each(events, function (arr_name, diff_event) {
				listeners[arr_name] = [];
			});
		};
		each(events, function (arr_name, diff_event) {
			proto["on" + diff_event] = function (callback, context) {
				var listener_info = {
					callback: callback,
					context: context || this
				};
				var arr = this._listeners[arr_name];
				arr.push(listener_info);
				return this;
			};
			proto["off" + diff_event] = function (callback) {
				var arr = this._listeners[arr_name];

				var listener_index = index_where(arr, function (listener_info) {
					return listener_info.callback === callback;
				});

				if (listener_index >= 0) {
					delete arr[listener_index];
					arr.splice(listener_index, 1);
				}

				return this;
			};
		});

		proto.wait = function () {
			this._semaphore -= 1;
			return this;
		};

		proto.signal = function () {
			this._semaphore += 1;
			if (this._semaphore >= 0 && !this.__running_listeners) {
				this.__running_listeners = true;
				this._run_listeners();
				this.__running_listeners = false;
			}
			return this;
		};

		proto._run_listeners = function () {
			var queued_events = this._queued_events,
				run_listener = function (queued_event, listener_info) {
					var callback = listener_info.callback;
					var context = listener_info.context;
					callback.apply(context, queued_event);
				};
			while (queued_events.length > 0) {
				var queued_event = queued_events.shift();
				var type = queued_event.shift();
				var listeners = this._listeners[type];
				each(listeners, bind(run_listener, this, queued_event));
			}
		};
	};

	//
	// ============== ARRAYS ============== 
	//

	var ArrayConstraint = function (options) {
		options = extend({
			equals: eqeqeq,
			value: []
		}, options);
		this._value = [];
		this._unsubstantiated_items = [];

		if (isArray(options.value)) {
			var i, len = options.value.length;
			for (i = 0; i < len; i += 1) {
				var val = options.value[i];
				this._value[i] = new SettableConstraint(val, true);
			}
		}
		this.$len = new SettableConstraint(this._value.length);

		this._equality_check = options.equals;

		this._initialize_listeners();
	};

	(function (my) {
		var proto = my.prototype;

		var add_event_str = "add"; // value, index
		var remove_event_str = "remove"; // value, index
		var index_change_event_str = "index_change"; // value, to_index, from_index
		var value_change_event_str = "value_change"; // to_value, from_value, index

		get_categorical_listeners(proto, {
			"Add":  add_event_str,
			"Remove":  remove_event_str,
			"IndexChange":  index_change_event_str,
			"ValueChange":  value_change_event_str
		});

		proto.set_equality_check = function (equality_check) {
			this._equality_check = equality_check;
			return this;
		};

		proto.each = function (func, context) {
			context = context || root;
			var i, len = this.length();
			for (i = 0; i < len; i += 1) {
				if (func.call(context, this.get(i), i) === false) {
					break;
				}
			}
			return this;
		};
		proto.get = function (key) {
			var val = this._value[key];
			if (val === undefined) {
				// Create a dependency so that if the value for this key changes
				// later on, we can detect it in the constraint solver
				val = new SettableConstraint(undefined);
				this._unsubstantiated_items[key] = val;
			}
			return val.get();
		};
		proto.put = function (key, val) {
			cjs.wait();
			this.wait();
			var $previous_value = this._value[key];
			if ($previous_value === undefined && has(this._unsubstantiated_items, key)) {
				$previous_value = this._unsubstantiated_items[key];
				delete this._unsubstantiated_items[key];
			}

			if (cjs.is_$($previous_value)) {
				var prev_val = $previous_value.get();
				$previous_value.set(val, true);
				this._queued_events.push([value_change_event_str, val, key, prev_val]);
			} else {
				this._value[key] = new SettableConstraint(val, true);
				this._queued_events.push([add_event_str, val, key]);
			}
			this._update_len();
			this.signal();
			cjs.signal();
			return this;
		};
		proto.i = proto.item = function (key, val) {
			if (arguments.length === 1) {
				return this.get(key);
			} else if (arguments.length > 1) {
				return this.put(key, val);
			}
		};
		proto.destroy = function () {
			this.$len.destroy();
		};
		proto.length = function () {
			return this.$len.get();
		};
		proto.push = function () {
			var i, len = arguments.length;
			//Make operation atomic
			cjs.wait();
			this.wait();
			for (i = 0; i < len; i += 1) {
				this.put(this._value.length, arguments[i]);
			}
			this.signal();
			cjs.signal();
			return arguments.length;
		};
		proto.pop = function () {
			cjs.wait();
			this.wait();

			var $value = this._value.pop();
			var len = this._value.length;
			var rv;
			if (cjs.is_$($value)) {
				rv = $value.get();
				$value.destroy();
				this._queued_events.push([remove_event_str, rv, len]);
			}
			this._update_len();

			this.signal();
			cjs.signal();
			
			return rv;
		};
		proto.clear = function () {
			var $val;
			cjs.wait();
			this.wait();

			while (this._value.length > 0) {
				$val = this._value.pop();
				var len = this._value.length;
				if (cjs.is_constraint($val)) {
					this._queued_events.push([remove_event_str, $val.get(), len]);
					$val.destroy();
				}
			}
			this._update_len();

			this.signal();
			cjs.signal();
			return this;
		};
		proto.set = function (arr) {
			cjs.wait();
			this.wait();

			this.clear();
			this.push.apply(this, arr);

			this.signal();
			cjs.signal();
			return this;
		};
		proto.toArray = function () {
			var rv = [];
			this.each(function (v, i) { rv[i] = v; });
			return rv;
		};
		proto._update_len = function () {
			this.$len.set(this._value.length);
		};
		proto.indexWhere = function (filter) {
			var i, len = this._value.length, $val;

			for (i = 0; i < len; i += 1) {
				$val = this._value[i];
				if (filter($val.get())) {
					return i;
				}
			}
			this.length(); // We want to depend on the length if not found

			return -1;
		};
		proto.lastIndexWhere = function (filter) {
			var i, len = this.length(), $val;

			for (i = len - 1; i >= 0; i -= 1) {
				$val = this._value[i];
				if (filter($val.get())) { return i; }
			}
			return -1;
		};
		proto.indexOf = function (item, equality_check) {
			equality_check = equality_check || this._equality_check;
			var filter = function (x) { return equality_check(x, item); };
			return this.indexWhere(filter);
		};
		proto.lastIndexOf = function (item, equality_check) {
			equality_check = equality_check || this._equality_check;
			var filter = function (x) { return equality_check(x, item); };
			return this.lastIndexWhere(filter);
		};
		var isPositiveInteger = function (val) {
			return isNumber(val) && Math.round(val) === val && val >= 0;
		};
		proto.splice = function (index, howmany) {
			var i;
			if (!isNumber(howmany)) { howmany = 0; }
			if (!isPositiveInteger(index) || !isPositiveInteger(howmany)) {
				throw new Error("index and howmany must be positive integers");
			}
			var to_insert = slice.call(arguments, 2);

			cjs.wait();
			this.wait();
			var resulting_shift_size = to_insert.length - howmany;
			var removed = [];

			for (i = index; i < index + howmany; i += 1) {
				removed.push(this.item(i));
			}

			if (resulting_shift_size < 0) {
				for (i = index; i < this._value.length + resulting_shift_size; i += 1) {
					if (i < index + to_insert.length) {
						this.put(i, to_insert[i - index]);
					} else {
						this.put(i, this.get(i - resulting_shift_size));
					}
				}
				for (i = 0; i < -resulting_shift_size; i += 1) {
					this.pop();
				}
			} else {
				for (i = this._value.length + resulting_shift_size - 1; i >= index; i -= 1) {
					if (i - index < to_insert.length) {
						this.put(i, to_insert[i - index]);
					} else {
						this.put(i, this.get(i - resulting_shift_size));
					}
				}
			}

			this._update_len();
			this.signal();
			cjs.signal();
			return removed;
		};
		proto.shift = function () {
			var rv_arr = this.splice(0, 1);
			return rv_arr[0];
		};
		proto.unshift = function () {
			var args = toArray(arguments);
			this.splice.apply(this, ([0, 0]).concat(args));
			return this._value.length;
		};

		proto.concat = function () {
			var args = [], i, len = arguments.length;
			for (i = 0; i < len; i += 1) {
				var arg = arguments[i];
				if (arg instanceof ArrayConstraint) {
					args.push(arg.toArray());
				} else {
					args.push(arg);
				}
			}
			var my_val = this.toArray();
			return my_val.concat.apply(my_val, args);
		};
		each(["filter", "join", "slice", "sort", "reverse", "valueOf", "toString"], function (fn_name) {
			proto[fn_name] = function () {
				var my_val = this.toArray();
				return my_val[fn_name].apply(my_val, arguments);
			};
		});
	}(ArrayConstraint));

	cjs.array = function (value) { return new ArrayConstraint(value); };
	cjs.is_array = function (obj) { return obj instanceof ArrayConstraint; };
	cjs.ArrayConstraint = ArrayConstraint;
