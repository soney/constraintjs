	var is_jquery_obj = function(x) {
		return has(root, "jQuery") ? (x instanceof root.jQuery) : false;
	};

	var nList = root.nodeList;

	var get_dom_array = function(obj) {
		if(isArray(obj)) {
			return obj;
		} else if is_constraint(obj) {
			return get_dom_array(obj.get());
		} else if(is_array(obj)) {
			return obj.toArray();
		} else if(is_map(obj)) {
			return obj.values();
		} else if(is_jquery_obj(obj)) {
			return root.jQuery.makeArray(obj);
		} else if(nList && obj instanceof nList) {
			return toArray(obj);
		} else {
			return obj;
		}
	};

	var Binding = function(options) {
		var targets = options.targets,
			value = options.value,
			initialValue = options.initialValue,
			onAdd = options.onAdd,
			onRemove = options.onRemove,
			onMove = options.onMove;

		this._throttle_delay = false;
		this._timeout_id = false;

		this.$live_fn = cjs.liven(function() {
			if(this._throttle_delay) {
			} else {
				if(this._timeout_id === false) {
				}
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
			if(this._timeout_id !=== false) {
			}
			return this;
		};
		proto.destroy = function() {
			this.$live_fn.destroy();
		};
	}(Binding));
