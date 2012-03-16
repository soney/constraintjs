/*global document:true */
(function(cjs) {if(!cjs._is_node) {
var _ = cjs._;
cjs.constraint.raw_mixin("css", function(elems, propname, propval) {
		if(arguments.length === 2) {
			return cjs.map(elems, function(elem) {
				return cjs.create("css_constraint", elem, propname);
			});
		} else {
			var binding = cjs.binding.css(elems, propname, propval);
			return elems;
		}
	});

cjs.constraint.raw_mixin("attr", function(elems, propname, propval) {
		if(arguments.length === 2) {
			return cjs.map(elems, function(elem) {
				return cjs.create("attr_constraint", elem, propname);
			});
		} else {
			var binding = cjs.binding.attr(elems, propname, propval);
			return elems;
		}
	});

cjs.constraint.raw_mixin("text", function(elems, val) {
		if(arguments.length === 1) {
			return cjs.map(elems, function(elem) {
				return cjs.create("text_constraint", elems);
			});
		} else {
			var binding = cjs.binding.text(elems, val);
			return elems;
		}
	});

cjs.constraint.raw_mixin("html", function(elems, val) {
		if(arguments.length === 1) {
			return cjs.map(elems, function(elem) {
				return cjs.create("html_constraint", elems);
			});
		} else {
			var binding = cjs.binding.html(elems, propname, propval);
			return elems;
		}
	});

cjs.constraint.raw_mixin("val", function(elems, val) {
		if(arguments.length === 1) {
			return cjs.map(elems, function(elem) {
				return cjs.create("input_value_constraint", elem, propname);
			});
		} else {
			var binding = cjs.binding.val(elems, propname, propval);
			return elems;
		}
	});

cjs.constraint.raw_mixin("children", function(elems, val) {
		if(arguments.length === 1) {
			return cjs.map(elems, function(elem) {
				return cjs.create("children_constraint", elem, propname);
			});
		} else {
			var binding = cjs.binding.children(elems, propname, propval);
			return elems;
		}
	});

}}(cjs));
