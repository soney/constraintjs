/*global document:true */
(function(cjs) {if(!cjs._is_node) {

cjs.constraint.raw_mixin("css", function(elems, propname) {
		if(arguments.length === 2) {
			return cjs.map(elems, function(elem) {
				return cjs.create("css_constraint", elem, propname);
			});
		} else {
			var binding = cjs.binding.css.apply(cjs.binding, arguments);
			elems.push_binding(binding);
			return elems;
		}
	});

cjs.constraint.raw_mixin("attr", function(elems, propname) {
		if(arguments.length === 2) {
			return cjs.map(elems, function(elem) {
				return cjs.create("attr_constraint", elem, propname);
			});
		} else {
			var binding = cjs.binding.attr.apply(cjs.binding, arguments);
			elems.push_binding(binding);
			return elems;
		}
	});

cjs.constraint.raw_mixin("text", function(elems) {
		if(arguments.length === 1) {
			return cjs.map(elems, function(elem) {
				return cjs.create("text_constraint", elem);
			});
		} else {
			var binding = cjs.binding.text.apply(cjs.binding, arguments);
			elems.push_binding(binding);
			return elems;
		}
	});

cjs.constraint.raw_mixin("html", function(elems) {
		if(arguments.length === 1) {
			return cjs.map(elems, function(elem) {
				return cjs.create("html_constraint", elem);
			});
		} else {
			var binding = cjs.binding.html.apply(cjs.binding, arguments);
			elems.push_binding(binding);
			return elems;
		}
	});

cjs.constraint.raw_mixin("val", function(elems) {
		if(arguments.length === 1) {
			return cjs.map(elems, function(elem) {
				return cjs.create("input_value_constraint", elem);
			});
		} else {
			var binding = cjs.binding.val.apply(cjs.binding, arguments);
			elems.push_binding(binding);
			return elems;
		}
	});

cjs.constraint.raw_mixin("children", function(elems) {
		if(arguments.length === 1) {
			return cjs.map(elems, function(elem) {
				return cjs.create("children_constraint", elem);
			});
		} else {
			var binding = cjs.binding.children.apply(cjs.binding, arguments);
			elems.push_binding(binding);
			return elems;
		}
	});

}}(cjs));
