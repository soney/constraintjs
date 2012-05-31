/*jslint evil: true regexp: true*/
/*global console: true, document:true */
(function(cjs) {
	var _ = cjs._;

	cjs.__parsers = {};
	cjs.__ir_builders = {};

	var templ = function(str, data) {
	};

	cjs.define("template", templ);

	cjs.template = function() {
		var args = _.toArray(arguments);
		args.unshift("template");
		return cjs.create.apply(cjs, args);
	};
}(cjs));
