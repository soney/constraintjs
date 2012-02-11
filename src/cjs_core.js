var cjs = (function (root) {
	var cjs_call = function () {
	};
	var cjs = function () {
		return cjs_call.apply(this, arguments);
	};
	cjs._debug = true;

	var _old_cjs = root.cjs;
	root.cjs = cjs;
	cjs.noConflict = function () {
		root.cjs = _old_cjs;
		return cjs;
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

	return cjs;
}(this));
