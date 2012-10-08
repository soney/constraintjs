/*global document:true */
(function(cjs) {
var _ = cjs._;

cjs.dom = function(type) {
	var args = _.toArray(arguments).slice(1);

	if(type === "text") {
		var rv = document.createTextNode('');

		cjs.text(rv, cjs.$(function() {
			var arg_vals = _.map(args, function(arg) { return cjs.get(arg); });
			return arg_vals.join("");
		}));

		return rv;
	} else if(type === "comment") {
		var rv = document.createComment('');
		cjs.text(rv, cjs.$(function() {
			var arg_vals = _.map(args, function(arg) { return cjs.get(arg); });
			return arg_vals.join("");
		}));
		return rv;
	} else if(type === "element") {
		var tag = args.shift();
		var arttributes = args.shift();
		var rv = document.createElement(tag);
		cjs.children(rv, args);
		return rv;
	}
};

}(cjs));
