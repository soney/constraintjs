(function(cjs) {
var _ = cjs._;

cjs.constraint.raw_mixin("forEach", function(constraint, func, context) {
	var val = constraint.get();
	_.forEach(val, func, context);
	return constraint;
});


var get_array_change_listener = function(constraint) {
	if(_.has(constraint, "__array_change_listener")) {
		return constraint.__array_change_listener;
	}

	var constraint_getter = function() {
		var value = cjs.get(constraint, true);
		if(!_.isArray(value)) {
			value = [value];
		}
		return value;
	};

	var cached_value = constraint_getter();

	var change_listener = function() {
		var value = constraint_getter();
		var diff = _.diff(cached_value, value);
		_.forEach(diff.removed, function(x) {
			_.forEach(change_listener.removed_listeners, function(removed_listener) {
				removed_listener(x.item, x.index);
			});
		});
		_.forEach(diff.added, function(x) {
			_.forEach(change_listener.added_listeners, function(added_listener) {
				added_listener(x.item, x.index);
			});
		});
		_.forEach(diff.moved, function(x) {
			_.forEach(change_listener.moved_listeners, function(moved_listener) {
				moved_listener(x.item, x.to_index, x.from_index);
			});
		});
	};
	change_listener.added_listeners = [];
	change_listener.removed_listeners = [];
	change_listener.moved_listeners = [];

	change_listener.empty_sub_listeners = function() {
		return _.isEmpty(change_listener.added_listeners) &&
				_.isEmpty(change_listener.removed_listeners) &&
				_.isEmpty(change_listener.moved_listeners);
	};
	change_listener.remove_self = function() {
		change_listener.added_listeners = change_listener.removed_listeners = change_listener.moved_listeners = null;
	};

	constraint.onChange(change_listener);
	return change_listener;
};
var remove_array_change_listener = function(constraint) {
	constraint.offChange(constraint.__array_change_listener);
	delete constraint.__array_change_listener;
};

cjs.constraint.raw_mixin("onAdd", function(constraint, func) {
	var array_change_listener = get_array_change_listener(constraint);
	array_change_listener.added_listeners.push(func);
	return constraint;
});
cjs.constraint.raw_mixin("offAdd", function(constraint, func) {
	var array_change_listener = get_array_change_listener(constraint);
	_.removeAll(array_change_listener.added_listeners, func);
	if(array_change_listener.has_no_sub_listeners()) {
		remove_array_change_listener(constraint);
	}
	return constraint;
});

cjs.constraint.raw_mixin("onRemove", function(constraint, func) {
	var array_change_listener = get_array_change_listener(constraint);
	array_change_listener.removed_listeners.push(func);
	return constraint;
});
cjs.constraint.raw_mixin("offRemove", function(constraint, func) {
	var array_change_listener = get_array_change_listener(constraint);
	_.removeAll(array_change_listener.removed_listeners, func);
	if(array_change_listener.has_no_sub_listeners()) {
		remove_array_change_listener(constraint);
	}
	return constraint;
});

cjs.constraint.raw_mixin("onMove", function(constraint, func) {
	var array_change_listener = get_array_change_listener(constraint);
	array_change_listener.moved_listeners.push(func);
	return constraint;
});
cjs.constraint.raw_mixin("offMove", function(constraint, func) {
	var array_change_listener = get_array_change_listener(constraint);
	_.removeAll(array_change_listener.moved_listeners, func);
	if(array_change_listener.has_no_sub_listeners()) {
		remove_array_change_listener(constraint);
	}
	return constraint;
});


}(cjs));
