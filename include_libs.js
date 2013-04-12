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
var src = cp(path, "src");

exports.main_src = c(
	cp(src, [
		"cjs.js"
		/*
		, "template/underscore.js"
		, "template/cjs_dom.js"
		, "template/cjs_template.js"
		, "template/parsers/esprima.js"
		, "template/parsers/html_parser.js"
		, "template/parsers/handlebars_parser.js"
		, "template/ir_builders/handlebars_ir.js"
		, "template/handlebars_template.js"
		*/
	])
);
