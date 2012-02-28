/*jslint evil: true regexp: true*/
/*global console: true, document:true */
(function(cjs) {
	var _ = cjs._;

	var simple_handlebar_regex = /^\{\{([\-A-Za-z0-9_$]+)\}\}/;


	var convert_dots = function(val_str) {
		var rv = "";
		var i;

		for(i = 0; i<val_str.length; i++) {
			var c = val_str[i];
			if(c === ".") {
				rv += "['";
				var curr_var = "";
				i++;
				while(i<val_str.length) {
					c = val_str[i];
					if(c === "[" || c === "]" || c==="." || c==="(" || c===")") {
						i--;
						break;
					} else {
						curr_var += c;
					}
					i++;
				}
				rv += curr_var;
				rv += "']";
			} else {
				rv += c;
			}
		}

		return rv;
	};


	var parse_val = function(val_str) {
		val_str = convert_dots(val_str);

		var rv = val_str;
		var first_open_bracket = val_str.indexOf("[");
		var last_close_bracket = val_str.indexOf("]");

		if(first_open_bracket >= 0) {
			rv = "cjs.item(" + val_str.substring(0, first_open_bracket) + ", " + parse_val(val_str.substring(first_open_bracket+1, last_close_bracket)) + ")";
		} else {
			rv = "cjs.get("+val_str+")"
		}
		return rv;
	};

	var to_fn_str = function(node) {
		var rv
			, type = node.type;


		if(type === "root") {
			if(node.children.length === 1 && node.children[0].type === "html_tag") {
				rv = to_fn_str(node.children[0]);
			} else {
				rv = "stack.push(document.createElement('span')); // (root)\n";
				rv += _.map(node.children, function(child) {
					return to_fn_str(child);
				}).join("");
				rv += "rv = stack.pop(); // (/root)\n";
			}
		} else if(type === "text") {
			rv = "rv = _.last(stack).appendChild(document.createTextNode('" + node.text + "')); // (text)\n";
		} else if(type === "comment") {
			rv = "rv = _.last(stack).appendChild(document.createComment('" + node.text + "')); // (comment)\n";
		} else if(type === "html_tag") {
			rv = "__n__ = document.createElement('" + node.tag + "'); // (" + node.tag + " tag)\n";
			rv += "stack.push(__n__);\n\n";
			var match;
			_.forEach(node.attrs, function(attr) {
				var name = attr.name;
				var value = attr.value;

				match = value.match(simple_handlebar_regex);

				if(match) {
					rv += "cjs.attr(__n__, '"+name+"',"+match[1]+");\n";
				} else {
					rv += "__n__.setAttribute('"+name+"', '"+value+"');\n";
				}
			});
			rv += _.map(node.children, function(child) {
				return to_fn_str(child);
			}).join("");
			rv += "\nrv = stack.pop(); // (/"+ node.tag +" tag)\n";
		} else if(type === "handlebar") {
			if(node.block) {
				var tag = node.tag;
				if(tag === "each") {
					if(_.size(node.attrs)>=1) {
						var collection_name = node.attrs[0].name;
						var val_name = (_.size(node.attrs) >= 2) ? node.attrs[1].name : "value";
						var key_name = (_.size(node.attrs) >= 3) ? node.attrs[2].name : "key";
						var index_name = (_.size(node.attrs) >= 4) ? node.attrs[3].name : "index";
						rv = "\n__n__ = "+collection_name;
						rv += ".map(_.bind(function(stack, " + val_name + ", " + key_name + ", " + index_name + ") { // {{#each " + collection_name + "}}\n"
							+ "var __n__,rv; // {{#each " + collection_name + "}}\n";

						rv += _.map(node.children, function(child) {
							return to_fn_str(child);
						}).join("");

						rv += "\n"
							+ "return rv;\n"
							+ "}, this, [_.last(stack)])); // {{/each}}\n";
						rv += "cjs.children(_.last(stack), __n__); // {{/each}}\n\n";
					}
				} else if(tag === "diagram") {
					var diagram_name = node.attrs[0].name;
					rv = "\n__n__ = cjs.create('fsm_constraint', "+diagram_name+", { // {{#diagram " + diagram_name + "}}\n\n";
					_.forEach(node.children, function(child, index) {
						if(child.type === "handlebar" && child.tag === "state") {
							var state_name = child.attrs[0].name;
							rv += (index > 0 ? ", " : "") + "'"+state_name+"': _.bind(function(stack) { // {{#state " + state_name + "}}\n"
								+ "var __n__,rv;\n";

							rv += _.map(child.children, function(c) {
								return to_fn_str(c);
							}).join("");

							rv += "return rv; // {{/state}}\n"
								+ "}, this, [_.last(stack)]) // {{/state}}\n\n";
						}
					});
					rv += "\n}); // {{/diagram}}\n";
					rv += "cjs.children(_.last(stack), __n__); // {{/diagram}}\n\n";
				} else if(tag === "with") {
					if(_.size(node.attrs) >= 1) {
						var with_obj = node.attrs[0].name;
						var parsed_with_obj = parse_val(with_obj);

						rv = "\nwith("+parsed_with_obj+") { // {{#with " + with_obj + "}}\n";
						if(_.size(node.attrs) >= 2) {
							rv += "var " + node.attrs[1].name + " = " + parsed_with_obj+";\n";
						}
						rv += _.map(node.children, function(c) {
							return to_fn_str(c);
						}).join("");
						rv += "\n} // {{/with}}";
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

					rv = "\n__n__ = cjs.create('conditional_constraint', { // {{#if}}";
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
						rv += "value: _.bind(function(stack) {";
						rv += "\nvar __n__,rv;";

						rv += _.map(children, function(child) {
							return to_fn_str(child);
						}).join("");

						rv += "\nreturn rv;";
						rv += "\n}, this, [_.last(stack)])";
						rv += "\n} // {{/condition}}";
					});
					rv += "\n}); // {{/if}}\n";
					rv += "cjs.children(_.last(stack), __n__); // {{/if}}\n\n";
				} else if(tag === "unless") {
					rv += "void(0);";
				}
			} else {
				rv = "\n__n__ = document.createTextNode(''); // {{"+node.tag+"}}\n";
				rv += "rv = _.last(stack).appendChild(__n__); // {{"+node.tag+"}}\n";
				rv += "cjs.text(__n__, " + node.tag + "); // {{"+node.tag+"}}\n\n";
			}
		}

		return rv;
	};

	var templ = function(str, data) {
		var tree_root = {type: "root", children: []};
		var curr_node = tree_root;
		_.html_parser(str, {
				start: function(tag, attrs, unary) {
					var node = {
						type: "html_tag"
						, tag: tag
						, attrs: attrs
						, unary: unary
						, children: []
						, parent: curr_node
					};
					curr_node.children.push(node);
					curr_node = node;
				}

				, end: function() {
					curr_node = curr_node.parent;
				}

				, chars: function(text) {
					var node = {
						type: "text"
						, text: text
						, parent: curr_node
					};
					curr_node.children.push(node);
				}

				, comment: function(text) {
					var node = {
						type: "comment"
						, text: text
						, parent: curr_node
					};
					curr_node.children.push(node);
				}

				, startHandlebars: function(tag, attrs, block) {
					var node = {
						type: "handlebar"
						, tag: tag
						, attrs: attrs
						, block: block
						, parent: curr_node
					};
					curr_node.children.push(node);

					if(block) {
						node.children = [];
						curr_node = node;
					}
				}

				, endHandlebars: function() {
					curr_node = curr_node.parent;
				}
			});

		var fn_string = "var _ = cjs._, stack=[], __n__, rv;\n"
						+ "with(obj) {\n//=================================\n\n"
						+ to_fn_str(tree_root)
						+ "\n//=================================\n}\n"
						+ "return rv;";

		var fn;
		try {
			fn = new Function("obj", fn_string);
			console.log(fn);
		} catch(e) {
			console.error(e);
			console.log(fn_string);
		}

		return _.isUndefined(data) ? fn : fn(data);
	};

	cjs.define("template", templ);
}(cjs));
