	var make_node = function(item) {
			if(isAnyElement(item)) {
				return item;
			} else {
				var node = doc.createTextNode(item);
				return node;
			}
		},
		insert_at = function(child_node, parent_node, index) {
			var children = parent_node.childNodes;
			if(children.length <= index) {
				parent_node.appendChild(child_node);
			} else {
				var before_child = children[index];
				parent_node.insertBefore(child_node, before_child);
			}
		},
		remove_node = function(child_node) {
			var parentNode = child_node.parentNode;
			if(parentNode !== null) {
				parentNode.removeChild(child_node);
			}
		},
		remove_index = function(parent_node, index) {
			var children = parent_node.childNodes, child_node;
			if(children.length > index) {
				child_node = children[index];
				remove_node(child_node);
			}
		},
		move_child = function(parent_node, to_index, from_index) {
			var children = parent_node.childNodes;
			if(children.length > from_index) {
				var child_node = children[from_index];
				if(parent_node) {
					if(from_index < to_index) { //If it's less than the index we're inserting at...
						to_index++; //Increase the index by 1, to make up for the fact that we're removing me at the beginning
					}
					insert_at(child_node, parent_node, to_index);
				}
			}
		},
		// Check if jQuery is available
		is_jquery_obj = function(x) {
			return has(root, "jQuery") ? (x instanceof root.jQuery) : false;
		},
		nList = root.NodeList || false,
		// a node list is what is returned when you call getElementsByTagName, etc.
		isNList = nList ? function(x) { return x instanceof nList; } : function() { return false; },
		// Convert an object that can be passed into a binding into an array of dom elements
		get_dom_array = function(obj) {
			if(isArray(obj)) { // already an array
				return obj;
			} else if (is_constraint(obj)) { // regular constraint
				return get_dom_array(obj.get());
			} else if(is_array(obj)) { // array constraint
				return obj.toArray();
			} else if(is_map(obj)) { // map constraint
				return obj.values();
			} else if(is_jquery_obj(obj)) { // jquery object
				return root.jQuery.makeArray(obj);
			} else if(isNList(obj)) { // node list
				return toArray(obj);
			} else { // hopefully just an element; return its value as an array
				return [obj];
			}
		};

	var Binding = function(options) {
		var targets = options.targets,
			initialValue = options.initialValue,
			onAdd = options.onAdd,
			onRemove = options.onRemove,
			onMove = options.onMove,
			setter = options.setter,
			getter = options.getter,
			init_val = options.init_val;

		this._throttle_delay = false;
		this._timeout_id = false;

		var curr_value, last_value;
		if(isFunction(init_val)) {
			last_value = init_val(get_dom_array(targets[0]));
		} else {
			last_value = init_val;
		}
		var old_targets = [];
		this._do_update = function() {
			this._timeout_id = false;
			var new_targets = filter(get_dom_array(targets), isAnyElement);

			if(onAdd || onRemove || onMove) {
				var diff = get_array_diff(old_targets, new_targets);
				each(onRemove && diff.removed, function(removed) { onRemove(removed.from_item, removed.from); });
				each(onAdd && diff.added, function(added) { onAdd(added.item, added.to); });
				each(onMove && diff.moved, function(moved) { onMove(moved.item, moved.to_index, moved.from_index); });
				old_targets = new_targets;
			}

			each(new_targets, function(target) {
				setter(target, curr_value, last_value);
			});
			last_value = curr_value;
		};

		this.$live_fn = cjs.liven(function() {
			curr_value = getter();
			if(this._throttle_delay && !this._timeout_id) {
				this._timeout_id = sTO(bind(this._do_update, this), this._throttle_delay);
			} else {
				this._do_update();
			}
		}, {
			context: this
		});
	};

	(function(my) {
		var proto = my.prototype;
		proto.pause = function() {
			this.$live_fn.pause();
		};
		proto.resume = function() {
			this.$live_fn.resume();
		};
		proto.throttle = function(min_delay) {
			this._throttle_delay = min_delay > 0 ? min_delay : false;
			if(this._throttle_delay && this._timeout_id) {
				cTO(this._timeout_id);
				this._timeout_id = false;
			}
			this.$live_fn.run();
			return this;
		};
		proto.destroy = function() {
			this.$live_fn.destroy();
		};
	}(Binding));

	var create_list_binding = function(list_binding_getter, list_binding_setter, list_binding_init_value) {
		return function(elements) {
			var args = slice.call(arguments, 1);
			var val = cjs(function() {
				return list_binding_getter(args);
			});

			var binding = new Binding({
				targets: elements,
				getter: function() { return val.get(); },
				setter: function(element, value, old_value) {
					list_binding_setter(element, value, old_value);
				},
				init_val: list_binding_init_value
			});
			return binding;
		};
	};
	
	var create_textual_binding = function(setter) {
		return create_list_binding(function(args) {
			return map(args, cjs.get).join("");
		}, function(element, value) {
			setter(element, value);
		});
	};
	var text_binding = create_textual_binding(function(element, value) {
			element.textContent = value;
		}),
		html_binding = create_textual_binding(function(element, value) {
			element.innerHTML = value;
		}),
		val_binding = create_textual_binding(function(element, value) {
			element.val = value;
		}),
		class_binding = create_list_binding(function(args) {
			var arg_val_arr = map(args, function(arg) {
				return cjs.get(arg);
			});

			return flatten(arg_val_arr, true);
		}, function(element, value, old_value) {
			var ad = get_array_diff(old_value, value);
			var curr_class_name = " " + element.className + " ";
			var added_classes = map(ad.added, function(added_info) {
				return added_info.item;
			}).join(" ");
			each(ad.removed, function(removed_info) {
				curr_class_name = curr_class_name.replace(" " + removed_info.from_item + " ", " ");
			});
			curr_class_name += added_classes;
			curr_class_name = curr_class_name.trim();
			element.className = curr_class_name;
		}, []);

	var children_binding = create_list_binding(function(args) {
		var arg_val_arr = map(args, function(arg) {
			return cjs.get(arg);
		});

		return map(flatten(arg_val_arr, true), make_node);
	}, function(element, value, old_value) {
		var ad = get_array_diff(old_value, value);
		each(ad.removed, function(removed_info) { remove_index(element, removed_info.from); });
		each(ad.added, function(added_info) { insert_at(added_info.item, element, added_info.to); });
		each(ad.moved, function(moved_info) { move_child(element, moved_info.to_index, moved_info.from_index); });
	}, function(element) {
		return toArray(element.childNodes);
	});

	var create_obj_binding = function(obj_binding_setter) {
		return function(elements) {
			var vals,
				args = slice.call(arguments, 1);
			if(args.length === 0) {
				return;
			} else if(args.length === 1) {
				vals = args[0];
			} else if(args.length > 1) {
				vals = {};
				vals[args[0]] = args[1];
			}

			var binding = new Binding({
				targets: elements,
				setter: function(element, value) {
					each(value, function(v, k) {
						obj_binding_setter(element, k, v);
					});
				},
				getter: function() {
					var obj_vals, rv = {};
					if(is_map(vals)) {
						obj_vals = vals.toObject();
					} else {
						obj_vals = vals;
					}
					each(obj_vals, function(v, k) {
						rv[k] = cjs.get(v);
					});
					return rv;
				}
			});

			return binding;
		};
	};
	var css_binding = create_obj_binding(function(element, key, value) {
			element.style[camel_case(key)] = value;
		}),
		attr_binding = create_obj_binding(function(element, key, value) {
			element.setAttribute(key, value);
		});

	extend(cjs, {
		"text": text_binding,
		"html": html_binding,
		"val": val_binding,
		"class": class_binding,
		"children": children_binding,
		"attr": attr_binding,
		"css": css_binding
	});

	var inp_change_events = ["keyup", "input", "paste", "propertychange", "change"];
	cjs.inputValue = function(inps) {
		var arr_inp;
		if(isElement(inps)) {
			inps = [inps];
			arr_inp = false;
		} else {
			arr_inp = true;
		}
        var constraint = cjs(function() {
				if(arr_inp) {
					return map(inps, function(inp) { return inp.value; });
				} else {
					return inps[0].value;
				}
			}),
			len = inps.length,
			on_change = bind(constraint.invalidate, constraint),
			activate = function() {
				each(inp_change_events, function(event_type) {
					each(inps, function(inp) {
						inp.addEventListener(event_type, on_change);
					});
				});
			},
			deactivate = function() {
				each(inp_change_events, function(event_type) {
					each(inps, function(inp) {
						inp.removeEventListener(event_type, on_change);
					});
				});
			},
			oldDestroy = constraint.destroy;

		constraint.destroy = function() {
			deactivate();
			oldDestroy.call(constraint);
		};
        activate();
        return constraint;
	};
