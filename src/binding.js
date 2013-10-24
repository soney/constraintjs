	// Check if jQuery is available
	var is_jquery_obj = function(x) {
		return has(root, "jQuery") ? (x instanceof root.jQuery) : false;
	};

	var nList = root.NodeList || false; // a node list is what is returned when you call getElementsByTagName, etc.

	// Convert an object that can be passed into a binding into an array of dom elements
	var get_dom_array = function(obj) {
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
		} else if(nList && obj instanceof nList) { // node list
			return toArray(obj);
		} else { // hopefully just an element; return its value as an array
			return [obj];
		}
	};

	var Binding = function(options) {
		var targets = options.targets,
			value = options.value,
			initialValue = options.initialValue,
			onAdd = isFunction(options.onAdd) ? options.onAdd : false,
			onRemove = isFunction(options.onRemove) ? options.onRemove : false,
			onMove = isFunction(options.onMove) ? options.onMove : false,
			setter = options.setter;

		this._throttle_delay = false;
		this._timeout_id = false;

		var curr_value = value.get();

		var old_targets = [];
		this._do_update = function() {
			this._timeout_id = false;
			var new_targets = filter(get_dom_array(targets), isElement);

			if(onAdd || onRemove || onMove) {
				var diff = get_array_diff(old_targets, new_targets);
				each(diff.added, function(added) {
				});
				each(diff.removed, function(removed) {
				});
				each(diff.moved, function(moved) {
				});
				old_targets = new_targets;
			}

			each(new_targets, function(target) {
				setter(target, curr_value);
			});
		};

		this.$live_fn = cjs.liven(function() {
			curr_value = value.get();
			if(this._throttle_delay && !this._timeout_id) {
				this._timeout_id = root.setTimeout(bind(this._do_update, this), this._throttle_delay);
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
				root.clearTimeout(this._timeout_id);
				this._timeout_id = false;
			}
			this.$live_fn.run();
			return this;
		};
		proto.destroy = function() {
			this.$live_fn.destroy();
		};
	}(Binding));

	var text_binding = function(elements) {
		var args = slice.call(arguments, 1);
		var val = cjs(function() {
			var arg_val_arr = map(args, function(arg) {
				return cjs.get(arg) + "";
			});

			return arg_val_arr.join("");
		});

		var binding = new Binding({
			targets: elements,
			setter: function(element, value) {
				element.textContent = value;
			},
			value: val
		});
		return binding;
	};
	cjs.text = text_binding;
