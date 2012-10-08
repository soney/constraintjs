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
		cjs.children(rv, cjs.$(function() {
			return _.compact(_.map(_.flatten(cjs.get(args, true)), function(x){
				if(_.isString(x)) {
					var rv = document.createTextNode(x);
					return rv;
				}
				return x;
			}));
		}));
		return rv;
	}
};

cjs.variable_fsm_$ = function(constraint, values) {
	var old_fsm, old_val;
	var rv = cjs(function() {
		var fsm = cjs.get(constraint, true);
		console.log(fsm);
		if(old_fsm === fsm) {
			return old_val;
		} else {
			if(old_val) { old_val.destroy(); }
			old_fsm = fsm;
		}
		return old_val = cjs.fsm_$(fsm, values);
	});
};

}(cjs));
