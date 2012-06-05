(function(cjs){
	var _ = cjs._;

	var to_fn_string = function(node) {
		var rv = ""
			, type = node.type;
		if(type === "root") {
			console.log(node.children);
		}
		return rv;

	/*
	var rv
			, type = node.type;

		if(type === "root") {
			if(node.children.length === 1 && node.children[0].type === "html_tag") {
				rv = "return " + to_fn_str(node.children[0]) + ";";
			} else {
				rv = "return cjs.create('dom_element', 'span', {} // (root)\n";
				_.forEach(node.children, function(child) {
					rv += ", " + to_fn_str(child);
				});
				rv += "\n); // (/root)";
			}
		} else if(type === "text") {
			var text = node.text.split("\n").join("\\n");
			rv = "cjs.create('dom_text', '"+text+"') // (text /)\n";
		} else if(type === "comment") {
			var comment = node.text.split("\n").join("\\n");
			rv = "cjs.create('dom_comment', '"+comment+"') // (comment /)\n";
		} else if(type === "html_tag") {
			rv = "cjs.create('dom_element', '" + node.tag + "',";
			if(_.size(node.attrs) === 0) {
				rv += " {} // <" + node.tag + ">\n";
			} else {
				rv += " { // <"+node.tag+">\n";
				_.forEach(node.attrs, function(attr, index) {
					var name = attr.name;
					var value = attr.value;
					rv += "\n";
					if(index>0) {
						rv += ", ";
					}
					rv += "'" + name + "': '" + value + "'";
				});
				rv += "} \n";
			}

			_.forEach(node.children, function(child) {
				rv += "\n, " + to_fn_str(child);
			});
			rv += "\n) // </" + node.tag + ">\n";
		} else if(type === "handlebar") {
			if(node.block) {
				var tag = node.tag;
				if(tag === "each") {
					if(_.size(node.attrs)>=1) {
						var collection_name = node.attrs[0].name;
						var val_name = (_.size(node.attrs) >= 2) ? node.attrs[1].name : "value";
						var key_name = (_.size(node.attrs) >= 3) ? node.attrs[2].name : "key";
						rv = collection_name + ".map(function(" + val_name + ", " + key_name + ") { // {{#each " + collection_name + "}}\n";
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
				} else if(tag === "diagram") {
					var diagram_name = node.attrs[0].name;
					rv = "\ncjs.create('fsm_constraint', " + diagram_name + ", { // {{#diagram " + diagram_name + "}}\n\n";
					var index=0;
					_.forEach(node.children, function(child) {
						if(child.type === "handlebar" && child.tag === "state") {
							var state_name = child.attrs[0].name;
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
				} else if(tag === "with") {
					if(_.size(node.attrs) >= 1) {
						var with_obj = node.attrs[0].name;
						var parsed_with_obj = parse_val(with_obj);

						rv = "(function() {";
						rv += "with(" + parsed_with_obj + ") { // {{#with " + with_obj + "}}\n";
						if(_.size(node.attrs) >= 2) {
							rv += "var " + node.attrs[1].name + " = " + parsed_with_obj+";\n";
						}
						rv += "return [";
						_.forEach(node.children, function(c, i) {
							if(i>0) {
								rv += ", ";
							}
							rv += to_fn_str(c);
						});
						rv += "];";
						rv += "}}()) // {{/with}}\n";
					}
				} else if(tag === "if") {
					var conditions = [node.attrs[0].name];
					var condition_children = [[]];

					_.forEach(node.children, function(child) {
						if(child.type === "handlebar" && child.tag === "elif") {
							conditions.push(child.attrs[0].name);
							condition_children.push([]);
						} else if(child.type === "handlebar" && child.tag === "else") {
							conditions.push("else");
							condition_children.push([]);
						} else {
							_.last(condition_children).push(child);
						}
					});

					rv = "\ncjs.create('conditional_constraint', { // {{#if}}";
					_.forEach(conditions, function(condition, index) {
						var children = condition_children[index];
						if(index>0) {
							rv += ", ";
						}
						rv += "\n\n{ ";
						if(condition === "else") {
							rv += " // {{else}}\n, ";
						} else {
							rv += "condition: " + condition;
							rv += " // {{elif " + condition + "}}\n, ";
						}
						rv += "value: [_.bind(function(stack) {";

						_.forEach(children, function(c, i) {
							if(i>0) {
								rv += ", ";
							}
							rv += to_fn_str(c);
						});

						rv += "\n]";
						rv += "\n} // {{/condition}}";
					});
					rv += "\n}); // {{/if}}\n";
				} else if(tag === "unless") {
					rv += "void(0);";
				}
			} else {
				rv = "cjs.create('dom_text', " + node.tag + ") // {{" + node.tag + " /}}\n";
			}
		}

		return rv;
		*/
	};

	var parser = cjs.__parsers.handlebars;
	var ir_builder = cjs.__ir_builders.handlebars;
	var build_handlebars_template = function(str, data) {
		var parse_tree = parser(str)
			, ir = ir_builder(parse_tree)
			, fn_string = "with (obj) {\n"
							+ to_fn_string(ir)
							+ "\n}";

		var fn;
		try {
			fn = new Function("obj", fn_string);
		} catch(e) {
			console.log(fn_string);
			throw e;
		}

		return _.isUndefined(data) ? fn : fn(data);
	};
	cjs.__template_builders.handlebars = build_handlebars_template;
})(cjs);
