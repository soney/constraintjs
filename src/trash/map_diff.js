	// Compute the differences between two objects
	var compute_map_diff = function (key_diff, value_diff) {
		key_diff = clone(key_diff);
		value_diff = clone(value_diff);
		var set = [], unset = [], key_change = [], value_change = [], index_changed = [], moved = [];
		var i, j, added_key, removed_key;
		for(i = 0; i<key_diff.added.length; i++) {
			added_key = key_diff.added[i];
			for(j = 0; j<key_diff.removed.length; j++) {
				removed_key = key_diff.removed[j];
				if (added_key.to === removed_key.from) {
					key_change.push({index: added_key.to, from: removed_key.from_item, to: added_key.item});
					
					removeIndex(key_diff.added, i--);
					removeIndex(key_diff.removed, j);
					break;
				}
			}
		}
		for(i = 0; i<value_diff.added.length; i++) {
			var added_value = value_diff.added[i];
			for(j = 0; j<value_diff.removed.length; j++) {
				var removed_value = value_diff.removed[j];
				if (added_value.to === removed_value.from) {
					value_change.push({index: added_value.to, from: removed_value.from_item, to: added_value.item});
					
					removeIndex(value_diff.added, i--);
					removeIndex(value_diff.removed, j);
					break;
				}
			}
		}
		for(i = 0; i<key_diff.added.length; i++) {
			added_key = key_diff.added[i];
			for(j = 0; j<value_diff.added.length; j++) {
				var added_val = value_diff.added[j];
				if (added_key.to === added_val.to) {
					set.push({index: added_key.to, key: added_key.item, value: added_val.item});
		
					removeIndex(key_diff.added, i--);
					removeIndex(value_diff.added, j);
					break;
				}
			}
		}
		for(i = 0; i<key_diff.removed.length; i++) {
			removed_key = key_diff.removed[i];
			for(j = 0; j<value_diff.removed.length; j++) {
				var removed_val = value_diff.removed[j];
				if (removed_key.to === removed_val.to) {
					unset.push({from: removed_key.from, key: removed_key.from_item, value: removed_val.from_item});

					removeIndex(key_diff.removed, i--);
					removeIndex(value_diff.removed, j);
					break;
				}
			}
		}

		for (i = 0; i<key_diff.moved.length; i++) {
			var moved_key = key_diff.moved[i];
			for (j = 0; j<value_diff.moved.length; j++) {
				var moved_val = value_diff.moved[j];
				if (moved_key.to === moved_val.to && moved_key.from === moved_val.from) {
					moved.push({from: moved_key.from, to: moved_key.to, key: moved_key.item, value: moved_val.item, insert_at: moved_key.insert_at});

					removeIndex(key_diff.moved, i--);
					removeIndex(value_diff.moved, j);
					break;
				}
			}
		}
		for (i = 0; i<key_diff.index_changed.length; i++) {
			var index_changed_key = key_diff.index_changed[i];
			for (j = 0; j<value_diff.index_changed.length; j++) {
				var index_changed_val = value_diff.index_changed[j];
				if (index_changed_key.to === index_changed_val.to && index_changed_key.from === index_changed_val.from) {
					index_changed.push({from: index_changed_key.from, to: index_changed_key.to, key: index_changed_key.item, value: index_changed_val.item});

					removeIndex(key_diff.index_changed, i--);
					removeIndex(value_diff.index_changed, j);
					
					break;
				}
			}
		}
		return { set: set, unset: unset, key_change: key_change, value_change: value_change, index_changed: index_changed, moved: moved};
	};

	var get_map_diff = function (from_obj, to_obj, equality_check) {
		var from_keys = keys(from_obj),
			to_keys = keys(to_obj),
			from_values = values(from_obj),
			to_values = values(to_obj),
			key_diff = get_array_diff(from_keys, to_keys, equality_check),
			value_diff = get_array_diff(from_values, to_values, equality_check);

		return compute_map_diff(key_diff, value_diff);
	};
