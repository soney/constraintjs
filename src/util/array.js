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

cjs.define("array", function(value) {
	if(!_.isArray(value)) {
		value = [];
	}
	var _value = cjs.create("constraint", value);
	_value.push = function() {
		var value = _value.get();
		var rv = value.push.apply(value, arguments);
		_value.invalidate();
		return rv;
	};
	_value.set_item = function(index, item) {
		var value = _value.get();
		value[index] = item;
		_value.invalidate();
	};
	_value.insert_at = function(item, index) {
		var value = _value.get();
		_.insert_at(value, item, index);
		_value.invalidate();
	};
	_value.item = function(index) {
		var value = _value.get();
		return value[index];
	};
	_value.$item = function(index) {
		var self = this;
		return cjs(function() {
			var index_got = cjs.get(index);
			var value_got = self._value.get();
			return value_got[index_got];
		});
	};
	_value.index_of = function(item) {
		var value = _value.get();
		return _.indexOf(value, item);
	};
	_value.length = function() {
		var value = _value.get();
		return value.length;
	};
	_value.unset_item = function(index) {
		var value = _value.get();
		delete value[index];
		_value.invalidate();
	};
	_value.remove_item = function(index) {
		var value = _value.get();
		remove_by_index(value, index);
		_value.invalidate();
	};
	_value.move_item = function(from_index, to_index) {
		var value = _value.get();
		move_index(value, from_index, to_index);
		_value.invalidate();
		return this;
	};
	_value.move = function(key, to_index) {
		var value = _value.get();
		var from_index = _.indexOf(value, item);
		_value.move_item(from_index, to_index);
		return this;
	};
	
	return _value;
});

}(cjs));
