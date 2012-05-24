(function(cjs){
var _ = cjs._;

var IRNode = function(type_str, text_content) {
	var types = type_str.split("/");
	this.type = types[0];
	this.subtype = types[1] || null;

	this.text = text_content;
	this.value = null;
	this.children = [];
};

(function(my) {
	var proto = my.prototype;
	proto.push_child = function(child) {
		this.children.push(child);
	};
	proto.set_children = function(children) {
		this.children = children;
	};
	proto.set_value = function(value) {
		this.value = value;
	};
}(IRNode));

var build_ir = function(parse_tree_root, ir_root) {
	var type = parse_tree_root[0];
	var args = _.rest(parse_tree_root);
	if(type === "multi") {
		var children = _.map(args, function(arg) {
			return build_ir(arg, ir_root);
		});
		ir_root.set_children(children);
		return parse_tree_root;
	} else if(type === "static") {
		return args[0];
	} else if(type === "mustache") {
		var subtype = args[0];
		args = _.rest(args);
		if(subtype === "etag" || subtype === "utag") {
			var rv = new IRNode("mustache/variable", args[1]);
			rv.set_value({
				var_name: args[0]
				, escaped: subtype === "etag"
			});
			return rv;
		} else if(subtype === "section" || subtype === "inverted_section") {
			var tag = args[0]
				, tag_content = args[1]
				, text_content = args[2]
				, sub_trees = args[3];

			var rv = new IRNode("mustache/"+subtype, text_content);
			var attribute_start_index = tag_content.indexOf(" ");
			var attributes = tag_content.substring(attribute_start_index+1);
			rv.set_value({
				tag: tag
				, attributes: attributes
			});

			build_ir(sub_trees, rv);

			return rv;
		} else if(subtype === "partial") {
			var tag = args[0];
			var tag_content = args[1];
			var rv = new IRNode("mustache/partial", tag_content);
			rv.set_value(tag);
			return rv;
		} else {
			console.log("Unknown mustache type", subtype);
		}
	} else {
		console.log("Unknown type", type);
	}
};

var extract_elses = function(ir_root) {
	if(ir_root.type === "mustache" && ir_root.subtype === "section") {
		console.log(ir_root);
	} else {
		_.forEach(ir_root.children, function(child) {
			extract_elses(child);
		});
	}
};

var do_extract_elses = function(parent_node, if_node) {
};

cjs.__ir_builders.handlebars = function (parse_tree, options) {
	var root = new IRNode("root", parse_tree.content);
	build_ir(parse_tree.tokens, root);
	extract_elses(root);
	return root;
};


})(cjs);
