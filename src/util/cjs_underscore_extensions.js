(function(cjs) {
	var _ = cjs._;

	_.mixin({
		remove_index: function(arr, from, to) {
			//http://ejohn.org/blog/javascript-array-remove/
			var rest = arr.slice((to || from) + 1 || arr.length);
			arr.length = from < 0 ? arr.length + from : from;
			return arr.push.apply(arr, rest);
		}
		, remove: function(arr, obj) {
			var objIndex = _.index_of(arr, obj);

			if(objIndex>=0) {
				_.remove_index(arr, objIndex);
			}
		}
		, index_of: function(arr, item, equality_check) {
			if(equality_check === undefined) { equality_check = function(a,b) { return a === b; }; }
			return _.index_where(arr, function(x) { return equality_check(item, x); });
		}
		, index_where: function(arr, test) {
			var i, len = arr.length;
			for(i = 0; i<len; i++) {
				if(test(arr[i], i)) { return i; }
			}
			return -1;
		}
		, clear: function(arr) {
			arr.length = 0;
		}
		, insert_at: function(arr, item, index) {
			var rest;
			if(index===undefined) { return arr.push(item); }

			rest = arr.slice(index);
			arr.length = index;
			arr.push(item);
			return arr.push.apply(arr, rest);
		}
		, set_index: function(arr, old_index, new_index) {
			if(old_index>=0 && old_index < arr.length && new_index>=0 && new_index < arr.length) {
				var obj = arr[old_index];
				_.remove_index(arr, old_index);
				/*
				if(new_index > old_index) {
					new_index--; //Account for the fact that the indicies shift
				}
				*/
				_.insert_at(arr, obj, new_index);
				return obj;
			}
			return false;
		}
		, diff: function(oldArray, newArray, equality_check) {
			/*
			   diff returns an object with attributes:
			   removed, added, and moved.
			   Every item in removed has the format: {item, index}
			   Every item in added has the format: {item, index}
			   Every item in moved has the format: {from_index, to_index}

			   When oldArray removes every item in removed, adds every item in added,
			   and moves every item in moved in sequence, it will result in an array
			   that is equivalent to newArray.
			*/
			var old_arr = _.clone(oldArray)
				, new_arr = _.clone(newArray)
				, removed = []
				, added = []
				, moved = []
				, old_arr_clone = _.clone(old_arr)
				, new_arr_clone = _.clone(new_arr)
				, i, j;

			if(equality_check === undefined) { equality_check = function(a,b) { return a === b; }; }

			//Figure out removed
			for(i = 0; i<old_arr_clone.length; i++) {
				var old_item = old_arr_clone[i];
				var new_index = _.index_of(new_arr_clone, old_item, equality_check);
				if(new_index >= 0) {
					_.remove_index(new_arr_clone, new_index);
				}
				else {
					var removed_item = {
						item: old_item,
						index: i
					};
					_.remove_index(old_arr_clone, i);
					i--;

					removed.push(removed_item);
				}
			}

			//Figure out added
			old_arr_clone = _.clone(old_arr); //...reset the old array, which was mutated in the previous step
			for(i = 0; i<new_arr.length; i++) {
				var new_item = new_arr[i];
				var old_index = _.index_of(old_arr_clone, new_item, equality_check);
				if(old_index >= 0) {
					_.remove_index(old_arr_clone, old_index);
				}
				else {
					var added_item = {
						item: new_item,
						index: i
					};

					added.push(added_item);
				}
			}

			//Figure out moved by first creating an array with all of the right elements...
			var after_removing_and_adding = _.clone(old_arr);
			for(i = removed.length-1; i>=0; i--) { //Go in reverse to prevent index shifting
				var rm_index = removed[i].index;
				_.remove_index(after_removing_and_adding, rm_index);
			}
			for(i = 0; i<added.length; i++) {
				_.insert_at(after_removing_and_adding, added[i].item, added[i].index);
			}

			var added_contains_index = function(i) {
				_.any(added, function(a) {
					return a.index === i;
				});
			};
			//And then figuring out where elements may be swapped...
			var swaps = [];
			for(i = 0; i < after_removing_and_adding.length; i++) {
				var is_item = new_arr[i];
				if(!added_contains_index(i)) {
					for(j = i+1; j < after_removing_and_adding.length; j++) {
						if(!added_contains_index(i) && equality_check(after_removing_and_adding[j], is_item)) {
							swaps.push({from: j, to: i, from_item: after_removing_and_adding[j], to_item: after_removing_and_adding[i] });
							//Note that always, from > to

							var temp = after_removing_and_adding[j];
							after_removing_and_adding[j] = after_removing_and_adding[i];
							after_removing_and_adding[i] = temp;
							break;
						}
					}
				}
			}
			for(i = 0; i<swaps.length; i++) {
				var swap = swaps[i];
				var moveCommand1 = {
					from_index: swap.from,
					to_index: swap.to,
					item: swap.from_item
				};
				var moveCommand2 = {
					from_index: swap.to+1,
					to_index: swap.from,
					item: swap.to_item
				};
				if(moveCommand1.from_index!==moveCommand1.to_index) {
					moved.push(moveCommand1);
				}
				if(moveCommand2.from_index!==moveCommand2.to_index) {
					moved.push(moveCommand2);
				}
				//These two move commands are equivalent to a swap command
			}

			return {removed: removed, added: added, moved: moved};
		}
	});
}(cjs));
