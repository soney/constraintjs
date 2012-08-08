(function(cjs) {
var _ = cjs._;

var remove_by_index = function(arrayName,arrayIndex) { 
	arrayName.splice(arrayIndex,1); 
};
var move_index = function (arr, old_index, new_index) {
    if (new_index >= arr.length) {
        var k = new_index - arr.length;
        while ((k--) + 1) {
            arr.push(undefined);
        }
    }
    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
};

var Map = function() {
	this._keys = [];
	this._values = [];
	if(arguments.length > 0) {
		this.set.apply(this, arguments);
	}
};

(function(my) {
	var proto = my.prototype;
	proto.set = function() {
		if(arguments.length >= 2) {
			var key = arguments[0], value = arguments[1], index = arguments[2];
			this._do_set(key, value, index);
		} else {
			_.forEach(arguments[0], _.bind(function(value, key) {
				this._do_set(key, value);
			}, this));
		}

		return this;
	};
	proto._key_index = function(key) {
		return _.indexOf(this._keys, key);
	};
	proto.has_key = function(key) {
		return this._key_index(key) >= 0;
	};
	proto._do_set = function(key, value, index) {
		var key_index = this._key_index(key);

		if(key_index<0) { // Doesn't already exist
			if(_.isNumber(index) && index >= 0 && index < this._keys.length) {
				_.insert_at(this._keys, key, index);
				_.insert_at(this._values, value, index);
			} else {
				this._keys.push(key);
				this._values.push(value);
			}
		} else {
			if(_.isNumber(index) && index >= 0 && index < this._keys.length) {
				this._values[key_index] = value;
				this.move(key, index);
			} else {
				this._values[key_index] = value;
			}
		}

		return this;
	};
	proto.get = function(key) {
		var key_index = this._key_index(key);
		if(key_index < 0) { return undefined; }
		else { return this._values[key_index]; }
	};
	proto.unset = function(key) {
		var key_index = this._key_index(key);
		if(key_index >= 0) {
			remove_by_index(this._keys, key_index);
			remove_by_index(this._values, key_index);
		}
		return this;
	};
	proto.forEach = function(func, context) {
		var len = this._keys.length;
		var key, value;
		context = context || this;
		for(var i = 0; i<len; i++) {
			key = this._keys[i]; value = this._values[i];
			
			func.call(context, value, key, i);
		}
		return this;
	};
	proto.map = function(func, context) {
		var rv = new Map();
		this.forEach(function(value, key, index) {
			var mapped_val = func.apply(this, arguments);
			rv.set(key, mapped_val);
		}, context);
		return rv;
	};
	proto.to_obj = function() {
		var rv = {};
		this.forEach(function(value, key) {
			rv[key] = value;
		});
		return rv;
	};
	proto.any = function(func, context) {
		var len = this._keys.length;
		var key, value;
		context = context || this;
		for(var i = 0; i<len; i++) {
			key = this._keys[i]; value = this._values[i];
			
			var val = func.call(context, value, key, i);
			if(val) { return true; }
		}
		return false;
	};
	proto.move = function(key, index) {
		var key_index = this._key_index(key);
		if(key_index >= 0) {
			move_index(this._keys,   key_index, index);
			move_index(this._values, key_index, index);
		}
		return this;
	};
	proto.rename = function(old_key, new_key) {
		var old_key_index = this._key_index(old_key);
		if(old_key_index >= 0) {
			var new_key_index = this._key_index(new_key);
			if(new_key_index >= 0) {
				remove_by_index(this._keys, new_key_index);
				remove_by_index(this._values, new_key_index);
			}
			this._keys[old_key_index] = new_key;
		}
	};
	proto.key_for_value = function(value) {
		var value_index = _.indexOf(this._values, value);
		if(value_index >= 0) {
			return this._keys[value_index];
		}
		return undefined;
	};
	proto.get_keys = function() {
		return _.clone(this._keys);
	};
	proto.get_values = function() {
		return _.clone(this._values);
	};
}(Map));

cjs.define("map", function() {
	return new Map();
});

}(cjs));
