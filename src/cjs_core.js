var cjs = (function (root) {
	var cjs_call = function(arg0, arg1) {
		var _ = cjs._;
		if(_.isString(arg0)) { //Assume it's a selector, arg1 is the context
			if(arg1 === true) {
				return cjs.create("constraint", arg0);
			} else {
				return cjs.$.apply(cjs, arguments);
			}
		} else if(_.isFunction(arg0)) {
			if(arg1 === true) {
				return cjs.create("constraint", arg0, true);
			} else {
				return cjs.create("constraint", arg0);
			}
		} else {
			var args = _.toArray(arguments);
			return cjs.create("constraint", function() {
				return args;
			});
		}
		
		return cjs.constraint.apply(cjs, arguments);
	};
	var cjs = function () {
		return cjs_call.apply(this, arguments);
	};

	cjs.$ = function(arg0, arg1) {
		var _ = cjs._;
		if(_.isString(arg0)) { //Assume it's a selector, arg1 is the context
			return cjs.create("selector_constraint", arg0, arg1);
		} else {
		}
	};

	var factories = {};
	cjs.define = function(type, factory) {
		factories[type] = factory;
	};
	cjs.create = function(type) {
		if(factories.hasOwnProperty(type)) {
			var factory = factories[type];
			var args = [].slice.call(arguments, 1);
			return factory.apply(root, args);
		} else {
			return undefined;
		}
	};

	var types = {};
	cjs.type = function(type_name, value) {
		if(arguments.length === 1) {
			return types[type_name];
		} else if(arguments.length > 1) {
			types[type_name] = value;
		}
	};

	if (typeof exports !== 'undefined') {
		cjs._is_node = true;
		if (typeof module !== 'undefined' && module.exports) {
			exports = module.exports = cjs;
		}
		exports.cjs = cjs;
	} else {
		cjs._is_node = false;
		var _old_cjs = root.cjs;
		root.cjs = cjs;
		cjs.noConflict = function () {
			root.cjs = _old_cjs;
			return cjs;
		};
	}

	cjs._debug = true;
	cjs.version = "0.5";

	return cjs;
}(this));
