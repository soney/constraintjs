/*global document:true */
(function(cjs) {if(!cjs._is_node) {
cjs.binding.mixin({
	val: function(elem, constraint) {
		if(arguments.length === 1) {
			//Return a constraint whose value is my val
		} else {
			return cjs.binding.bind(elem, "value", constraint);
		}
	}
});
}}(cjs));
