(function(cjs) {
var _ = cjs._;
var remove_by_index = function(arrayName,arrayIndex) { 
	arrayName.splice(arrayIndex,1); 
}
var move_index = function (arr, old_index, new_index) {
    if (new_index >= arr.length) {
        var k = new_index - arr.length;
        while ((k--) + 1) {
            arr.push(undefined);
        }
    }
    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
};

var default_equality_check = function(itema, itemb) {
	return itema === itemb;
};

cjs.define("array", function(value) {
	if(!_.isArray(value)) {
		value = [];
	}
	var defer_invalidation = false;
	var _value = cjs.create("constraint", value);
	_value.push = function() {
		var rv = value.push.apply(value, arguments);
		if(defer_invalidation !== true) {_value.invalidate();}
		return rv;
	};
	_value.set_item = function(index, item) {
		value[index] = item;
		if(defer_invalidation !== true) {_value.invalidate();}
	};
	_value.insert_at = function(item, index) {
		_.insert_at(value, item, index);
		if(defer_invalidation !== true) {_value.invalidate();}
	};
	_value.item = function(index) {
		var value = _value.get();
		return value[index];
	};
	_value.index_of = function(item, equality_check) {
		var value = _value.get();
		if(!_.isFunction(equality_check)) {
			equality_check = default_equality_check;
		}
		for(var i = 0; i<value.length; i++) {
			if(equality_check(value[i], item)) {
				return i;
			}
		}
		return -1;
	};
	_value.length = function() {
		var value = _value.get();
		return value.length;
	};
	_value.unset_item = function(index) {
		delete value[index];
		if(defer_invalidation !== true) {_value.invalidate();}
	};
	_value.remove_item = function(index) {
		remove_by_index(value, index);
		if(defer_invalidation !== true) {_value.invalidate();}
	};
	_value.move_item = function(from_index, to_index) {
		move_index(value, from_index, to_index);
		if(defer_invalidation !== true) {_value.invalidate();}
		return this;
	};
	_value.move = function(key, to_index) {
		var from_index = _.indexOf(value, item);
		_value.move_item(from_index, to_index);
		return this;
	};
	_value.filter = function(filter_func) {
		var value = _value.get();
		return _.filter(value, filter_func);
	};
	_value.reject = function(filter_func) {
		var value = _value.get();
		return _.reject(value, filter_func);
	};
	_value.without = function() {
		var value = _value.get();
		var args = [value];
		args.push.apply(args, _.toArray(arguments));
		return _.without.apply(_, args);
	};

	_value.defer_invalidation = function(to_defer) {
		defer_invalidation = to_defer;
	};

	_value.set = function(arr) {
		var splice_args = ([0, value.length]).concat(arr);
		value.splice.apply(value, splice_args);
		if(defer_invalidation !== true) {_value.invalidate();}
	}

	
	return _value;
});

}(cjs));
