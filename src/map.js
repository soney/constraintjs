	//
	// ============== MAPS ============== 
	//

	// Maps use hashing to improve performance. By default, the hash is a simple toString
	// function
	var defaulthash = function (key) { return key.toString(); };

	// A string can also be specified as the hash, so that the hash is the result of calling
	// that property of the object
	var get_str_hash_fn = function (prop_name) {
		return function (key) {
			return key[prop_name]();
		};
	};

	// Map constraints are supposed to behave like normal objects ({}) with a few enhancements
	MapConstraint = function (options) {
		options = extend({
			hash: defaulthash, // Improves performance when searching by key
			valuehash: false, // Function if we should hash values, which improves performance when searching by value. By default, we don't hash values
			equals: eqeqeq, // Equality check when searching by key
			valueequals: eqeqeq, // Equality check when searching by value
			value: {}, // Optional starting value
			keys: [], // Rather than passing in 'value', keys and values can be equal-length arrays specifying keys...
			values: [], // and values
			literal_values: true, // true if every value should be literal
			create_unsubstantiated: true // Create a value when a key isn't found
		}, options);

		// Append all of the keys and values passed to the keys and values arrays
		each(options.value, function (v, k) {
			options.keys.push(k);
			options.values.push(v);
		}, this);

		// Convert to boolean
		this._default_literal_values = !!options.literal_values;
		this.$equality_check = new Constraint(options.equals, {literal: true});
		this.$vequality_check = new Constraint(options.valueequals, {literal: true});

		// Get my hash
		this._hash = isString(options.hash) ? get_str_hash_fn(options.hash) : options.hash;
		this._create_unsubstantiated = options.create_unsubstantiated;

		this._khash = {};

		// If we're hashing values, then set this._valuehash as a function
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

		var is_literal = this._default_literal_values;

		// Keeps track of the values and maintains the proper order
		this._ordered_values = map(options.keys, function (k, i) {
			var v = options.values[i];
			// Have key (k) and value (v)
			var info = {
				key: new Constraint(k, {literal: true}),
				value: new Constraint(v, {literal: is_literal}),
				index: new Constraint(i, {literal: true})
			};

			// Properly put the entry into the key hash
			var hash = this._hash(k);
			var hash_val = this._khash[hash];
			if (hash_val) {
				hash_val.push(info);
			} else {
				this._khash[hash] = [info];
			}

			// If we hash values too, properly put the entry into the value hash
			if (this._vhash) {
				var value_hash = this._valuehash(v);
				var vhash_val = this._vhash[value_hash];
				if (vhash_val) {
					vhash_val.push(info);
				} else {
					this._vhash[value_hash] = [info];
				}
			}
			// And finally, set return info for this._ordered_values[i]
			return info;
		}, this);

		// Keeps track of requested values that aren't set
		this._unsubstantiated_values = {};

		// Array to store keys
		this.$keys = new Constraint(this._do_get_keys, {context: this});
		// Array to store values
		this.$values = new Constraint(this._do_get_values, {context: this});
		// Full entries (includes keys and values)
		this.$entries = new Constraint(this._do_get_entries, {context: this});
		// Number of keys
		this.$size = new Constraint(this._do_get_size, {context: this});
	};

	(function (my) {
		my.BREAK = ArrayConstraint.BREAK;
		var proto = my.prototype;

		// Utility function to return information about a key
		var _find_key = function (key, fetch_unsubstantiated, create_unsubstantiated) {
			// Get the hash
			var hash = this._hash(key),
				rv = {
					h: hash, // the actual hash value
					hv: false, // the hash array at the hash value
					i: -1, // the index of the key in the hash array
					ui: -1, // the index in the unsubstantiated array
					uhv: false // the unsubstantiated hash array
				},
				eq = this.$equality_check.get(),
				index_where_fn = function (a, b) {
					return eq(a.key.get(), key);
				},
				hash_values = this._khash[hash];

			if (hash_values) { // We found a potential hash array
				var key_index = index_where(hash_values, index_where_fn);
				if(key_index >= 0) { // Wohoo! we also found the key in there
					rv.hv = hash_values;
					rv.i = key_index;
					return rv;
				}
			}

			// Haven't returned yet, so we didn't find the entry. Look for an unsubstantiated
			// value instead.
			if (fetch_unsubstantiated !== false) { //Not found
				var unsubstantiated_values = this._unsubstantiated_values[hash];
				var unsubstantiated_index = -1;
				if (unsubstantiated_values) {
					rv.uhv = unsubstantiated_values;
					unsubstantiated_index = index_where(unsubstantiated_values, index_where_fn);
					if(unsubstantiated_index >= 0) {
						rv.ui = unsubstantiated_index;
						return rv;
					}
				}

				// We haven't returned yet, so we didn't find an unsubstantiated value either
				// Check to see if we should create one.
				if(create_unsubstantiated === true) {
					var is_literal = this._default_literal_values;
					var unsubstantiated_info = {
						key: new Constraint(key, {literal: true}),
						value: new Constraint(undefined, {literal: is_literal}), // will be undefined
						index: new Constraint(-1, {literal: true}) // with a negative index
					};

					if(unsubstantiated_values) { // The hash was found but not the particular value
						// Add it onto the end
						unsubstantiated_index = unsubstantiated_values.length;
						unsubstantiated_values[unsubstantiated_index] = unsubstantiated_info;
					} else {
						// The hash wasn't found; create a new array
						unsubstantiated_index = 0;
						this._unsubstantiated_values[hash] = unsubstantiated_values = [unsubstantiated_info];
					}
				}
				rv.uhv = unsubstantiated_values || false; // Want to return false if not found
				rv.ui = unsubstantiated_index;
			}
			return rv;
		};

		// Responsible for setting a key properly
		var _do_set_item_ki = function (ki, key, value, index, literal) {
			// ki is the key information from _find_key
			var i, value_hash, vhash_val, info,
				key_index = ki.i, // where the key is in the hash array
				hash_values = ki.hv, // the hash array
				hash = ki.h; // the hash value

			if (key_index >= 0) { // The key was already in this map
				// get the information
				info = hash_values[key_index];

				if (this._vhash) { // If we're hashing values, the new value has to get re-hashed
					var old_value = info.value.get(),
						old_value_hash = this._valuehash(old_value),
						old_vhash_val = this._vhash[old_value_hash];
					value_hash = this._valuehash(value);

					if (old_vhash_val) { // This should probably always be true, unless something went wrong...
						var len = old_vhash_val.length;
						for (i = 0; i < len; i += 1) {
							if (old_vhash_val[i] === info) { // wohoo, found it
								old_vhash_val.splice(i, 1);
								if (old_vhash_val.length === 0) {
									delete this._vhash[old_value_hash]; // don't keep the old hash array
								}
								break;
							}
						}
					}

					// Put the new value has in
					vhash_val = this._vhash[value_hash]; // hash array
					if (vhash_val) {
						vhash_val.push(info); // add onto the hash array
					} else {
						this._vhash[value_hash] = [info]; // create a new hash array
					}
				}

				info.value.set(value); // set the value constraint to the new value

				if (isPositiveInteger(index)) { // But they also specified an index...
					var old_index = info.index.get();
					if(old_index !== index) { // great...now we have to move it too
						// take out the old value
						this._ordered_values.splice(old_index, 1);
						// and re-add it
						this._ordered_values.splice(index, 0, info);

						// Properly iterate regardless of whether moving higher or lower
						var low = Math.min(old_index, index);
						var high = Math.max(old_index, index);
						// update the indicies of every thing between that might have been affected
						for (i = low; i <= high; i += 1) {
							_set_index(this._ordered_values[i], i);
						}
						this.$keys.invalidate(); // Keys are now invalid
					}
				}
			} else {
				// They didn't specify an index or at least they specified it wrong...
				if (!isPositiveInteger(index)) {
					index = this._ordered_values.length; // just set it to the 
				}
				// Check to see if there was an unsubstantiated item
				var unsubstantiated_index = ki.ui;

				if (unsubstantiated_index >= 0) { // Found it! Now let's remove it from the list of unsubstantiated items
					var unsubstantiated_hash_values = ki.uhv,
						unsubstantiated_info = unsubstantiated_hash_values[unsubstantiated_index];

					unsubstantiated_hash_values.splice(unsubstantiated_index, 1);
					if (unsubstantiated_hash_values.length === 0) {
						delete this._unsubstantiated_values[hash];
					}

					info = unsubstantiated_info; // re-use the same object to keep dependencies

					info.value.set(value); // but update its value and index
					info.index.set(index);
				} else {
					// Nothing in unsubstantiated; just create it from scratch
					info = {
						key: new Constraint(key, {literal: true}),
						value: new Constraint(value, {literal: literal === undefined ? this._default_literal_values : !!literal}),
						index: new Constraint(index, {literal: true})
					};
				}

				if(hash_values) { // There was already a hash array
					hash_values.push(info);
				} else { // Have to create the hash array
					hash_values = this._khash[hash] = [info];
				}

				//If we're hashing values...
				if (this._vhash) {
					value_hash = this._valuehash(value);
					vhash_val = this._vhash[value_hash];
					// Add the item to the value hash
					if (vhash_val) {
						vhash_val.push(info);
					} else {
						this._vhash[value_hash] = [info];
					}
				}

				//  insert into values
				this._ordered_values.splice(index, 0, info);

				// Push the index of every item that I spliced before up
				for (i = index + 1; i < this._ordered_values.length; i += 1) {
					_set_index(this._ordered_values[i], i);
				}
				// Now, size and keys are invalid
				this.$size.invalidate();
				this.$keys.invalidate();
			}
			this.$values.invalidate();
			this.$entries.invalidate();
		};

		// Cange an info's specified index
		var _set_index = function (info, to_index) {
			info.index.set(to_index);
		};

		// Deallocate memory from constraints
		var _destroy_info = function (infos, silent) {
			each(infos, function (info) {
				info.key.destroy(silent);
				info.value.destroy(silent);
				info.index.destroy(silent);
			});
		};

		// removes the selected item and destroys its value to deallocate it
		var _remove_index = function (index, silent) {
			var info = this._ordered_values[index];
			_destroy_info(this._ordered_values.splice(index, 1), silent);
			if(silent !== true) {
				this.$size.invalidate();
			}
		};
		
		// Getter for this.$keys constraint
		proto._do_get_keys = function () {
			var rv = [];
			this.forEach(function (value, key, index) {
				rv[index] = key;
			});
			return rv;
		};
		// used when keys() is called
		proto.keys = function () { return this.$keys.get(); };

		// Getter for this.$values constraint
		proto._do_get_values = function () {
			var rv = [];
			this.forEach(function (value, key, index) {
				rv[index] = value;
			});
			return rv;
		};
		//used when values() is called
		proto.values = function () { return this.$values.get(); };

		// Getter for this.$entries constraint
		proto._do_get_entries = function () {
			var rv = [];
			this.forEach(function (value, key, index) {
				rv[index] = {key: key, value: value};
			});
			return rv;
		};
		//used when entries() is called
		proto.entries = function () { return this.$entries.get(); };

		// Getter for this.$size constraint
		proto._do_get_size = function () {
			return this._ordered_values.length;
		};
		// used when size() is called
		proto.size = function () {
			return this.$size.get();
		};
		
		// Simple check if I have items
		proto.isEmpty = function () {
			return this.size() === 0;
		};

		// set the item at key (like this[key] = value)
		proto.set = proto.put = function (key, value, index, literal) {
			cjs.wait();
			// Find out if there's a key or unsubstantiated info but don't create it
			var ki = _find_key.call(this, key, true, false);
			// And do the work of putting
			_do_set_item_ki.call(this, ki, key, value, index, literal);
			cjs.signal();
			return this;
		};

		// Unset the item at key (like delete this[key])
		proto.remove = function (key) {
			// Find out if there's an actual key set
			var ki = _find_key.call(this, key, false, false);
			var key_index = ki.i,
				hash_values = ki.hv;
			var i;

			// If the item was found
			if (key_index >= 0) {
				cjs.wait();

				var info = hash_values[key_index]; // The info about the value
				var ordered_index = info.index.get(); // The map's index (not the index in the hash array)

				hash_values.splice(key_index, 1); // Remove info from the hash array
				if (hash_values.length === 0) { // If there isn't anything in the hash array,
					delete this._khash[ki.h]; // remove it
				}

				// If the value is also hashed..
				if (this._vhash) {
					// Find the value hash information
					var value_hash = this._valuehash(info.value.get()); // the lookup key for the value hash
					var vhash_val = this._vhash[value_hash]; // the value hash array
					if (vhash_val) { // Found the value hash
						var len = vhash_val.length;
						for (i = 0; i < len; i += 1) {
							if (vhash_val[i] === info) { // found the actual item
								vhash_val.splice(i, 1); // remove it from the array
								if (vhash_val.length === 0) {
									delete this._vhash[value_hash]; // and if it's empty, remove the whole value hash array
								}
								break; // Wohoo!
							}
						}
					}
				}

				_remove_index.call(this, ordered_index); // remove ordered_index (splices the ordered array)
				for (i = ordered_index; i < this._ordered_values.length; i += 1) {
					_set_index(this._ordered_values[i], i); // and update the index for every item
				}
				console.log(this.item());

				// And now all of these constraint variables are invalid.
				this.$size.invalidate();
				this.$keys.invalidate();
				this.$values.invalidate();
				this.$entries.invalidate();

				// OK, now you can run any nullified listeners
				cjs.signal();
			}
			return this;
		};
		
		// Get the item at key (like this[key])
		proto.get = function (key) {
			// Try to find the key and search in any unsubstantiated values
			var ki = _find_key.call(this, key, true, this._create_unsubstantiated),
				key_index = ki.i,
				hash_values = ki.hv;

			if (key_index >= 0) { // Found it; get the item in the hash's value
				var info = hash_values[key_index];
				return info.value.get();
			} else if(this._create_unsubstantiated) {
				var unsubstantiated_info = ki.uhv[ki.ui]; // use the unsubstantiated getter to create a dependency
				return unsubstantiated_info.value.get();
			} else { // not found and can't create unsubstantiated item
				return undefined;
			}
		};

		// Empty out every entry
		proto.clear = function (silent) {
			if (this.size() > 0) { // If I actually have something
				cjs.wait();
				// Keep removing items
				while (this._ordered_values.length > 0) {
					_remove_index.call(this, 0, silent);
				}
				// And get rid of every key hash
				each(this._khash, function (arr, hash) {
					delete this._khash[hash];
				}, this);
				// and value hash if applicable
				if (this._vhash) {
					each(this._vhash, function (arr, hash) {
						delete this._vhash[hash];
					}, this);
				}

				// and everything should be invalid
				this.$keys.invalidate();
				this.$values.invalidate();
				this.$entries.invalidate();
				this.$size.invalidate();

				cjs.signal(); // ready to run nullification listeners
			}
			return this;
		};
		// Loop through every value and key calling func on it with this === context (or this)
		proto.forEach = function (func, context) {
			var i, info, len = this.size(),
				ov_clone = this._ordered_values.slice();
			context = context || this;
			for (i = 0; i < len; i += 1) {
				info = ov_clone[i];
				if (info && func.call(context, info.value.get(), info.key.get(), info.index.get()) === my.BREAK) { // break if desired
					break;
				}
			}
			return this;
		};
		// Change rules for key lookup
		proto.set_equality_check = function (equality_check) {
			this.$equality_check.set(equality_check);
			return this;
		};
		// Change rules for value lookup
		proto.set_value_equality_check = function (vequality_check) {
			this.$vequality_check.set(vequality_check);
			return this;
		};
		// Change how hashing is done
		proto.set_hash = function (hash) {
			cjs.wait();
			// First, empty out the old key hash and unsubstantiated values
			this._hash = isString(hash) ? get_str_hash_fn(hash) : hash;
			this._khash = {};
			// Then, for every one of my values, re-hash
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

			// And re-hash for every unsubstantiated value
			var new_unsubstantiated_values = {};
			each(this._unsubstantiated_values, function(unsubstantiated_value_arr) {
				each(unsubstantiated_value_arr, function(info) {
					var key = info.key.get();
					var hash = this._hash(key);
					var hash_val = this.new_unsubstatiated_values[hash];
					if(hash_val) {
						hash_val.push(info);
					} else {
						new_unsubstantiated_values[hash] = [info];
					}
				}, this);
			}, this);
			this._unsubstantiated_values = new_unsubstantiated_values;

			cjs.signal();
			return this;
		};

		// Change how value hashing is done
		proto.set_value_hash = function (vhash) {
			this._valuehash = isString(vhash) ? get_str_hash_fn(vhash) : vhash;
			// Empty out the old value hash
			this._vhash = {};

			if (this._valuehash) {
				// And reset the value hash for every element
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
			if(arguments.length === 0) { // no arguments? return an object
				return this.toObject();
			} else if (arguments.length === 1) { // One, try to get the keys values
				return this.get(arg0);
			} else { // more than two, try to set
				return this.put(arg0, arg1, arg2);
			}
		};
		// Find the item in myself (uses hashing)
		proto.indexOf = function (key) {
			// get hash information
			var ki = _find_key.call(this, key, true, this._create_unsubstantiated),
				key_index = ki.i,
				hash_values = ki.hv;
			if (key_index >= 0) { // Found! return the proper item's index
				var info = hash_values[key_index];
				return info.index.get();
			} else if(ki.ui >= 0) { // Not found but creating unsubstantiated items
				var unsubstantiated_info = ki.uhv[ki.ui];
				return unsubstantiated_info.index.get(); // create a dependency
			} else { // Not found and not creating unsubstantiated items
				return -1;
			}
		};

		// This function will search for a key and create it if not found
		proto.get_or_put = function (key, create_fn, create_fn_context, index, literal) {
			var ki = _find_key.call(this, key, true, false);
			var key_index = ki.i, // index within hash array
				hash_values = ki.hv, // hash array
				hash = ki.h; // hash value
			if (key_index >= 0) { // found actual item!
				var info = hash_values[key_index];
				return info.value.get();
			} else { // need to create it
				cjs.wait();
				var context = create_fn_context || this;
				var value = create_fn.call(context, key); // will set the value to this
				_do_set_item_ki.call(this, ki, key, value, index, literal); // do the work of putting
				cjs.signal();
				return value;
			}
		};

		// Check if we have a given key
		proto.has = proto.containsKey = function (key) {
			var ki = _find_key.call(this, key, true, this._create_unsubstantiated);
			var key_index = ki.i;
			if (key_index >= 0) { // Found successfully
				return true;
			} else if(this._create_unsubstantiated) { // Didn't find but there is an unusbstantiated item
				var unsubstantiated_info = ki.uhv[ki.ui];
				unsubstantiated_info.index.get(); // Add a dependency
				return false;
			} else { // No dependency to be added; just saya we didn't find it
				return false;
			}
		};

		//Move an item from one index to another given the item's index
		proto.move_index = function (old_index, new_index) {
			var i;
			cjs.wait();
			var info = this._ordered_values[old_index];
			// take out the old value
			this._ordered_values.splice(old_index, 1);
			// and re-add it
			this._ordered_values.splice(new_index, 0, info);

			// Properly iterate regardless of whether moving higher or lower
			var low = Math.min(old_index, new_index);
			var high = Math.max(old_index, new_index);
			// update the indicies of every thing between that might have been affected
			for (i = low; i <= high; i += 1) {
				_set_index(this._ordered_values[i], i);
			}

			// Invalidate the relevant properties (size shouldn't change)
			this.$keys.invalidate();
			this.$values.invalidate();
			this.$entries.invalidate();

			cjs.signal();
			return this;
		};
		// Move an item from one index to another given the item's key
		proto.move = function (key, to_index) {
			//Move a key to a new index
			var ki = _find_key.call(this, key, false, false);
			var key_index = ki.i;
			if (key_index >= 0) {
				var info = ki.hv[key_index];
				// leverage the previous move_index function
				this.move_index(info.index.get(), to_index);
			}
			return this;
		};

		// Given a value, find the corresponding key
		proto.keyForValue = function (value, eq_check) {
			eq_check = eq_check || this.$vequality_check.get();
			var i;
			// It's advantageous here to use a value hash if it's there
			if (this._vhash) {
				var value_hash = this._valuehash(value);
				var vhash_val = this._vhash[value_hash];
				// Find that value hash's array
				if (vhash_val) {
					var len = vhash_val.length;
					for (i = 0; i < len; i += 1) {
						var info = vhash_val[i];
						if (eq_check(info.value.get(), value)) { // found it! here's the key
							return info.key.get();
						}
					}
				}
				// Didn't find it
				return undefined;
			} else {
				// Without a value hash, we have to iterate through every item
				var key;
				this.forEach(function (v, k) {
					if (eq_check(value, v)) { // found
						key = k;
						return my.BREAK; // Break out of the forEach
					}
				});
				return key;
			}
		};
		// Useful for deallocating memory
		proto.destroy = function (silent) {
			cjs.wait();
			this.clear(silent);
			this.$equality_check.destroy(silent);
			this.$vequality_check.destroy(silent);
			this.$keys.destroy(silent);
			this.$values.destroy(silent);
			this.$entries.destroy(silent);
			this.$size.destroy(silent);
			cjs.signal();
		};
		// optional filter to apply to every key
		proto.toObject = function (key_map_fn) {
			var rv = {};
			key_map_fn = key_map_fn || identity; // just use the key if not supplied
			this.forEach(function (v, k) { rv[key_map_fn(k)] = v; });
			return rv;
		};
	}(MapConstraint));

	is_map = function(obj) {
		return obj instanceof MapConstraint;
	};

	cjs.map = function (arg0, arg1) { return new MapConstraint(arg0, arg1); };
	cjs.is_map = is_map;
	cjs.Map = MapConstraint;
