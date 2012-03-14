/*global document:true */
(function(cjs) {if(!cjs._is_node) {
cjs.binding.mixin({
	val: function(objs, constraint) {
		var setter = function(obj, val) {
			obj.value = val;
		};
		return cjs.binding.bind(objs, constraint, setter);
	}
});
}}(cjs));
