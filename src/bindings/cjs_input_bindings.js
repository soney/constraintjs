/*global document:true */
(function(cjs, root) {if(!cjs._is_node) {
var _ = cjs._;

var bind_inp_change = function(inp, callback) {
	var val = inp.value;
	var on_change = function(event) {
		var new_val = inp.value;
		if(val !== new_val) {
			val = new_val;
			callback(val, event);
		}
	};

	inp.addEventListener("keyup", on_change);
	inp.addEventListener("input", on_change);
	inp.addEventListener("paste", on_change);
	inp.addEventListener("propertychange", on_change);

	var unbind = function() {
		inp.removeEventListener("keyup", on_change);
		inp.removeEventListener("input", on_change);
		inp.removeEventListener("paste", on_change);
		inp.removeEventListener("propertychange", on_change);
	};

	return unbind;
};

cjs.define("input_constraint", function(inp) {
	var constraint = cjs.create("simple_constraint", function() {
		return inp.value;
	});
	var unbind = bind_inp_change(inp, function() {
		constraint.nullify();
	});

	constraint.on_destroy(unbind);

	return constraint;
});

}}(cjs, this));
