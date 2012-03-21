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

	, clone: function(val) {
		return val;
	}
});

cjs.constraint.raw_mixin("snapshot", function(constraint) {
	var val = constraint.get();
	var rv = cjs.create("constraint", val);
	rv.basis = constraint;
	return rv;
});
}(cjs));
