// Map Constraints
// ---------------

// Maps use hashing to improve performance. By default, the hash is a simple toString
// function
var defaulthash = function (key) { return key+""; };

// A string can also be specified as the hash, so that the hash is the result of calling
// that property of the object
var get_str_hash_fn = function (prop_name) {
	return function (key) {
		return key[prop_name]();
	};
};

/**
 * ***Note:*** the preferred way to create a map constraint is with `cjs.map`
 * This class is meant to emulate JavaScript objects ({}) but with constraints
 *
 * Options:
 *
 * - `hash`: a key hash to use to improve performance when searching for a key (default: `x.toString()`)
 * - `valuehash`: a value hash to use improve performance when searching for a value (default: `false`)
 * - `equals`: How to check for equality when searching for a key (default: `===`)
 * - `valueequals`: How to check for equality when searching for a value (default: `===`)
 * - `value`: An optional starting value (default: `{}`)
 * - `keys`: An optional starting set of keys (default: `[]`)
 * - `values`: An optional starting set of values (default: `[]`)
 * - `literal_values`: True if values that are functions should return a function rather than that function's return value. (default: `false`)
 * - `create_unsubstantiated`: Create a constraint when searching for non-existent keys. (default: `true`)
 *
 * @class cjs.MapConstraint
 * @classdesc A class that adds constraint to objects
 * @param {Object} [options] - A set of options to control how the map constraint is evaluated
 */
