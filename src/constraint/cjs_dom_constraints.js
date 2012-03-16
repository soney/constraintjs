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

cjs.define("selector_constraint", function(selector, context) {
	var _oldval = [];
	var constraint;

	var nullify_fn = function() {
		constraint.nullify();
	};

	var activate = function() {
		document.addEventListener("DOMSubtreeModified", nullify_fn);
	};
	var deactivate = function() {
		document.removeEventListener("DOMSubtreeModified", nullify_fn);
		_.forEach(_oldval, function(elem) {
			elem.removeEventListener("DOMAttrModified", nullify_fn);
		});
	};

	constraint = cjs.create("constraint", function() {
		var rv = cjs.Sizzle.call(cjs.Sizzle, cjs.get(selector), cjs.get(context, true));

		_.forEach(_oldval, function(elem) {
			elem.removeEventListener("DOMAttrModified", nullify_fn);
		});
		_.forEach(rv, function(elem) {
			elem.addEventListener("DOMAttrModified", nullify_fn);
		});

		_oldval = rv;
		return rv;
	});

	constraint.on_destroy(deactivate);
	activate();

	return constraint;
});

cjs.define("children_constraint", function(elem) {
	var constraint;

	var nullify_fn = function() {
		constraint.nullify();
	};

	var activate = function() {
		elem.addEventListener("DOMSubtreeModified", nullify_fn);
	};
	var deactivate = function() {
		elem.removeEventListener("DOMSubtreeModified", nullify_fn);
	};

	constraint = cjs.create("constraint", function() {
		return elem.childNodes;
	});

	constraint.on_destroy(deactivate);
	activate();

	return constraint;
});

cjs.define("text_constraint", function(elem) {
	var constraint;

	var nullify_fn = function() {
		constraint.nullify();
	};

	var activate = function() {
		elem.addEventListener("DOMSubtreeModified", nullify_fn);
	};
	var deactivate = function() {
		elem.removeEventListener("DOMSubtreeModified", nullify_fn);
	};

	constraint = cjs.create("constraint", function() {
		return elem.innerText;
	});

	constraint.on_destroy(deactivate);
	activate();

	return constraint;
});

cjs.define("html_constraint", function(elem) {
	var constraint;

	var nullify_fn = function() {
		constraint.nullify();
	};

	var activate = function() {
		elem.addEventListener("DOMSubtreeModified", nullify_fn);
	};
	var deactivate = function() {
		elem.removeEventListener("DOMSubtreeModified", nullify_fn);
	};

	constraint = cjs.create("constraint", function() {
		return elem.innerHTML;
	});

	constraint.on_destroy(deactivate);
	activate();

	return constraint;
});

cjs.define("css_constraint", function(elem, propname) {
	var constraint;

	var nullify_fn = function() {
		constraint.nullify();
	};

	var activate = function() {
		elem.addEventListener("DOMSubtreeModified", nullify_fn);
	};
	var deactivate = function() {
		elem.removeEventListener("DOMSubtreeModified", nullify_fn);
	};

	constraint = cjs.create("constraint", function() {
		return elem.innerHTML;
	});

	constraint.on_destroy(deactivate);
	activate();

	return constraint;
});

}}(cjs));
