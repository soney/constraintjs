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
			var key = arguments[0], value = arguments[1];
			this._do_set(key, value);
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
	proto._do_set = function(key, value) {
		var key_index = this._key_index(key);

		if(key_index<0) {
			this._keys.push(key);
			this._values.push(value);
		} else {
			this._values[key_index] = value;
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
		var rv = new RedMap();
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
}(Map));

cjs.define("map", function() {
	return new Map();
});

}(cjs));
