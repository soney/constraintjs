(function(cjs) {
var _ = cjs._;

cjs.constraint.fn("unit", function(val, unit_name) {
	return parseFloat(val) + String(unit_name);
});

cjs.constraint.fn("add", function() {
	var values = _.map(arguments, function(arg) {
		return cjs.get(arg);
	});
	return _.reduce(values, function(memo, val) {
		return memo + val;
	}, 0);
});

cjs.constraint.fn("sub", function() {
	var values = _.map(arguments, function(arg) {
		return cjs.get(arg);
	});
	var first_val = _.first(values);
	var other_vals = _.rest(values);
	return _.reduce(other_vals, function(memo, val) {
		return memo - val;
	}, first_val);
});

cjs.constraint.fn("mul", function() {
	var values = _.map(arguments, function(arg) {
		return cjs.get(arg);
	});
	return _.reduce(values, function(memo, val) {
		return memo * val;
	}, 1);
});

cjs.constraint.fn("div", function() {
	var values = _.map(arguments, function(arg) {
		return cjs.get(arg);
	});
	var first_val = _.first(values);
	var other_vals = _.rest(values);
	return _.reduce(other_vals, function(memo, val) {
		return memo / val;
	}, first_val);
});

cjs.constraint.fn("map", function(arr, func) {
	return _.map(arr, function(val, key) {
		return func(val, key);
	});
});

}(cjs));
