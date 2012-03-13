/*global document:true */
(function(cjs) {if(!cjs._is_node) {
cjs.binding.mixin({
	val: function(elem, constraint) {
		return cjs.binding.bind(elem, "value", constraint);
	}
});
}}(cjs));
