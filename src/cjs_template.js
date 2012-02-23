/*jslint evil: true regexp: true*/
/*global console: true, document:true */
(function(cjs) {
	var _ = cjs._;

	var simple_handlebar_regex = /^{{([-A-Za-z0-9_$]+)}}/;

	var to_fn_str = function(node) {
		var rv = "elem = _.last(stack);";

		var type = node.type;
		if(type === "root") {
			rv = String(rv);
		} else if(type === "handlebar") {
			if(node.block) {
				console.log(node);
			} else {
				rv = rv
					+ "__n__ = document.createTextNode('');"
					+ "elem.appendChild(__n__);"
					+ "cjs.text(__n__, " + node.tag + ");";
			}
		} else if(type === "html_tag") {
			rv = rv
				+ "__n__ = document.createElement('" + node.tag + "');"
				+ "if(elem){elem.appendChild(__n__);}"
				+ "stack.push(__n__);";
			var match;
			_.forEach(node.attrs, function(attr) {
				var name = attr.name;
				var value = attr.value;

				match = value.match(simple_handlebar_regex);

				if(match) {
					rv += "cjs.attr(__n__, '"+name+"',"+match[1]+");";
				} else {
					rv += "__n__.setAttribute('"+name+"', '"+value+"');";
				}
			});
		} else {
			console.log(type);
		}

		if(_.has(node, "children")) {
			rv = rv + _.map(node.children, function(child) {
				return to_fn_str(child);
			}).join("\n");
		}

		if(type === "handlebar") {
			if(node.block) {
			}
		} else if(type === "html_tag") {
			rv = rv
				+ "rv = stack.pop();";
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

		console.log(tree_root);

		var fn = new Function("obj",
			"var _ = cjs._, __n__, stack, elem, rv;"
			+ ((tree_root.children.length === 1 && tree_root.children[0].type === "html_tag") ? "stack = [];" : "__n__ = document.createElement('span'); stack = [__n__];")
			+ "with(obj) {\n"
			+ to_fn_str(tree_root)
			+ "}\n"
			+ ((tree_root.children.length === 1 && tree_root.children[0].type === "html_tag") ? "" : "rv = stack.pop();")
			+ "return rv;"
		);

		return _.isUndefined(data) ? fn : fn(data);
	};

	cjs.define("template", templ);
}(cjs));
