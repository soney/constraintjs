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

var Map = function(equality_check) {
	this._keys = cjs.create("array");
	this._values = cjs.create("array");
	this._equality_check = equality_check;
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
		return this._keys.index_of(key, this._equality_check);
	};
	proto.has_key = function(key) {
		return this._key_index(key) >= 0;
	};
	proto._do_set = function(key, value, index) {
		var key_index = this._key_index(key);

		if(key_index<0) { // Doesn't already exist
			if(_.isNumber(index) && index >= 0 && index < this._keys.length()) {
				this._values.insert_at(value, index);
				this._keys.insert_at(key, index);
			} else {
				this._values.push(value);
				this._keys.push(key);
			}
		} else {
			if(_.isNumber(index) && index >= 0 && index < this._keys.length()) {
				this._values.set_item(key_index, value);
				this.move(key, index);
			} else {
				this._values.set_item(key_index, value);
			}
		}

		return this;
	};
	proto.get = function(key) {
		var key_index = this._key_index(key);
		if(key_index < 0) { return undefined; }
		else {
			return this._values.item(key_index);
		}
	};
	proto.unset = function(key) {
		var key_index = this._key_index(key);
		if(key_index >= 0) {
			this._keys.remove_item(key_index);
			this._values.remove_item(key_index);
		}
		return this;
	};
	proto.forEach = function(func, context) {
		var len = this._keys.length();
		var key, value;
		context = context || this;
		var keys = this._keys.get();
		var values = this._values.get();
		var len = keys.length;
		for(var i = 0; i<len; i++) {
			key = keys[i]; value = values[i];
			
			func.call(context, value, key, i);
		}
		return this;
	};
	proto.map = function(func, context) {
		var rv = [];
		this.forEach(function(value, key, index) {
			var mapped_val = func.apply(this, arguments);
			rv.push(mapped_val);
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
		var len = this._keys.length();
		var key, value;
		context = context || this;
		for(var i = 0; i<len; i++) {
			key = this._keys.item(i); value = this._values.item(i);
			
			var val = func.call(context, value, key, i);
			if(val) { return true; }
		}
		return false;
	};
	proto.move = function(key, index) {
		var keys_got = this._keys.get();
		var values_got = this._values.get();
		var key_index = this._key_index(key);
		if(key_index >= 0) {
			move_index(keys_got,   key_index, index);
			this._keys.invalidate();
			move_index(values_got, key_index, index);
			this._values.invalidate();
		}
		return this;
	};
	proto.rename = function(old_key, new_key) {
		var keys_got = this._keys.get();
		var values_got = this._values.get();
		var old_key_index = this._key_index(old_key);
		if(old_key_index >= 0) {
			var new_key_index = this._key_index(new_key);
			if(new_key_index >= 0) {
				this._keys.remove_index(new_key_index);
				this._values.remove_index(new_key_index);
			}
			this._keys.set_item(old_key_index, new_key)
		}
	};
	proto.key_for_value = function(value) {
		var value_index = this._values.index_of(value, this._equality_check);
		if(value_index >= 0) {
			return this._keys.item(value_index);
		}
		return undefined;
	};
	proto.get_keys = function() {
		return _.clone(this._keys.get());
	};
	proto.get_values = function() {
		return _.clone(this._values.get());
	};
	proto.$get = function(key) {
		var self = this;
		return cjs(function() {
			var key_got = key.get();
			return self.get(key_got);
		});
	};
}(Map));

cjs.define("map", function() {
	return new Map();
});

}(cjs));
