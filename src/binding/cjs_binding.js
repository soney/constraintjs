(function(cjs) {
	var _ = cjs._;

	var Binding = function(options) {
		var opts = _.extend({}, options);
		this.activate = opts.activate;
		this.deactivate = opts.deactivate;
		this.destroy = opts.destroy;
		this.update = opts.update;

		this._activated = false;
		this._activate();
	};
	(function(my) {
		var proto = my.prototype;
		proto._activate = function() {
			if(!this._activated) {
				this._activated = true;
				if(_.isFunction(this.activate)) { this.activate(); }
				this._update();
			}
		};
		proto.deactivate = function() {
			if(this._activated) {
				this._activated = false;
				if(_.isFunction(this.deactivate)) { this.deactivate(); }
			}
		};
		proto._destroy = function() {
			this._deactivate();
			if(_.isFunction(this.destroy)) { this.destroy(); }
		};
		proto._update = function() {
			if(_.isFunction(this.update)) { this.update(); }
		};
	}(Binding));

	var create_binding = function(options) {
		return new Binding(options);
	};
	cjs.binding = create_binding;
	cjs.define("binding", cjs.binding);

	var BindingWrapper = function(context_arr) {
		this.context_arr = context_arr;
		this.last_bindings = [];
		this.last_binding = null;
	};
	(function(my) {
		var proto = my.prototype;
		proto.forEach = function(func) {
			_.forEach(this.context, func);
		};
		proto.map = function(func) {
			return _.map(this.context, func);
		};
	}(BindingWrapper));

	cjs.binding.raw_mixin = function(propname, propval) {
		cjs.binding[propname] = function() {
			return propval.apply(this, arguments);
		};

		BindingWrapper.prototype[propname] = function() {
			var self = this;
			var args = _.toArray(arguments);
			this.last_bindings = this.map(function(obj) {
				this.last_binding = cjs.binding[propname].apply(self, ([obj]).concat(args));
				return this.last_binding;
			});
			return this;
		};
	};

	cjs.binding.mixin = function(arg0, arg1) {
		var mixin_obj;
		if(_.isString(arg0)) {
			mixin_obj = {};
			mixin_obj[arg0] = arg1;
		} else {
			mixin_obj = arg0;
		}

		_.forEach(mixin_obj, function(propval, propname) {
			cjs.binding.raw_mixin(propname, propval);
			cjs.binding[propname] = function(arg0) {
				var elems;
				if(_.isArray(arg0)) {
					elems = arg0;
				} else if(cjs.is_constraint(arg0)) {
					arg0.forEach(function(obj) {

					}, function(obj) {
					});
				} else {
					elems = [arg0];
				}
			};

			BindingWrapper.prototype[propname] = function() {
				var self = this;
				var args = _.toArray(arguments);
				this.last_bindings = this.map(function(obj) {
					this.last_binding = cjs.binding[propname].apply(self, ([obj]).concat(args));
					return this.last_binding;
				});
				return this;
			};
		});
	};

	cjs.binding.mixin("bind", function(obj, prop_name, constraint, setter) {
		if(!_.isFunction(setter)) {
			setter = function(o, pn, v) {
				o[pn] = cjs.get(v);
			};
		}

		var update_fn = function(value) {
			setter(obj, prop_name, value);
		};

		return cjs.create("binding", {
			update: update_fn
			, activate: function() {
				constraint.onChange(update_fn);
			}
			, deactivate: function() {
				constraint.offChange(update_fn);
			}
		});
	});
}(cjs));
//Binding: constraint -> DOM element
