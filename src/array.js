	//
	// ============== ARRAYS ============== 
	//

	var ArrayConstraint = function (options) {
		options = extend({
			equals: eqeqeq,
			value: []
		}, options);
		this._value = [];

		// Every value in the array constraint is a constraint
		this._value = map(options.value, function(val) {
			return new Constraint(val, {literal: true});
		});

		this._unsubstantiated_items = [];
		this.$len = new Constraint(this._value.length);
		this._equality_check = options.equals;
	};

	(function (my) {
		var proto = my.prototype;
		my.BREAK = {};

		proto.set_equality_check = function (equality_check) {
			this._equality_check = equality_check;
			return this;
		};

		// Run through every element of the array
		proto.each = function (func, context) {
			var i, len = this._value.length;
			context = context || root;
			for (i = 0; i < len; i += 1) {
				if (func.call(context, this._get(i), i) === my.BREAK) {
					break;
				}
			}
			this.length(); // We want to depend on the length if we don't break beforehand
			return this;
		};

		proto.map = function (func, context) {
			var i, len = this.length(), rv = [];
			context = context || root;
			for (i = 0; i < len; i += 1) {
				rv[i] = func.call(context, this._get(i), i);
			}
			return rv;
		};

		// Get a particular item or the whole array if key isn't specified
		proto._get = function (key) {
			var val = this._value[key];
			if (val === undefined) {
				// Create a dependency so that if the value for this key changes
				// later on, we can detect it in the constraint solver
				val = new Constraint(undefined);
				this._unsubstantiated_items[key] = val;
			}
			return val.get();
		};

		// Replaces the whole value for arr
		proto.setValue = function (arr) {
			cjs.wait();

			this._clear();
			this.push.apply(this, arr);

			cjs.signal();
			return this;
		};

		// For internal use
		proto._put = function (key, val) {
			cjs.wait();
			var $previous_value = this._value[key];
			if ($previous_value === undefined && has(this._unsubstantiated_items, key)) {
				$previous_value = this._unsubstantiated_items[key];
				delete this._unsubstantiated_items[key];
			}

			if (cjs.is_constraint($previous_value)) {
				var prev_val = $previous_value.get();
				$previous_value.set(val, true);
			} else {
				this._value[key] = new Constraint(val, true);
			}
			this._update_len();
			cjs.signal();
			return this;
		};

		// Get or put item i
		proto.i = proto.item = function (key, val) {
			if (arguments.length === 1) {
				return this._get(key);
			} else if (arguments.length > 1) {
				return this._put(key, val);
			}
		};
		proto.destroy = function (silent) {
			this.clear();
			this.$len.destroy(silent);
		};
		proto.length = function () {
			return this.$len.get();
		};
		
		// add to the end of the array
		proto.push = function () {
			var i, len = arguments.length;
			//Make operation atomic
			cjs.wait();
			for (i = 0; i < len; i += 1) {
				this._put(this._value.length, arguments[i]);
			}
			cjs.signal();
			return arguments.length;
		};

		// Remove from the end of the array
		proto.pop = function () {
			cjs.wait();

			var $value = this._value.pop();
			var rv;
			if (cjs.is_constraint($value)) {
				rv = $value.get();
				$value.destroy();
			}
			this._update_len();

			cjs.signal();
			
			return rv;
		};

		proto._clear = function () {
			var $val;
			cjs.wait();

			while (this._value.length > 0) {
				$val = this._value.pop();
				var len = this._value.length;
				if (cjs.is_constraint($val)) {
					$val.destroy();
				}
			}
			this._update_len();

			cjs.signal();
			return this;
		};
		proto.toArray = function () {
			return this.map(identity);
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

			// Don't run anyu listeners until we're done
			cjs.wait();
			var resulting_shift_size = to_insert.length - howmany;
			var removed = [];

			for (i = index; i < index + howmany; i += 1) {
				removed.push(this.item(i));
			}

			// If we have to remove items
			if (resulting_shift_size < 0) {
				for (i = index; i < this._value.length + resulting_shift_size; i += 1) {
					if (i < index + to_insert.length) {
						this._put(i, to_insert[i - index]);
					} else {
						this._put(i, this._get(i - resulting_shift_size));
					}
				}
				for (i = 0; i < -resulting_shift_size; i += 1) {
					this.pop();
				}
			} else {
				for (i = this._value.length + resulting_shift_size - 1; i >= index; i -= 1) {
					if (i - index < to_insert.length) {
						this._put(i, to_insert[i - index]);
					} else {
						this._put(i, this._get(i - resulting_shift_size));
					}
				}
			}

			this._update_len();
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
				if (cjs.is_array(arg)) {
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
		proto.dynamicMap = function(map_func, options) {
			options = extend({basis: this}, options);
			return new DynamicArrayMap(options);
		};
	}(ArrayConstraint));

	
	var DynamicArrayMap = function(options) {
		options = extend({
			func: identity,
			context: root,
			equals: eqeqeq
		}, options);
		
		this._basis = options.basis;
		this._map_func = options.func;
		this._context = options.context;
		this._equality_check = options.equals;

		this.item = cjs.memoize(function(i) {
			var val = this._basis._get(i);
			return this._map_func.call(this._context, val);
		}, {
			context: this
		});
	};

	(function(my) {
		var proto = my.prototype;
		my.BREAK = ArrayConstraint.BREAK;

		proto.destroy = function() {
			this.item.destroy();
		};

		// Run through every element of the array
		proto.each = function (func, context) {
			var i, len = this._value.length;
			context = context || root;
			for (i = 0; i < len; i += 1) {
				if (func.call(context, this.item(i), i) === my.BREAK) {
					break;
				}
			}
			this.length(); // We want to depend on the length if we don't break beforehand
			return this;
		};

		proto.map = function (func, context) {
			var i, len = this.length(), rv = [];
			context = context || root;
			for (i = 0; i < len; i += 1) {
				rv[i] = func.call(context, this.item(i), i);
			}
			return rv;
		};
		proto.length = function() {
			return this._basis.length();
		};
		proto.indexWhere = function (filter) {
			var i, len = this._value.length, $val;

			for (i = 0; i < len; i += 1) {
				if (filter(this.item(i))) {
					return i;
				}
			}
			this.length(); // We want to depend on the length if not found

			return -1;
		};
		proto.lastIndexWhere = function (filter) {
			var i, len = this.length(), $val;

			for (i = len - 1; i >= 0; i -= 1) {
				if (filter(this.item(i))) {
					return i;
				}
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
		each(["filter", "join", "slice", "sort", "reverse", "valueOf", "toString"], function (fn_name) {
			proto[fn_name] = function () {
				var my_val = this.toArray();
				return my_val[fn_name].apply(my_val, arguments);
			};
		});
		proto.dynamicMap = function(map_func, options) {
			options = extend({basis: this}, options);
			return new DynamicArrayMap(options);
		};
		proto.toArray = function () {
			return this.map(identity);
		};
	} (DynamicArrayMap));

	cjs.array = function (value) { return new ArrayConstraint(value); };
	cjs.is_array = function (obj) { return (obj instanceof ArrayConstraint) || (obj instanceof DynamicArrayMap); };
	cjs.Array = ArrayConstraint;