MapConstraint = function (options) {
	options = extend({
		hash: defaulthash, // Improves performance when searching by key
		valuehash: false, // Function if we should hash values, which improves performance when searching by value. By default, we don't hash values
		equals: eqeqeq, // Equality check when searching by key
		valueequals: eqeqeq, // Equality check when searching by value
		value: {}, // Optional starting value
		keys: [], // Rather than passing in 'value', keys and values can be equal-length arrays specifying keys...
		values: [], // and values
		literal_values: false, // true if every value should be literal
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
	this.$keys = new Constraint(function () {
			var rv = [];
			this.forEach(function (value, key, index) {
				rv[index] = key;
			});
			return rv;
		}, {context: this});

	// Array to store values
	this.$values = new Constraint(function() {
		var rv = [];
		this.forEach(function (value, key, index) {
			rv[index] = value;
		});
		return rv;
	}, {context: this});

	// Full entries (includes keys and values)
	this.$entries = new Constraint(function() {
		var rv = [];
		this.forEach(function (value, key, index) {
			rv[index] = {key: key, value: value};
		});
		return rv;
	}, {context: this});

	// Number of keys
	this.$size = new Constraint(function() {
		return this._ordered_values.length;
	}, {context: this});
};

(function (my) {
	/**
	 * Any iterator in forEach can return this object to break out of its loop.
	 * @property {object} cjs.MapConstraint.BREAK
	 */
	my.BREAK = ArrayConstraint.BREAK;

	var proto = my.prototype;
	/** @lends cjs.MapConstraint.prototype */

	// Utility function to return information about a key
	var _find_key = function (key, fetch_unsubstantiated, create_unsubstantiated, literal) {
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
			var key_index = indexWhere(hash_values, index_where_fn);
			rv.hv = hash_values;
			if(key_index >= 0) { // Wohoo! we also found the key in there
				rv.i = key_index;
				return rv;
			}
		}

		// Haven't returned yet, so we didn't find the entry. Look for an unsubstantiated
		// value instead.
		if (fetch_unsubstantiated !== false) { //Not found
			var unsubstantiated_values = this._unsubstantiated_values[hash],
				unsubstantiated_index = -1;

			if (unsubstantiated_values) {
				rv.uhv = unsubstantiated_values;
				unsubstantiated_index = indexWhere(unsubstantiated_values, index_where_fn);
				if(unsubstantiated_index >= 0) {
					rv.ui = unsubstantiated_index;
					return rv;
				}
			}

			// We haven't returned yet, so we didn't find an unsubstantiated value either
			// Check to see if we should create one.
			if(create_unsubstantiated === true) {
				var is_literal = this._default_literal_values,
					unsubstantiated_info = {
						key: new Constraint(key, {literal: true}),
						value: new Constraint(undefined,  {literal: literal === undefined ? this._default_literal_values : !!literal}), // will be undefined
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
	
	/**
	 * Get the keys on this object.
	 *
	 * @method keys
	 * @return {array.*} - The set of keys
	 * @see values
	 * @see entries
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.keys(); // ['x','y']
	 */
	proto.keys = function () { return this.$keys.get(); };

	/**
	 * Get the values on this object.
	 *
	 * @method values
	 * @return {array.*} - The set of values
	 * @see keys
	 * @see entries
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.values(); // [1,2]
	 */
	proto.values = function () { return this.$values.get(); };

	/**
	 * Get every key and value of this object as an array.
	 *
	 * @method entries
	 * @return {array.object} - A set of objects with properties `key` and `value`
	 * @see keys
	 * @see values
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.entries(); // [{key:'x',value:1},
	 *                    //  {key:'y',value:2}]
	 */
	proto.entries = function () { return this.$entries.get(); };

	/**
	 * Get the number of entries in this object.
	 *
	 * @method size
	 * @return {number} - The number of entries
	 * @see isEmpty
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.size(); // 2
	 */
	proto.size = function () { return this.$size.get(); };
	
	/**
	 * Check if this object has any entries
	 *
	 * @method isEmpty
	 * @return {boolean} - `true` if there are no entries, `false` otherwise
	 * @see size
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.isEmpty(); // false
	 */
	proto.isEmpty = function () { return this.size() === 0; };

	/**
	 * Set the entry for `key` to `value` (`this[key]=value`)
	 *
	 * @method put
	 * @param {*} key - The entry's key
	 * @param {*} value - The entry's value
	 * @param {number} [index=this.size] - The entry's index
	 * @param {boolean} [literal] - Whether to treat the value as literal
	 * @return {cjs.MapConstraint} - `this`
	 * @see get
	 * @see getOrPut
	 * @see item
	 * @see remove
	 * @see clear
	 *
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.put("z", 3, 1);
	 *     map.keys(); // ['x','z','y']
	 */
	proto.put = function (key, value, index, literal) {
		cjs.wait();
		// Find out if there's a key or unsubstantiated info but don't create it
		var ki = _find_key.call(this, key, true, false, literal);
		// And do the work of putting
		_do_set_item_ki.call(this, ki, key, value, index, literal);
		cjs.signal();
		return this;
	};

	/**
	 * Remove a key's entry (like `delete this[key]`)
	 *
	 * @method remove
	 * @param {*} key - The entry's key
	 * @return {cjs.MapConstraint} - `this`
	 *
	 * @see put
	 * @see clear
	 *
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.remove("x");
	 *     map.keys(); // ['y']
	 */
	proto.remove = function (key, silent) {
		// Find out if there's an actual key set
		var ki = _find_key.call(this, key, false, false),
			key_index = ki.i,
			hash_values = ki.hv,
			i, info, ordered_index, value_hash, vhash_val;

		// If the item was found
		if (key_index >= 0) {
			cjs.wait();

			info = hash_values[key_index]; // The info about the value
			ordered_index = info.index.get(); // The map's index (not the index in the hash array)

			hash_values.splice(key_index, 1); // Remove info from the hash array
			if (hash_values.length === 0) { // If there isn't anything in the hash array,
				delete this._khash[ki.h]; // remove it
			}

			// If the value is also hashed..
			if (this._vhash) {
				// Find the value hash information
				value_hash = this._valuehash(info.value.get()); // the lookup key for the value hash
				vhash_val = this._vhash[value_hash]; // the value hash array
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

			_remove_index.call(this, ordered_index, silent); // remove ordered_index (splices the ordered array)
			for (i = ordered_index; i < this._ordered_values.length; i += 1) {
				_set_index(this._ordered_values[i], i); // and update the index for every item
			}

			// And now all of these constraint variables are invalid.
			if(!silent) {
				this.$size.invalidate();
				this.$keys.invalidate();
				this.$values.invalidate();
				this.$entries.invalidate();
			}

			// OK, now you can run any nullified listeners
			cjs.signal();
		}
		return this;
	};
	
	/**
	 * Get the item at key (like this[key])
	 *
	 * @method get
	 * @param {*} key - The entry's key
	 * @return {*|undefined} - the value at that entry or `undefined`
	 *
	 * @see item
	 * @see put
	 * @see getOrPut
	 *
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.get("x"); // 1
	 */
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

	/**
	 * Convert my value to a standard JavaScript object. The keys are converted using `toString`
	 *
	 * @method item
	 * @return {object} - A standard JavaScript object
	 * @see toObject
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.item(); // {x:1,y:2}
	 */
	/**
	 * Get item `key`
	 *
	 * @method item^2
	 * @param {number} key - The object key
	 * @return {*} - The value at index `key`
	 *
	 * @see get
	 * @see put
	 * @see getOrPut
	 * 
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.item('x'); // 1
	 */     
	/**
	 * Set item i
	 *
	 * @method item^3
	 * @param {number} key - The object key
	 * @param {*} value - The new value
	 * @return {cjs.MapConstraint} - `this`
	 *
	 * @see get
	 * @see put
	 * @see getOrPut
	 *
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.item('z', 3);
	 *     map.keys(); //['x','y','z']
	 */
	proto.item = function (arg0, arg1, arg2) {
		if(arguments.length === 0) { // no arguments? return an object
			return this.toObject();
		} else if (arguments.length === 1) { // One, try to get the keys values
			return this.get(arg0);
		} else { // more than two, try to set
			return this.put(arg0, arg1, arg2);
		}
	};

	/**
	 * Return a constraint whose value is bound to my value for key
	 *
	 * @method itemConstraint
	 * @param {*|Constraint} key - The array index
	 * @return {Constraint} - A constraint whose value is `this[key]`
	 *
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     var x_val = map.itemConstraint('x');
	 *     x_val.get(); // 1
	 *     map.item('x', 3);
	 *     x_val.get(); // 3
	 */
	proto.itemConstraint = function(key) {
		return new Constraint(function() {
			// Call cjs.get on the key so the key can also be a constraint
			return this.get(cjs.get(key));
		}, {
			context: this
		});
	};

	/**
	 * Clear every entry of this object.
	 *
	 * @method clear
	 * @return {cjs.MapConstraint} - `this`
	 * @see remove
	 * @see isEmpty
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.isEmpty(); // false
	 *     map.clear();
	 *     map.isEmpty(); // true
	 */
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
			if(!silent) {
				this.$keys.invalidate();
				this.$values.invalidate();
				this.$entries.invalidate();
				this.$size.invalidate();
			}

			cjs.signal(); // ready to run nullification listeners
		}
		return this;
	};

	/**
	 * The forEach() method executes a provided function once per entry.
	 * If cjs.MapConstraint.BREAK is returned for any element, we stop looping
	 * 
	 * @method forEach
	 * @param {function} callback - Function to execute for each entry.
	 * @param {*} thisArg - Object to use as `this` when executing `callback`.
	 * @return {cjs.MapConstraint} - `this`
	 * @example
	 *     var map = cjs({x:1,y:2,z:3});
	 *     map.forEach(function(val, key) {
	 *         console.log(key+':'+val);
	 *         if(key === 'y') {
	 *             return cjs.MapConstraint.BREAK;
	 *         }
	 *     }); // x:1 ... y:2
	 */
	proto.forEach = function (func, thisArg) {
		var i, info, len = this.size(),
			ov_clone = this._ordered_values.slice();
		thisArg = thisArg || this;
		for (i = 0; i < len; i += 1) {
			info = ov_clone[i];
			if (info && func.call(thisArg, info.value.get(), info.key.get(), info.index.get()) === my.BREAK) { // break if desired
				break;
			}
		}
		return this;
	};

	/**
	 * Change the default equality check when getting a key
	 * 
	 * @method setEqualityCheck
	 * @param {function} equality_check - The new key equality check
	 * @return {cjs.ArrayConstraint} - `this`
	 */
	proto.setEqualityCheck = function (equality_check) {
		this.$equality_check.set(equality_check);
		return this;
	};

	/**
	 * Change the default value equality check when getting a value
	 * 
	 * @method setValueEqualityCheck
	 * @param {function} vequality_check - The new value equality check
	 * @return {cjs.ArrayConstraint} - `this`
	 */
	proto.setValueEqualityCheck = function (vequality_check) {
		this.$vequality_check.set(vequality_check);
		return this;
	};

	/**
	 * Change the hash function when getting a key
	 * 
	 * @method setHash
	 * @param {function|string} hash - The new hashing function (or a string representing a property name for every key to use as the hash)
	 * @return {cjs.ArrayConstraint} - `this`
	 */
	proto.setHash = function (hash) {
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

	/**
	 * Change the hash function when getting a value
	 * 
	 * @method setValueHash
	 * @param {function|string} hash - The new hashing function (or a string representing a property name for every key to use as the hash)
	 * @return {cjs.ArrayConstraint} - `this`
	 */
	proto.setValueHash = function (vhash) {
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

	/**
	 * Get the index of the entry with key = `key`
	 * 
	 * @method indexOf
	 * @param {*} key - The key to search for.
	 * @return {number} - The index of the entry with key=`key` or `-1`
	 *
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.indexOf('z'); // -1
	 */
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

	/**
	 * Search for a key or create it if it wasn't found
	 * 
	 * @method getOrPut
	 * @param {*} key - The key to search for.
	 * @param {function} create_fn - A function to create the value if `key` is not found
	 * @param {*} [create_fn_context] - The context in which to call `create_fn`
	 * @param {number} [index=this.size] - Where to place a value that is created
	 * @param {boolean} [literal=false] - Whether to create the value as a literal constraint
	 * (the value of a function is the function)
	 * @return {number} - The index of the entry with key=`key` or `-1`
	 *
	 * @see get
	 * @see put
	 * @see item
	 * @example
	 *     var map = xjs({x: 1, y: 2});
	 *     map.getOrPut('x', function() {
	 *         console.log("evaluating");
	 *         return 3;
	 *     }); // output: 'evaluating'
	 *     // 3
	 *     map.getOrPut('x', function() {
	 *         console.log("evaluating");
	 *         return 3;
	 *     }); // (no output)
	 *     // 3
	 */
	proto.getOrPut = function (key, create_fn, create_fn_context, index, literal) {
		var ki = _find_key.call(this, key, true, false, literal),
			key_index = ki.i, // index within hash array
			hash_values = ki.hv, // hash array
			hash = ki.h, // hash value
			context, value, info;

		if (key_index >= 0) { // found actual item!
			info = hash_values[key_index];
			return info.value.get();
		} else { // need to create it
			cjs.wait();
			context = create_fn_context || this;
			value = create_fn.call(context, key); // will set the value to this
			_do_set_item_ki.call(this, ki, key, value, index, literal); // do the work of putting
			cjs.signal();
			return value;
		}
	};

	/**
	 * Check if there is any entry with key = `key`
	 * 
	 * @method has
	 * @param {*} key - The key to search for.
	 * @return {boolean} - `true` if there is an entry with key=`key`, `false` otherwise.
	 *
	 * @see get
	 * @see item
	 * @example
	 *     var map = cjs({x: 1, y: 2});
	 *     map.has('x'); // true
	 */
	proto.has = function (key) {
		var ki = _find_key.call(this, key, true, this._create_unsubstantiated);
		var key_index = ki.i;
		if (key_index >= 0) { // Found successfully
			return true;
		} else if(this._create_unsubstantiated) { // Didn't find but there is an unsubstantiated item
			var unsubstantiated_info = ki.uhv[ki.ui];
			unsubstantiated_info.index.get(); // Add a dependency
			return false;
		} else { // No dependency to be added; just say we didn't find it
			return false;
		}
	};

	/**
	 * Move the entry at `old_index` to index `new_index`
	 *
	 * @method moveIndex
	 * @param {number} old_index - The index to move from
	 * @param {number} new_index - The index to move to
	 * @return {cjs.ArrayConstraint} - `this`
	 * @example
	 *     var map = cjs({x: 1, y: 2, z: 3});
	 *     map.keys(); // ['x','y', 'z']
	 *     map.moveIndex(1, 0)
	 *     map.keys(); // ['y','x', 'z']
	 */
	proto.moveIndex = function (old_index, new_index) {
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

	/**
	 * Move the entry with key `key` to `index
	 *
	 * @method move
	 * @param {*} key - The key to search for 
	 * @param {number} to_index - The new index for the key
	 * @return {cjs.ArrayConstraint} - `this`
	 * @example
	 *     var map = cjs({x: 1, y: 2, z: 3});
	 *     map.keys(); // ['x','y', 'z']
	 *     map.move('z', 0)
	 *     map.keys(); // ['z','x', 'y']
	 */
	proto.move = function (key, to_index) {
		//Move a key to a new index
		var ki = _find_key.call(this, key, false, false);
		var key_index = ki.i;
		if (key_index >= 0) {
			var info = ki.hv[key_index];
			// leverage the previous move_index function
			this.moveIndex(info.index.get(), to_index);
		}
		return this;
	};

	/**
	 * Given a value, find the corresponding key
	 *
	 * @method keyForValue
	 * @param {*} value - The value whose key to search for 
	 * @param {function} [eq_check] - How to check if two values are equal (default: `===`
	 * @return {*|undefined} - The key where `this.get(key)===value`
	 * @example
	 *     var map = cjs({x: 1, y: 2, z: 3});
	 *     map.keyForValue(1); // 'x'
	 */
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

	/**
	 * Clear this object and try to clean up any memory.
	 *
	 * @method destroy
	 * @param {boolean} [silent=false] - If set to `true`, avoids invalidating any dependent constraints.
	 */
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

	/**
	 * Converts this array to a JavaScript object.
	 *
	 * @method toObject
	 * @param {function} [key_map_fn] - A function to convert keys
	 * @return {object} - This object as a JavaScript object
	 * @example
	 *     var map = cjs({x: 1, y: 2, z: 3});
	 *     map.toObject(); // {x:1,y:2,z:3}
	 */
	proto.toObject = function (key_map_fn) {
		var rv = {};
		key_map_fn = key_map_fn || identity; // just use the key if not supplied
		this.forEach(function (v, k) { rv[key_map_fn(k)] = v; });
		return rv;
	};
}(MapConstraint));
/** @lends */

/**
 * Determine whether an object is a map constraint
 * @method cjs.isMapConstraint
 * @param {*} obj - An object to check
 * @return {boolean} - `true` if `obj` is a `cjs.MapConstraint`, `false` otherwise
 */
is_map = function(obj) {
	return obj instanceof MapConstraint;
};

extend(cjs, {
	/**
	 * Create a map constraint
	 * @method cjs.map
	 * @constructs cjs.MapConstraint
	 * @param {Object} [options] - A set of options to control how the map constraint is evaluated
	 * @return {cjs.MapConstraint} - A new map constraint object
	 * @see cjs.MapConstraint
	 * @example Creating a map constraint
	 *
	 *     var map_obj = cjs.map({
	 *         value: { foo: 1 }
	 *     });
	 *     cobj.get('foo'); // 1
	 *     cobj.put('bar', 2);
	 *     cobj.get('bar') // 2
	 */
	map: function (arg0, arg1) { return new MapConstraint(arg0, arg1); },
	/** @expose cjs.MapConstraint */
	MapConstraint: MapConstraint,
	/** @expose cjs.isMapConstraint */
	isMapConstraint: is_map
});
