(function(cjs){
var _ = cjs._;

var IRNode = function(type_str, text_content) {
	var types = type_str.split("/");
	this.type = types[0];
	this.subtype = types[1] || null;

	this.text = text_content;
	this.value = null;
	this.children = [];
	this.parent = null;
};

(function(my) {
	var proto = my.prototype;
	proto.push_child = function(child) {
		this.children.push(child);
		if(child instanceof my) {
			child.set_parent(this);
		}
	};
	proto.insert_child_at = function(child, index) {
		_.insert_at(this.children, child, index);
		
		if(child instanceof my) {
			child.set_parent(this);
		}
	};
	proto.set_children = function(children) {
		this.children = children;
		var self = this;
		_.forEach(this.children, function(child) {
			if(child instanceof my) {
				child.set_parent(self);
			}
		});
	};
	proto.child_index = function(child) {
		return _.index_of(this.children, child);
	};
	proto.set_value = function(value) {
		this.value = value;
	};
	proto.set_parent = function(parent) {
		this.parent = parent;
	};
	proto.remove_child = function(child) {
		_.remove(this.children, child);
		if(child.parent === this) {
			child.set_parent(null);
		}
		return child;
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

var is_tag = function(ir_root, tag_name) {
	return ir_root.type === "mustache" && ir_root.subtype === "section" && ir_root.value && ir_root.value.tag === tag_name;
};
var extract_elses = function(ir_root) {
	if(is_tag(ir_root, "if")) {
		var i, len;

		var children_to_elevate = [];
		for(i = 0, len=ir_root.children.length; i<len; i++) {
			var child = ir_root.children[i];
			if(is_tag(child, "if")) {
				break;
			} else if(is_tag(child, "elif") || is_tag(child, "else")) { // encountered before another if
				children_to_elevate.push(child);
			}
		}
		var if_parent = ir_root.parent;
		var curr_index = if_parent.child_index(ir_root) + 1;
		_.forEach(children_to_elevate, function(child) {
			ir_root.remove_child(child);
			if_parent.insert_child_at(child, curr_index);
			curr_index+=1;
		});
	}

	_.forEach(ir_root.children, function(child) {
		extract_elses(child);
	});
};

var integrate_expressions = function(ir_root) {
};


cjs.__ir_builders.handlebars = function (parse_tree, options) {
	var root = new IRNode("root", parse_tree.content);
	build_ir(parse_tree.tokens, root);
	extract_elses(root);
	integrate_expressions(root);
	return root;
};


})(cjs);
