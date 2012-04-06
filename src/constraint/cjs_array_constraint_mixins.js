(function(cjs) {
var _ = cjs._;

cjs.constraint.raw_mixin("push", function(constraint) {
	var my_val = constraint.get();
	my_val.push.apply(my_val, _.rest(arguments));
	my_val.nullify();

	return constraint;
});

cjs.constraint.raw_mixin("forEach", function(constraint, add_fn, remove_fn, move_fn) {
	if(_.isFunction(add_fn)) {
		var val = constraint.get();
		_.forEach(val, add_fn);
		constraint.onAdd(add_fn);
	}
	if(_.isFunction(remove_fn)) {
		constraint.onRemove(remove_fn);
	}
	if(_.isFunction(move_fn)) {
		constraint.onMove(remove_fn);
	}
	return constraint;
});

cjs.constraint.raw_mixin("map", function(constraint, add_fn, remove_fn, move_fn) {
	var cached_constraint_val = constraint.get();
	if(_.isUndefined(cached_constraint_val)) {
		cached_constraint_val = [];
	} else if(!_.isArray(cached_constraint_val)) {
		cached_constraint_val = [cached_constraint_val];
	}
	var cached_my_val = _.map(cached_constraint_val, add_fn);

	var rv = cjs.create("constraint", function() {
		var constraint_val = constraint.get();
		if(!_.isArray(constraint_val)) {
			constraint_val = [constraint_val];
		}
		var diff = _.diff(cached_constraint_val, constraint_val);
		var my_val = _.clone(cached_my_val);

		_.forEach(diff.removed, function(x) {
			var mapped_val = my_val[x.index];
			if(_.isFunction(remove_fn)) {
				remove_fn(x.item, x.index, mapped_val);
			}
			_.remove_index(my_val, x.index);
		});
		_.forEach(diff.added, function(x) {
			var mapped_val;
			if(_.isFunction(add_fn)) {
				mapped_val = add_fn(x.item, x.index);
			}
			_.insert_at(my_val, mapped_val, x.index);
		});
		_.forEach(diff.moved, function(x) {
			if(_.isFunction(move_fn)) {
				move_fn(x.item, x.to_index, x.from_index);
			}
			_.set_index(my_val, x.from_index, x.to_index);
		});

		cached_constraint_val = constraint_val;
		cached_my_val = my_val;

		return my_val;
	});

	return rv;
});


cjs.constraint.mixin({
	join: function(arr, str) {
		var rv = arr.join(str);
		return rv;
	}

	, first: function(arr) {
		return cjs.get_item(arr, 0);
	}
	, last: function(arr) {
		return cjs.get_item(arr, _.size(arr)-1);
	}
});
cjs.constraint.raw_mixin("item", function(constraint) {
	var prop_names = _.rest(arguments);
	return cjs.create("constraint", function() {
		var val = cjs.get(constraint);
		_.forEach(prop_names, function(prop_name) {
			var pn = cjs.get(prop_name);
			val = val[pn];
		});
		return cjs.get(val);
	});
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

	constraint.on_destroy(change_listener.remove_self);
	constraint.onChange(change_listener);
	return change_listener;
};
var remove_array_change_listener = function(constraint) {
	var array_change_listener = get_array_change_listener(constraint);
	constraint.off_destroy(array_change_listener.remove_self);
	array_change_listener.remove_self();
	constraint.offChange(array_change_listener);
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


cjs.constraint.mixin({
	pluck: function(arr, prop_name) {
		var rv =  _.pluck(arr, prop_name);
		return rv;
	}
});
}(cjs));
