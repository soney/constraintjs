(function(cjs) {
	var _ = cjs._;

	var Binding = function(options, autoactivate) {
		this.options = _.clone(options);

		this.update = this.options.update || function(){};

		this._activated = false;
		if(autoactivate !== false) {
			this.activate();
		}
	};
	(function(my) {
		var proto = my.prototype;
		proto.activate = function() {
			if(!this.is_activated()) {
				this._activated = true;
				if(_.isFunction(this.options.activate)) { this.options.activate(); }
				this.update();
			}
		};
		proto.deactivate = function() {
			if(this.is_activated()) {
				this._activated = false;
				if(_.isFunction(this.options.deactivate)) { this.options.deactivate(); }
			}
		};
		proto.destroy = function() {
			this.deactivate();
			if(_.isFunction(this.options.destroy)) { this.options.destroy(); }
		};
		proto.is_activated = function() {
			return this._activated;
		};
	}(Binding));

	var create_binding = function(options, autoactivate) {
		return new Binding(options, autoactivate);
	};
	cjs.binding = create_binding;
	cjs.define("binding", cjs.binding);

	var create_group_binding = function(options) {
		options = _.clone(options);
		var objs = options.objs;

		var activate, deactivate, update, destroy;
		var binding;

		var activate_fn = function() {
			if(_.isFunction(options.activate_fn)) {
				return options.activate_fn.apply(this, arguments);
			}
		};
		var deactivate_fn = function() {
			if(_.isFunction(options.deactivate_fn)) {
				return options.deactivate_fn.apply(this, arguments);
			}
		};
		var update_fn = function() {
			if(_.isFunction(options.update_fn)) {
				return options.update_fn.apply(this, arguments);
			}
		};
		var destroy_fn = function() {
			if(_.isFunction(options.destroy_fn)) {
				return options.destroy_fn.apply(this, arguments);
			}
		};

		if(cjs.is_constraint(objs)) {
			var get_objs = function() {
				var val = objs.get();
				if(_.isArray(val)) {
					return val;
				} else {
					return [val];
				}
			};
			var binding_objs = _.map(get_objs(), function(obj) {
				var rv = cjs.create("binding", {
					activate: _.bind(activate_fn, obj, obj)
					, deactivate: _.bind(deactivate_fn, obj, obj)
					, update: _.bind(update_fn, obj, obj)
					, destroy: _.bind(destroy_fn, obj, obj)
				}, false);
				if(binding && binding.is_activated()) {
					rv.activate();
				}
				return rv;
			});


			var cached_val = _.clone(get_objs());
			var on_change = function() {
				var val = get_objs();
				var diff = _.diff(cached_val, val);

				_.forEach(diff.added, function(x) {
					var obj = x.item;
					var mapped_val = cjs.create("binding", {
						activate: _.bind(activate_fn, obj, obj)
						, deactivate: _.bind(deactivate_fn, obj, obj)
						, update: _.bind(update_fn, obj, obj)
						, destroy: _.bind(destroy_fn, obj, obj)
					}, false);
					if(binding && binding.is_activated()) {
						mapped_val.activate();
					}
					_.insert_at(binding_objs, mapped_val, x.index);
				});
				_.forEach(diff.removed, function(x) {
					var binding = binding_objs[x.index];
					binding.destroy();
					_.remove_index(binding_objs, x.index);
				});
				_.forEach(diff.moved, function(x) {
					_.set_index(binding_objs, x.from_index, x.to_index);
				});

				cached_val = _.clone(val);
			};

			activate = function() {
				if(_.isFunction(options.activate)) {
					options.activate();
				}
				_.forEach(binding_objs, function(x) {
					x.activate();
				});
				objs.onChange(on_change, options.update_interval);
			};

			deactivate = function() {
				_.forEach(binding_objs, function(x) {
					x.deactivate();
				});
				if(_.isFunction(options.deactivate)) {
					options.deactivate();
				}
				objs.offChange(on_change);
			};

			update = function() {
				_.forEach(binding_objs, function(x) {
					x.update();
				});
				if(_.isFunction(options.update)) {
					options.update();
				}
			};

			destroy = function() {
				_.forEach(binding_objs, function(x) {
					x.destroy();
				});
				if(_.isFunction(options.destroy)) {
					options.destroy();
				}
			};

			binding = cjs.create("binding", {
				activate: activate, deactivate: deactivate, update: update, destroy: destroy
			}, false);
		} else {
			if(!_.isArray(objs)) {
				objs = [objs];
			}

			var bindings = _.map(objs, function(obj) {
				return cjs.create("binding", {
					activate: _.bind(activate_fn, obj, obj)
					, deactivate: _.bind(deactivate_fn, obj, obj)
					, update: _.bind(update_fn, obj, obj)
					, destroy: _.bind(destroy_fn, obj, obj)
				});
			});

			activate = function() {
				if(_.isFunction(options.activate)) {
					options.activate();
				}
				_.forEach(bindings, function(x) {
					x.activate();
				});
			};

			deactivate = function() {
				_.forEach(bindings, function(x) {
					x.deactivate();
				});
				if(_.isFunction(options.deactivate)) {
					options.deactivate();
				}
			};

			update = function() {
				_.forEach(bindings, function(x) {
					x.update();
				});
				if(_.isFunction(options.update)) {
					options.update();
				}
			};

			destroy = function() {
				_.forEach(bindings, function(x) {
					x.destroy();
				});
				if(_.isFunction(options.destroy)) {
					options.destroy();
				}
			};

			binding = cjs.create("binding", {
				activate: activate, deactivate: deactivate, update: update, destroy: destroy
			}, false);
		}
		return binding;
	};
	cjs.define("group_binding", create_group_binding);

	var BindingWrapper = function(context) {
		this.context = context;
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
			if(!_.has(cjs.constraint, propname)) {
				cjs.constraint.raw_mixin(propname, function(elems) {
					var binding = cjs.binding[propname].apply(cjs.binding, arguments);
					elems.push_binding(binding);
					return elems;
				});
			}
		});
	};

	cjs.binding.mixin("bind", function(objs, constraint, setter, update_interval, do_activate) {
		var update_fn = function(obj) {
			var val = cjs.get(constraint);
			setter(obj, val, constraint);
		};

		var rv;

		rv = cjs.create("group_binding", {
			objs: objs
			, update_fn: update_fn
			, activate: function() {
				//this refers to the group binding object
				if(cjs.is_constraint(constraint)) {
					constraint.onChange(rv.update);
				}
			}
			, deactivate: function() {
				if(cjs.is_constraint(constraint)) {
					constraint.offChange(rv.update);
				}
			}
			, update_interval: update_interval
		}, false);
		if(do_activate !== false) {
			rv.activate();
		}
		return rv;
	});
	/*

	cjs.binding.define = function(arg0, arg1) {
		var mixin_obj;
		if(_.isString(arg0)) {
			mixin_obj = {};
			mixin_obj[arg0] = arg1;
		} else {
			mixin_obj = arg0;
		}
		_.forEach(mixin_obj, function(setter, propname) {
			cjs.binding.mixin(propname, function(objs) {
				return cjs.binding.bind(objs, constraint, setter);
			});
		});
	};
	*/
}(cjs));
//Binding: constraint -> DOM element
