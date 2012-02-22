var cp = concat_prefix = function(prefix, strs) {
	var do_it = function(str) {
		if(prefix == "") {
			return str;
		} else {
			return prefix+"/"+str;
		}
	};

	if(typeof strs === "string") {
		return do_it(strs);
	} else {
		return strs.map(do_it);
	}
};
var c = concat = function() {
	var rv = [];
	return rv.concat.apply(rv, arguments);
};

var path = "";
var build_path = cp(path, "build");
var src = cp(path, "src");
var vendor_src = cp(src, "vendor");

exports.main_build = cp(build_path, ["cjs.min.js"]);

exports.main_src = c(
	cp(src, ["cjs_core.js"
			, "vendor/underscore_cjs.js"
			, "util/cjs_underscore_extensions.js"
			, "util/graph.js"
			, "util/constraint_solver.js"
			, "cjs_fsm.js"
			, "constraints/cjs_simple_constraint.js"
			, "constraints/cjs_conditional_constraint.js"
			, "constraints/cjs_fsm_constraint.js"
			, "constraints/cjs_async_constraint.js"
			, "constraints/cjs_constraint.js"
			, "constraints/cjs_constraint_fn.js"
			, "cjs_events.js"
			, "cjs_dom_widgets.js"
			, "util/templateparser.js"
			, "cjs_template.js"
			])
);

var core_tests_dir = cp(path, "test/core/unit_tests");
exports.core_tests = cp(core_tests_dir, [	"util_tests.js"
											, "primitive_type_tests.js"
											]);

var ends_with = function(str1, str2) {
	return str1.slice(str1.length-str2.length) == str2;
};
exports.include_templates = function(strs) {
	var do_it = function(str) {
		if(ends_with(str, ".js")) {
			return "<script type = 'text/javascript' src = '"+str+"'></script>";
		} else if(ends_with(str, ".css")) {
			return "<link rel = 'stylesheet' href = '"+str+"' media='screen' />";
		}
	};
	if(typeof strs === "string") {
		return do_it(strs);
	} else {
		return strs.map(do_it).join("");
	}
};
