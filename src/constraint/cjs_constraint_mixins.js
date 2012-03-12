(function(cjs) {
var _ = cjs._;

cjs.constraint.mixin({
	unit: function(val, unit_name) {
		return parseFloat(val) + String(unit_name);
	}

	, add: function() {
		var values = _.map(arguments, function(arg) {
			return cjs.get(arg);
		});
		return _.reduce(values, function(memo, val) {
			return memo + val;
		}, 0);
	}

	, sub: function() {
		var values = _.map(arguments, function(arg) {
			return cjs.get(arg);
		});
		var first_val = _.first(values);
		var other_vals = _.rest(values);
		return _.reduce(other_vals, function(memo, val) {
			return memo - val;
		}, first_val);
	}

	, mul: function() {
		var values = _.map(arguments, function(arg) {
			return cjs.get(arg);
		});
		return _.reduce(values, function(memo, val) {
			return memo * val;
		}, 1);
	}

	, div: function() {
		var values = _.map(arguments, function(arg) {
			return cjs.get(arg);
		});
		var first_val = _.first(values);
		var other_vals = _.rest(values);
		return _.reduce(other_vals, function(memo, val) {
			return memo / val;
		}, first_val);
	}

	, map: function(arr, func) {
		var index = 0;
		var rv =  _.map(arr, function(val, key) {
			return func.call(this, val, key, index++);
		});
		return rv;
	}

	, item: function(arr, item) {
		return cjs.item(arr, item);
	}
});


}(cjs));
