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
	this._keys = cjs.create("constraint", []);
	this._values = cjs.create("constraint", []);
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
		return _.indexOf(this._keys.get(), key);
	};
	proto.has_key = function(key) {
		return this._key_index(key) >= 0;
	};
	proto._do_set = function(key, value, index) {
		var key_index = this._key_index(key);
		var keys_got = this._keys.get();
		var values_got = this._values.get();

		if(key_index<0) { // Doesn't already exist
			if(_.isNumber(index) && index >= 0 && index < keys_got.length) {
				_.insert_at(keys_got, key, index);
				this._keys.invalidate();
				_.insert_at(values_got, value, index);
				this._values.invalidate();
			} else {
				keys_got.push(key);
				this._keys.invalidate();
				values_got.push(value);
				this._values.invalidate();
			}
		} else {
			if(_.isNumber(index) && index >= 0 && index < this._keys.length) {
				values_got[key_index] = value;
				this._values.invalidate();
				this.move(key, index);
			} else {
				values_got[key_index] = value;
				this._values.invalidate();
			}
		}

		return this;
	};
	proto.get = function(key) {
		var key_index = this._key_index(key);
		if(key_index < 0) { return undefined; }
		else {
			var values_got = this._values.get();
			return values_got[key_index];
		}
	};
	proto.unset = function(key) {
		var key_index = this._key_index(key);
		var keys_got = this._keys.get();
		var values_got = this._values.get();
		if(key_index >= 0) {
			remove_by_index(keys_got, key_index);
			this._keys.invalidate();
			remove_by_index(values_got, key_index);
			this._values.invalidate();
		}
		return this;
	};
	proto.forEach = function(func, context) {
		var keys_got = this._keys.get();
		var values_got = this._values.get();
		var len = keys_got.length;
		var key, value;
		context = context || this;
		for(var i = 0; i<len; i++) {
			key = keys_got[i]; value = values_got[i];
			
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
		var keys_got = this._keys.get();
		var values_got = this._values.get();
		var len = keys_got.length;
		var key, value;
		context = context || this;
		for(var i = 0; i<len; i++) {
			key = keys_got[i]; value = values_got[i];
			
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
				remove_by_index(keys_got, new_key_index);
				this._keys.invalidate();
				remove_by_index(values_got, new_key_index);
				this._values.invalidate();
			}
			keys_got[old_key_index] = new_key;
			this._keys.invalidate();
		}
	};
	proto.key_for_value = function(value) {
		var values_got = this._values.get();
		var value_index = _.indexOf(values_got, value);
		if(value_index >= 0) {
			var keys_got = this._keys.get();
			return keys_got[value_index];
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
