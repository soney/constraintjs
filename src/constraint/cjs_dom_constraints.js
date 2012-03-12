/*global document:true */
(function(cjs) {if(!cjs._is_node) {
var _ = cjs._;
cjs.define("input_value_constraint", function(inp) {
	var constraint = cjs.create("constraint", function() {
		return inp.value;
	});
	var on_change = function() {
		constraint.nullify();
	};
	var activate = function() {
		inp.addEventListener("keyup", on_change);
		inp.addEventListener("input", on_change);
		inp.addEventListener("paste", on_change);
		inp.addEventListener("propertychange", on_change);
	};
	var deactivate = function() {
		inp.removeEventListener("keyup", on_change);
		inp.removeEventListener("input", on_change);
		inp.removeEventListener("paste", on_change);
		inp.removeEventListener("propertychange", on_change);
	};
	constraint.on_destroy(deactivate);

	activate();
	return constraint;
});

cjs.define("checked_inputs", function(inps) {
	var constraint = cjs.create("constraint", function() {
		return _.filter(inps, function(inp) {
			return inp.checked;
		});
	});
	var on_change = function() {
		constraint.nullify();
	};
	var activate = function() {
		_.forEach(inps, function(inp) {
			inp.addEventListener("change", on_change);
		});
	};
	var deactivate = function() {
		_.forEach(inps, function(inp) {
			inp.removeEventListener("change", on_change);
		});
	};
	constraint.on_destroy(deactivate);

	activate();
	return constraint;
});

}}(cjs));
