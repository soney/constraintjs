	//
	// ============== MAPS ============== 
	//

	var defaulthash = function (key) { return key.toString(); };
	var get_str_hash_fn = function (prop_name) {
		return function (key) {
			return key[prop_name]();
		};
	};
	var MapConstraint = function (options) {
		options = extend({
			hash: defaulthash,
			valuehash: false,
			equals: eqeqeq,
			valueequals: eqeqeq,
			value: {},
			keys: [],
			values: [],
			literal_values: true
		}, options);
		each(options.value, function (v, k) {
			options.keys.push(k);
			options.values.push(v);
		}, this);
		this._default_literal_values = !!options.literal_values;
		this._equality_check = options.equals;
		this._vequality_check = options.valueequals;
		this._hash = isString(options.hash) ? get_str_hash_fn(options.hash) : options.hash;

		this._khash = {};
		if (options.valuehash) {
			this._vhash = {};
			if (isFunction(options.valuehash)) {
				this._valuehash = options.valuehash;
			} else if (isString(options.valuehash)) {
				this._valuehash = get_str_hash_fn(options.valuehash);
			} else {
				this._valuehash = defaulthash;
			}
		} else {
			this._vhash = false;
		}

		this._ordered_values = [];
		var index = 0;
		var is_literal = this._default_literal_values;
		each(options.keys, function (k, i) {
			var v = options.values[i];
			var info = { key: new SettableConstraint(k, true), value: new SettableConstraint(v, is_literal), index: new SettableConstraint(index, true) };
			var hash = this._hash(k);
			var hash_val = this._khash[hash];

			if (hash_val) {
				hash_val.push(info);
			} else {
				this._khash[hash] = [info];
			}

			if (this._vhash) {
				var value_hash = this._valuehash(v);
				var vhash_val = this._vhash[value_hash];
				if (vhash_val) {
					vhash_val.push(info);
				} else {
					this._vhash[value_hash] = [info];
				}
			}

			this._ordered_values[index] = info;
			index += 1;
		}, this);

		this._unsubstantiated_values = {};

		this.$keys = new Constraint(bind(this._do_get_keys, this));
		this.$values = new Constraint(bind(this._do_get_values, this));
		this.$entries = new Constraint(bind(this._do_get_entries, this));
		this.$size = new Constraint(bind(this._do_get_size, this));

		this._initialize_listeners();
	};

	(function (my) {
		var proto = my.prototype;

		var index_change_event_str = "index_change"; // value, key, to, from
		var put_event_str = "put"; // value, key, index
		var remove_event_str = "remove"; // value, key, index
		var value_change_event_str = "value_change"; // to_value, key, from_value, index
		var move_event_str = "move"; // value, key, to_index, from_index

		get_categorical_listeners(proto, {
			"Put":  put_event_str,
			"Remove":  remove_event_str,
			"ValueChange":  value_change_event_str,
			"IndexChange":  index_change_event_str,
			"Move":  move_event_str
		});

		proto._find_key = function (key, fetch_unsubstantiated, create_unsubstantiated) {
			var hash = this._hash(key);
			var rv = {
				hv: false,
				i: -1,
				h: hash,
				ui: -1,
				uhv: false
			};

			var eq = this._equality_check;
			var index_where_fn = function (a, b) {
				return eq(a.key.get(), key);
			};

			var hash_values = this._khash[hash];
			if (isArray(hash_values)) {
				var key_index = index_where(hash_values, index_where_fn);
				rv.hv = hash_values;
				rv.i = key_index;
			}

			if (rv.i < 0 && fetch_unsubstantiated !== false) { //Not found
				var unsubstantiated_values = this._unsubstantiated_values[hash];
				var unsubstantiated_index = -1;
				if (isArray(unsubstantiated_values)) {
					unsubstantiated_index = index_where(unsubstantiated_values, index_where_fn);
				} else {
					if (create_unsubstantiated) {
						unsubstantiated_values = this._unsubstantiated_values[hash] = [];
					}
				}

				if (unsubstantiated_index < 0 && create_unsubstantiated === true) {
					var is_literal = this._default_literal_values;
					var unsubstantiated_info = { key: new SettableConstraint(key, true), value: new SettableConstraint(undefined, is_literal), index: new SettableConstraint(-1, true) };
					unsubstantiated_values.push(unsubstantiated_info);
					unsubstantiated_index = unsubstantiated_values.length - 1;
				}
				rv.uhv = unsubstantiated_values;
				rv.ui = unsubstantiated_index;
			}
			return rv;
		};
		var _do_set_item_ki = function (ki, key, value, index, literal, ignore_events) {
			var key_index = ki.i,
				hash_values = ki.hv,
				hash = ki.h;
			var i, value_hash, vhash_val;
			if (!hash_values) {
				hash_values = this._khash[hash] = [];
			}

			var is_literal = literal === undefined ? this._default_literal_values : !!literal;
			var info;
			if (key_index >= 0) {
				info = hash_values[key_index];
				var old_value = info.value.get();

				if (this._vhash) {
					var old_value_hash = this._valuehash(old_value);
					value_hash = this._valuehash(value);
					var old_vhash_val = this._vhash[old_value_hash];

					if (old_vhash_val) {
						var len = old_vhash_val.length;
						for (i = 0; i < len; i += 1) {
							if (old_vhash_val[i] === info) {
								old_vhash_val.splice(i, 1);
								break;
							}
						}
						if (old_vhash_val.length === 0) {
							delete this._vhash[old_value_hash];
						}
					}

					vhash_val = this._vhash[value_hash];

					if (vhash_val) {
						vhash_val.push(info);
					} else {
						this._vhash[value_hash] = [info];
					}
				}

				info.value.set(value, is_literal);
				if (ignore_events !== true) {
					this._queued_events.push([value_change_event_str, info.value, info.key, old_value, info.index]);
				}
			} else {
				if (!isNumber(index) || index < 0) {
					index = this._ordered_values.length;
				}
				var unsubstantiated_index = ki.ui;
				if (unsubstantiated_index >= 0) {
					var unsubstantiated_hash_values = ki.uhv,
						unsubstantiated_info = unsubstantiated_hash_values[unsubstantiated_index];

					unsubstantiated_hash_values.splice(unsubstantiated_index, 1);
					if (unsubstantiated_hash_values.length === 0) {
						delete this._unsubstantiated_values[hash];
					}

					info = unsubstantiated_info;
					info.value.set(value, is_literal);
					info.index.set(index, true);
				} else {
					info = { key: new SettableConstraint(key, true), value: new SettableConstraint(value, is_literal), index: new SettableConstraint(index, true) };
				}

				hash_values.push(info);

				if (this._vhash) {
					value_hash = this._valuehash(value);
					vhash_val = this._vhash[value_hash];
					if (vhash_val) {
						vhash_val.push(info);
					} else {
						this._vhash[value_hash] = [info];
					}
				}

				this._ordered_values.splice(index, 0, info);

				if (ignore_events !== true) {
					this._queued_events.push([put_event_str, value, key, index]);
				}
				for (i = index + 1; i < this._ordered_values.length; i += 1) {
					this._set_index(this._ordered_values[i], i, ignore_events);
				}
				this.$size.invalidate();
				this.$keys.invalidate();
			}
			this.$values.invalidate();
			this.$entries.invalidate();
		};

		proto._set_index = function (info, to_index, ignore_events) {
			var old_index = info.index.get;
			info.index.set(to_index);
			if (ignore_events !== false) {
				this._queued_events.push([index_change_event_str, info.value, info.key, info.index, old_index]);
			}
		};
		var _destroy_info = function (infos) {
			each(infos, function (info) {
				info.key.destroy();
				info.value.destroy();
				info.index.destroy();
			});
		};
		proto._remove_index = function (index) {
			var info = this._ordered_values[index];
			this._queued_events.push([remove_event_str, info.value.get(), info.key.get(), info.index.get()]);
			_destroy_info(this._ordered_values.splice(index, 1));
			this.$size.invalidate();
		};

		proto.set = proto.put = function (key, value, index, literal) {
			cjs.wait();
			this.wait();
			var ki = this._find_key(key, true, false);
			_do_set_item_ki.call(this, ki, key, value, index, literal);
			this.signal();
			cjs.signal();
			return this;
		};
		proto.remove = function (key) {
			var ki = this._find_key(key, false, false);
			var key_index = ki.i,
				hash_values = ki.hv;
			var i;
			if (key_index >= 0) {
				cjs.wait();
				this.wait();

				var info = hash_values[key_index];
				var ordered_index = info.index.get();

				hash_values.splice(key_index, 1);
				if (hash_values.length === 0) {
					delete hash_values[key_index];
				}

				if (this._vhash) {
					var value_hash = this._valuehash(info.value.get());
					var vhash_val = this._vhash[value_hash];
					if (vhash_val) {
						var len = vhash_val.length;
						for (i = 0; i < len; i += 1) {
							if (vhash_val[i] === info) {
								vhash_val.splice(i, 1);
								break;
							}
						}
						if (vhash_val.length === 0) {
							delete this._vhash[value_hash];
						}
					}
				}

				this._remove_index(ordered_index);
				for (i = ordered_index; i < this._ordered_values.length; i += 1) {
					this._set_index(this._ordered_values[i], i);
				}

				this.$keys.invalidate();
				this.$values.invalidate();
				this.$entries.invalidate();

				this.signal();
				cjs.signal();
			}
			return this;
		};
		proto.get = function (key) {
			var ki = this._find_key(key, true, true);
			var key_index = ki.i,
				hash_values = ki.hv;
			if (key_index >= 0) {
				var info = hash_values[key_index];
				return info.value.get();
			} else {
				var unsubstantiated_info = ki.uhv[ki.ui];
				return unsubstantiated_info.value.get();
			}
		};
		proto.keys = function () {
			return this.$keys.get();
		};
		proto._do_get_keys = function () {
			var rv = [];
			this.each(function (value, key) {
				rv.push(key);
			});
			return rv;
		};
		proto.clear = function () {
			if (this._do_get_size() > 0) {
				cjs.wait();
				this.wait();
				while (this._ordered_values.length > 0) {
					this._remove_index(0);
				}
				each(this._khash, function (arr, hash) {
					delete this._khash[hash];
				}, this);
				if (this._vhash) {
					each(this._vhash, function (arr, hash) {
						delete this._vhash[hash];
					}, this);
				}

				this.$keys.invalidate();
				this.$values.invalidate();
				this.$entries.invalidate();
				this.$size.invalidate();

				this.signal();
				cjs.signal();
			}
			return this;
		};
		proto.values = function () {
			return this.$values.get();
		};
		proto._do_get_values = function () {
			var rv = [];
			this.each(function (value, key) {
				rv.push(value);
			});
			return rv;
		};
		proto._do_get_size = function () {
			return this._ordered_values.length;
		};
		proto.size = function () {
			return this.$size.get();
		};
		proto.entries = function () {
			return this.$entries.get();
		};
		proto._do_get_entries = function () {
			var rv = [];
			this.each(function (value, key) {
				rv.push({key: key, value: value});
			});
			return rv;
		};
		proto.each_key = function (func, context) {
			context = context || root;
			var i, len = this.size();
			for (i = 0; i < len; i += 1) {
				var info = this._ordered_values[i];
				if (info) {
					if (func.call(context, info.key.get(), i) === false) {
						break;
					}
				}
			}
			return this;
		};
		proto.each = function (func, context) {
			context = context || root;
			var i, len = this.size();
			for (i = 0; i < len; i += 1) {
				var info = this._ordered_values[i];
				if (info) {
					if (func.call(context, info.value.get(), info.key.get(), info.index.get()) === false) {
						break;
					}
				}
			}
			return this;
		};
		proto.set_equality_check = function (equality_check) {
			this._equality_check = equality_check;
			return this;
		};
		proto.set_value_equality_check = function (vequality_check) {
			this._vequality_check = vequality_check;
			return this;
		};
		proto.set_hash = function (hash) {
			this._hash = isString(hash) ? get_str_hash_fn(hash) : hash;
			this._khash = {};
			this._unsubstantiated_values = {};
			each(this._ordered_values, function (info) {
				var key = info.key.get();
				var hash = this._hash(key);
				var hash_val = this._khash[hash];
				if (hash_val) {
					hash_val.push(info);
				} else {
					this._khash[hash] = [info];
				}
			}, this);
			return this;
		};
		proto.set_value_hash = function (vhash) {
			this._valuehash = isString(vhash) ? get_str_hash_fn(vhash) : vhash;

			this._vhash = {};
			if (this._valuehash) {
				each(this._ordered_values, function (info) {
					var value = info.value.get();
					var hash = this._valuehash(value);
					var hash_val = this._vhash[hash];
					if (hash_val) {
						hash_val.push(info);
					} else {
						this._vhash[hash] = [info];
					}
				}, this);
			}
			return this;
		};
		proto.item = function (arg0, arg1, arg2) {
			if (arguments.length === 1) {
				return this.get(arg0);
			} else if (arguments.length >= 2) {
				this.put(arg0, arg1, arg2);
			}
			return this;
		};
		proto.indexOf = function (key) {
			var ki = this._find_key(key, true, true);
			var key_index = ki.i,
				hash_values = ki.hv;
			if (key_index >= 0) {
				var info = hash_values[key_index];
				return info.index.get();
			} else {
				var unsubstantiated_info = ki.uhv[ki.ui];
				return unsubstantiated_info.index.get();
			}
		};
		proto.get_or_put = function (key, create_fn, create_fn_context, index, literal) {
			var ki = this._find_key(key, true, false);
			var key_index = ki.i,
				hash_values = ki.hv,
				hash = ki.h;
			if (key_index >= 0) {
				var info = hash_values[key_index];
				return info.value.get();
			} else {
				cjs.wait();
				this.wait();
				var context = create_fn_context || root;
				var value = create_fn.call(context, key);
				_do_set_item_ki.call(this, ki, key, value, index, literal);
				this.signal();
				cjs.signal();
				return value;
			}
		};
		proto.has = proto.containsKey = function (key) {
			var ki = this._find_key(key, true, true);
			var key_index = ki.i;
			if (key_index >= 0) {
				return true;
			} else {
				var unsubstantiated_info = ki.uhv[ki.ui];
				unsubstantiated_info.value.update(); // Add a dependency
				return false;
			}
		};

		proto.move_index = function (old_index, new_index) {
			var i;
			cjs.wait();
			this.wait();
			var info = this._ordered_values[old_index];
			this._ordered_values.splice(old_index, 1);
			this._ordered_values.splice(new_index, 0, info);
			this._queued_events.push([move_event_str, info.value.get(), info.key.get(), new_index, old_index]);

			var low = Math.min(old_index, new_index);
			var high = Math.max(old_index, new_index);
			for (i = low; i <= high; i += 1) {
				this._set_index(this._ordered_values[i], i);
			}
			this.$keys.invalidate();
			this.$values.invalidate();
			this.$entries.invalidate();
			this.signal();
			cjs.signal();
			return this;
		};
		proto.move = function (key, to_index) {
			var ki = this._find_key(key, false, false);
			var key_index = ki.i;
			if (key_index >= 0) {
				var info = ki.hv[key_index];
				this.move_index(info.index.get(), to_index);
			}
			return this;
		};
		proto.keyForValue = function (value, eq_check) {
			eq_check = eq_check || this._vequality_check;
			var i;
			if (this._vhash) {
				var value_hash = this._valuehash(value);
				var vhash_val = this._vhash[value_hash];
				if (vhash_val) {
					var len = vhash_val.length;
					for (i = 0; i < len; i += 1) {
						var info = vhash_val[i];
						if (eq_check(info.value.get(), value)) {
							return info.key.get();
						}
					}
				}
				return undefined;
			} else {
				var key;
				this.each(function (v, k) {
					if (eq_check(value, v)) {
						key = k;
						return false;
					}
				});
				return key;
			}
		};
		proto.isEmpty = function () {
			return this.size() === 0;
		};
		proto.set_cached_value = function (key, value) {
			var ki = this._find_key(key, false, false);
			var key_index = ki.i;
			if (key_index >= 0) {
				var info = ki.hv[key_index];
				info.value.set_cached_value(value);
			}
			return this;
		};
		proto.destroy = function () {
			this.wait();
			cjs.wait();
			this.clear();
			this.$keys.destroy();
			this.$values.destroy();
			this.$entries.destroy();
			cjs.signal();
			this.signal();
		};
		proto.toObject = function (key_map_fn) {
			key_map_fn = key_map_fn || identity;
			var rv = {};
			this.each(function (v, k) { rv[key_map_fn(k)] = v; });
			return rv;
		};
	}(MapConstraint));

	cjs.map = function (arg0, arg1) { return new MapConstraint(arg0, arg1); };
	cjs.is_map = function (obj) { return obj instanceof MapConstraint; };
	cjs.MapConstraint = MapConstraint;
