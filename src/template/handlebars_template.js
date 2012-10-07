(function (cjs) {
	var _ = cjs._;
	var default_container = "span";

	var parsed_var_fn_val = function(node) {
		var type = node.type;
		if(type === "prop") {
			var subtype = node.subtype;
			var parent = node.parent;
			var child = node.child;
			var parent_text = parsed_var_fn_val(parent);
			var child_text = parsed_var_fn_val(child);
			if(subtype === "square_brackets") {
				if(child.type === "constant" && child.subtype === "string") {
					child_text = '"' + child_text + '"';
				}

				return parent_text + ".item(" + child_text + ")";
			} else if(subtype === "dot") {
				return parent_text + ".item('" + child_text + "')";
			} else {
				console.log("Unknown type " + type + "/" + subtype);
			}
		} else if(type === "constant") {
			return node.value;
		} else if(type === "var") {
			return node.var_name;
		} else {
			console.log("Unknown type " + type);
		}
		return "'todo'";
	};

	var helpers = {};

	var to_fn_str= function(node) {
		var rv = ""
			, type = _.isString(node) ? "string" : node.type;
		if(type === "root") {
			if(node.children.length === 1 && node.children[0].type === "html") {
				rv = "return " + to_fn_str(node.children[0]) + ";";
			} else {
				rv = "return cjs.dom('element', '" + default_container + "', {} // (root)\n";
				_.forEach(node.children, function(child) {
					var fn_str = to_fn_str(child);
					if(fn_str) {
						rv += ", " + fn_str;
					}
				});
				rv += "\n); // (/root)";
			}
		} else if(type === "string") {
			var text = node.split("\n").join("\\n");
			rv = "cjs.dom('text', '"+text+"') // (text /)\n";
		} else if(type === "html") {
			var subtype = node.subtype;
			if(subtype === "tag") {
				var tag = node.value.tag_name;
				rv = "cjs.dom('element', '" + tag + "',";
				if(_.size(node.attrs) === 0) {
					rv += " {} // <" + tag + ">\n";
				} else {
					rv += " { // <" + tag + ">\n";
					_.forEach(node.attrs, function(attr, index) {
						var name = attr.name;
						var value = attr.value;
						rv += "\n";
						if(index>0) {
							rv += ", ";
						}
						rv += "'" + name + "': ";

						rv += "cjs.concat(";
						rv += _.map(value, function(v) {
							if(_.isString(v)) {
								return "'" + v + "'";
							} else {
								var parsed_var_name = v.value.parsed_var_name;
								var node_code = parsed_var_fn_val(parsed_var_name);
								return node_code;
							}
						}).join(", ");
						rv += ")";
					});
					rv += "} \n";
				}

				_.forEach(node.children, function(child) {
					rv += "\n, " + to_fn_str(child);
				});
				rv += "\n) // </" + tag + ">\n";
			} else {
				console.log("Unhandled type html/" + subtype);
			}
		} else if(type === "mustache") {
			var subtype = node.subtype;
			if(subtype === "variable") {
				var parsed_var_name = node.value.parsed_var_name;
				var node_code = parsed_var_fn_val(parsed_var_name);

				rv = "cjs.dom('text', " + node_code + ") // {{" + node.value.var_name + "}}\n";
			} else if(subtype === "section") {
				var tag = node.value.tag;
				if(_.has(helpers, tag)) {
					rv = helpers[tag](node);
				} else {
					console.log("No helper registered for section " + tag);
				}
			} else {
				console.log("Unhandled type mustache/" + subtype);
			}
		} else {
			console.log("Unhandled type " + type);
		}
		return rv;

	};

	var parser = cjs.__parsers.handlebars;
	var ir_builder = cjs.__ir_builders.handlebars;
	var build_handlebars_template = function(str, data) {
		var parse_tree = parser(str)
			, ir = ir_builder(parse_tree);
		var fn_string = "with (obj) {\n"
							+ to_fn_str(ir)
							+ "\n}";
		console.log(ir);

		var fn;
		try {
			fn = new Function("obj", fn_string);
		} catch(e) {
			console.log(fn_string);
			throw e;
		}

		return _.isUndefined(data) ? fn : fn(data);
	};
	build_handlebars_template.register_helper = function(name, helper) {
		helpers[name] = helper;
	};
	cjs.__template_builders.handlebars = build_handlebars_template;

	build_handlebars_template.register_helper("if", function(node) {
		var parent = node.parent;
		var child_index = -1;
		var conditions = [node];
		var hit_if = false;
		for(var i = 0; i<parent.children.length; i++) {
			var child = parent.children[i];
			if(child === node) {
				hit_if = true;
			} else if(hit_if) {
				if(child.type === "mustache" && child.subtype === "section") {
					if(child.value.tag === "elif") {
						conditions.push(child);
					} else if(child.value.tag === "else") {
						conditions.push(child);
						break;
					} else {
						break;
					}
				} else {
					break;
				}
			}
		}

		var rv = "\ncjs.conditional_$(// {{#if}}\n";
		_.forEach(conditions, function(condition, index) {
			var parsed_attributes = condition.value.parsed_attributes;
			var condition_code = parsed_var_fn_val(parsed_attributes);

			var type = condition.value.tag;

			if(index > 0) { //if
				rv += ", ";
			}

			rv += "{ ";

			if(type !== "else") {
				rv += "condition: " + condition_code;
				rv += " // {{#" + type + " " + condition.value.attributes + "}}\n, ";
			}
			rv += "value: [";
			_.forEach(condition.children, function(c, i) {
				if(i>0) {
					rv += ", ";
				}
				rv += to_fn_str(c);
			});

			rv += "]} // {{/" + type + " " + condition.value.attributes + "}}\n";
		});
		rv += "\n) // {{/if}}\n";
		return rv;
	});
	build_handlebars_template.register_helper("elif", function(node) {
		return "";
	});
	build_handlebars_template.register_helper("else", function(node) {
		return "";
	});
	build_handlebars_template.register_helper("each", function(node) {
		var parsed_attributes = node.value.parsed_attributes;
		var collection_name, val_name, key_name;
		var attrs;
		if(parsed_attributes.type === "compound") {
			attrs = parsed_attributes.statements;
		} else {
			attrs = [parsed_attributes];
		}

		var rv;
		if(_.size(attrs) >= 1) {
			var collection_name_code = parsed_var_fn_val(attrs[0]);

			var val_name_code = (_.size(attrs) >= 2) ? attrs[1].text : "value";
			var key_name_code = (_.size(attrs) >= 3) ? attrs[2].text : "key";

			rv = collection_name_code + ".map(function(" + val_name_code + ", " + key_name_code + ") { // {{#each " + attrs[0].text + "}}\n";
			rv += "return [ // {{#each}}\n";
			_.forEach(node.children, function(child, index) {
				if(index > 0) {
					rv += ", ";
				}
				rv += to_fn_str(child);
			});
			rv += "];";
			rv += "}) // {{/each}}\n";
		}
		return rv;
	});

	build_handlebars_template.register_helper("diagram", function(node) {
		var diagram_name = parsed_var_fn_val(node.value.parsed_attributes);
		rv = "\ncjs.fsm_$(" + diagram_name + ", { // {{#diagram " + diagram_name + "}}\n\n";
		var index=0;
		_.forEach(node.children, function(child) {
			if(child.type === "mustache" && child.subtype === "section" && child.value.tag === "state") {
				var state_name = parsed_var_fn_val(child.value.parsed_attributes);
				if(index > 0) {
					rv += ", ";
				}
				rv += "'" + state_name + "': [\n";

				_.forEach(child.children, function(c, i) {
					if(i>0) {
						rv += ", ";
					}
					rv += to_fn_str(c);
				});

				rv += "]";
				index++;
			}
		});
		rv += "}) // {/diagram}\n";
		return rv;
	});
})(cjs);
