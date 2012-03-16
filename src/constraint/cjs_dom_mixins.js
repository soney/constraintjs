/*global document:true */
(function(cjs) {if(!cjs._is_node) {
var _ = cjs._;
cjs.constraint.mixin({
	css: function(arg0, arg1) {
		if(arguments.length === 1) {
		}
		return parseFloat(val) + String(unit_name);
	}
});

cjs.constraint.raw_mixin("snapshot", function(constraint) {
	var val = constraint.get();
	var rv = cjs.create("constraint", val);
	rv.basis = constraint;
	return rv;
});

}}(cjs));
