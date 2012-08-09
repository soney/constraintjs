(function(cjs) {
var CJSArray = function(value) {
	if(!_.isArray(value)) {
		value = [];
	}
	this._value = cjs.create("constraint", value);
};

(function(my) {
	var proto = my.prototype;
	proto.push = function() {
		var value = this._value.get();
		var rv = value.push.apply(value, arguments);
		value.invalidate();
		return rv;
	};
	proto.set_item = function(index, item) {
		var value = this._value.get();
		value[index] = item;
		value.invalidate();
		return rv;
	};
	proto.item = function(index) {
		var value = this._value.get();
		return value[index];
	};
	proto.$item = function(index) {
		var self = this;
		return cjs(function() {
			var index_got = cjs.get(index);
			var value_got = self._value.get();
			return value_got[index_got];
		});
	};
}(CJSArray));

cjs.define("map", function() {
	return new Map();
});

}(cjs));
