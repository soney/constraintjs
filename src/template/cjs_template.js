/**
 * ConstraintJS templates use a (Handlebas)[http://handlebarsjs.com/]. A template can be created with
 * `cjs.createTemplate`. The format is described below.
 * 
 * ## Basics
 *
 * ### Constraints
 * {{value}}
 *
 *
 * ### Literals
 * {{{literal}}}
 *
 *
 * ## Comments
 * {{! comment }}
 *
 * ## Constraint output
 * data-cjs-out
 * data-cjs-on
 *
 * ## Block Helpers
 *
 * ### Loops
 * {{#each}}
 * {{this}}
 * {{@key}}
 * {{@index}}
 * {{this}}
 * {{#else}}
 *
 * ### Conditions
 * {{#if}}
 * {{#elif}}
 * {{#else}}
 *
 * {{#unless}}
 *
 * ### State
 *
 * {{#state}}
 * {{#fsm}}
 *
 * ### With helper
 *
 * {{#with}}
 * {{this}}
 *
 * ## Partials
 *
 * {{>partial}}
 *
 *
 */

var child_is_dynamic_html		= function(child)	{ return child.isDynamicHTML; },
	child_is_text				= function(child)	{ return child.isText; },
	every_child_is_text			= function(arr)		{ return every(arr, child_is_text); },
	any_child_is_dynamic_html	= function(arr)		{ return indexWhere(arr, child_is_dynamic_html) >= 0; },
	escapeHTML = function (unsafe) {
		return unsafe	.replace(/&/g, "&amp;")	.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;")	.replace(/"/g, "&quot;")
						.replace(/'/g, "&#039;");
	},
	compute_object_property = function(object, prop_node, context, lineage, curr_bindings) {
		return object ? object[prop_node.computed ? get_node_value(prop_node, context, lineage, curr_bindings) : prop_node.name] :
						undefined;
	},
	ELSE_COND = {},
	first_body = function(node) {
		return node.type === COMPOUND ? node.body[0] : node;
	},
	rest_body = function(node) {
		return {type: COMPOUND,
				body: node.type === COMPOUND ? rest(node.body) : [] };
	},
	get_node_value = function(node, context, lineage, curr_bindings) {
		var op, object, call_context, args;
		if(!node) { return; }
		switch(node.type) {
			case THIS_EXP: return last(lineage).this_exp;
			case LITERAL: return node.value;
			case UNARY_EXP:
				op = unary_operators[node.operator];
				return op ? op(get_node_value(node.argument, context, lineage, curr_bindings)) :
							undefined;
			case BINARY_EXP:
			case LOGICAL_EXP:
				op = binary_operators[node.operator];
				return op ? op(get_node_value(node.left, context, lineage, curr_bindings), get_node_value(node.right, context, lineage, curr_bindings)) :
							undefined;
			case IDENTIFIER:
				if(node.name[0] === "@") {
					var name = node.name.slice(1);
					for(var i = lineage.length-1; i>=0; i--) {
						object = lineage[i].at;
						if(object && has(object, name)) {
							return object[name];
						}
					}
					return undefined;
				}
				return cjs.get(context[node.name]);
			case MEMBER_EXP:
				object = get_node_value(node.object, context, lineage, curr_bindings);
				return compute_object_property(object, node.property, context, lineage, curr_bindings);
			case COMPOUND:
				return get_node_value(node.body[0], context, lineage, curr_bindings);
			case CURR_LEVEL_EXP:
				object = last(lineage).this_exp;
				return compute_object_property(object, node.argument, context, lineage, curr_bindings);
			case PARENT_EXP:
				object = (lineage && lineage.length > 1) ? lineage[lineage.length - 2].this_exp : undefined;
				return compute_object_property(object, node.argument, context, lineage, curr_bindings);
			case CALL_EXP:
				if(node.callee.type === MEMBER_EXP) {
					call_context = get_node_value(node.callee.object, context, lineage, curr_bindings);
					object = compute_object_property(call_context, node.callee.property, context, lineage, curr_bindings);
				} else {
					call_context = root;
					object = get_node_value(node.callee, context, lineage, curr_bindings);
				}

				if(object && isFunction(object)) {
					args = map(node['arguments'], function(arg) {
						return get_node_value(arg, context, lineage, curr_bindings);
					});
					return object.apply(call_context, args);
				}
		}
	},
	create_node_constraint = function(node, context, lineage, curr_bindings) {
		var args = arguments;
		if(node.type === LITERAL) {
			return get_node_value.apply(root, args);
		}
		return cjs(function() {
			return get_node_value.apply(root, args);
		});
	},
	get_concatenated_inner_html_constraint = function(children, context, lineage, curr_bindings) {
		return cjs(function() {
			return map(children, function(child) {
				if(child.isDynamicHTML) {
					return cjs.get(context[child.tag]);
				} else if(has(child, "text")) {
					return escapeHTML(child.text);
				} else if(has(child, "tag")) {
					return escapeHTML(cjs.get(context[child.tag]));
				} else {
					var child_val = child.create(context, lineage, curr_bindings);
					return child_val.outerHTML;
				}
			}).join("");
		});
	},
	get_concatenated_children_constraint = function(children, args) {
		return cjs(function() {
					var rv = [];
					each(children, function(child) {
						var c_plural = child.create.apply(child, args);
						if(isArray(c_plural)) {
							rv.push.apply(rv, c_plural);
						} else {
							rv.push(c_plural);
						}
					});
					return rv;
				});
	},
	hb_regex = /^\{\{([\-A-Za-z0-9_]+)\}\}/,
	get_constraint = function(str, context, lineage, curr_bindings) {
		var has_constraint = false,
			strs = [],
			index, match_val, len, context_val;
		while(str.length > 0) {
			index =  str.indexOf("{");
			if(index < 0) {
				strs.push(str);
				break;
			} else {
				match_val = str.match(hb_regex);
				if(match_val) {
					len = match_val[0].length;
					context_val = context[match_val[1]];
					str = str.substr(len);
					strs.push(context_val);

					if(!has_constraint && (is_constraint(context_val) || is_array(context_val))) {
						has_constraint = true;
					}
				} else {
					strs.push(str.substr(0, index));
					str = str.substr(index);
				}
			}
		}

		if(has_constraint) {
			return cjs(function() {
				return map(strs, function(str) {
					if(is_constraint(str)) {
						return str.get();
					} else if(is_array(str)) {
						return str.join(" ");
					} else {
						return "" + str;
					}
				}).join("");
			});
		} else {
			return strs.join("");
		}
	},
	array_this_eq = function(a, b) {
		return a.length === b.length && every(a, function(ai, i) { return ai.this_esp === b[i].this_esp; });
	},
	IS_OBJ = {},
	map_aware_array_eq = function(a, b) {
		return a === b || (a && a.is_obj === IS_OBJ && a.key === b.key && a.value === b.value);
	},
	name_regex = /^(data-)?cjs-out$/,
	on_regex = /^(data-)?cjs-on-(\w+)$/,
	create_template = function(template_str) {
		var stack = [{
			children: []
		}], last_pop = false, has_container = false, condition_stack = [], fsm_stack = [];

		parseTemplate(template_str, {
			startHTML: function(tag, attributes, unary) {
				last_pop = {
					type: "html",
					tag: tag,
					attributes: attributes,
					unary: unary,
					children: []
				};

				last(stack).children.push(last_pop);

				if(!unary) {
					stack.push(last_pop);
				}
			},
			endHTML: function(tag) {
				last_pop = stack.pop();
			},
			HTMLcomment: function(str) {
				last_pop = {
					type: "comment",
					str: str
				};
				last(stack).children.push(last_pop);
			},
			chars: function(str) {
				last_pop = {
					create: function() {
						return doc.createTextNode(str);
					},
					isText: true,
					text: str
				};
				last(stack).children.push(last_pop);
			},
			startHB: function(tag, parsed_content, unary, literal) {
				if(unary) {
					last_pop = {
						type: "unary_hb",
						parsed_content: parsed_content,
						literal: literal,
						tag: tag
					};

					last(stack).children.push(last_pop);
				} else {
					last_pop = {
						type: "hb",
						tag: tag,
						children: []
					};
					switch(tag) {
						case "each":
							last_pop.else_child = false;
							break;
						case "if":
						case "unless":
							last_pop.sub_conditions = [];
							last_pop.condition = rest_body(parsed_content);
							break;
						case "elif":
						case "each":
						case "fsm":
							last_pop.sub_states = {};
							fsm_stack.push(last_pop);
							break;
						case "state":
							var state_name = parsed_content.body[1].name;
							last(fsm_stack).sub_states[state_name] = last_pop;
							push_onto_children = false;
							break;
						case "with":

					};
					if(push_onto_children) {
						last(stack).children.push(last_pop);
					}
					stack.push(last_pop);
				}
			},
			endHB: function(tag) {
				switch(tag) {
					case "if":
					case "unless";
						condition_stack.pop();
						break;
					case "fsm":
						fsm_stack.pop();

				};
				stack.pop();
			},
			partialHB: function(tagName, parsed_content) {
				var partial = partials[tagName];
				if(partial) {
					last_pop = {
						type: "partial_hb",
						partial: partial
					};

					last(stack).children.push(last_pop);
				}
			}
		});
		return stack.pop();
	},
	memoized_template_nodes = [],
	memoized_template_bindings = [],
	template_strs = [],
	template_values = [],
	partials = {},
	isPolyDOM = function(x) {
		return is_jquery_obj(x) || isNList(x) || isAnyElement(x);
	},
	getFirstDOMChild = function(x) {
		if(is_jquery_obj(x) || isNList(x))	{ return x[0]; }
		else if(isAnyElement(x))			{ return x; }
		else								{ return false; }
	},
	memoize_template = function(context, parent_dom_node) {
		var template = this,
			curr_bindings = [],
			dom_node = template.create(context, parent_dom_node, curr_bindings);
		memoized_template_nodes.push(dom_node);
		memoized_template_bindings.push(curr_bindings);
		return dom_node;
	},
	get_template_bindings = function(dom_node) {
		var nodeIndex = indexOf(memoized_template_nodes, dom_node);
		return nodeIndex >= 0 ? memoized_template_bindings[nodeIndex] : false;
	};

extend(cjs, {
	/**
	 * Create a new template. If `context` is specified, then this function returns a DOM node with the specified template.
	 * Otherwise, it returns a function that can be called with `context` and `[parent]` to create a new template.
	 *
	 * @method cjs.createTemplate
	 * @param {string|dom} template - the template as either a string or a `script` tag whose contents are the template
	 * @param {object} [context] - Any number of target objects to lisen to
	 * @param {dom} [parent] - The parent DOM node for the template
	 * @return {function|dom} - An event that can be attached to 
	 *
	 * @see cjs.destroyTemplate
	 * @see cjs.pauseTemplate
	 * @see cjs.resumeTemplate
	 *
	 * @example
	 * <script id='my_template' type='cjs/template'>
	 *		{{x}}
	 * </script>
	 * var template_elem = document.getElementById('my_template');
	 * var template = cjs.createTemplate(template_elem);
	 * var element1 = template({x: 1});
	 * var element2 = template({x: 2});
	 *
	 * @example
	 * var element = cjs.createTemplate("{{x}}", {x: 1});
	 */
	createTemplate:		function(template_str) {
							if(!isString(template_str)) {
								if(is_jquery_obj(template_str) || isNList(template_str)) {
									template_str = template_str.length > 0 ? template_str[0].textContent.trim() : "";
								} else if(isElement(template_str)) {
									template_str = template_str.textContent.trim();
								} else {
									template_str = "" + template_str;
								}
							}

							var template, template_index = indexOf(template_strs, template_str);
							if(template_index < 0) {
								template = create_template(template_str);
								template_strs.push(template_str);
								template_values.push(template);
							} else {
								template = template_values[template_index];
							}

							if(arguments.length >= 2) { // Create and use the template immediately
								return memoize_template.apply(template, rest(arguments));
							} else { // create the template as a function that can be called with a context
								return bind(memoize_template, template);
							}
						},
	/**
	 * Register a partial that can be used in other templates
	 *
	 * @method cjs.registerPartial
	 * @param {string} name - The name that this partial can be referred to as
	 * @param {Template} value - The template
	 * @return {cjs} - `cjs`
	 * @see cjs.unregisterPartial
	 */
	registerPartial:	function(name, value) { partials[name] = value; return this;},

	/**
	 * Unregister a partial for other templates
	 *
	 * @method cjs.unregisterPartial
	 * @param {string} name - The name of the partial
	 * @return {cjs} - `cjs`
	 * @see cjs.registerPartial
	 */
	unregisterPartial:	function(name) { delete partials[name]; return this;},

	/**
	 * Destroy a template instance
	 *
	 * @method cjs.destroyTemplate
	 * @param {dom} node - The dom node created by `createTemplate`
	 * @return {boolean} - Whether the template was successfully removed
	 * @see cjs.createTemplate
	 * @see cjs.pauseTemplate
	 * @see cjs.resumeTemplate
	 */
	destroyTemplate:	function(dom_node) {
							var nodeIndex = indexOf(memoized_template_nodes, dom_node);
							if(nodeIndex >= 0) {
								var bindings = memoized_template_bindings[nodeIndex];
								memoized_template_nodes.splice(nodeIndex, 1);
								memoized_template_bindings.splice(nodeIndex, 1);
								each(bindings, function(binding) { binding.destroy(); });
								return true;
							}
							return false;
						},

	/**
	 * Pause dynamic updates to a template
	 *
	 * @method cjs.pauseTemplate
	 * @param {dom} node - The dom node created by `createTemplate`
	 * @return {boolean} - Whether the template was successfully paused
	 * @see cjs.resumeTemplate
	 * @see cjs.createTemplate
	 * @see cjs.destroyTemplate
	 */
	pauseTemplate:		function(dom_node) {
							var bindings = get_template_bindings(dom_node);
							each(bindings, function(binding) { if(has(binding, "pause")) { binding.pause(); } });
							return !!bindings;
						},

	/**
	 * Resume dynamic updates to a template
	 *
	 * @method cjs.resumeTemplate
	 * @param {dom} node - The dom node created by `createTemplate`
	 * @return {boolean} - Whether the template was successfully resumed
	 * @see cjs.pauseTemplate
	 * @see cjs.createTemplate
	 * @see cjs.destroyTemplate
	 */
	resumeTemplate:		function(dom_node) {
							var bindings = get_template_bindings(dom_node);
							each(get_template_bindings(dom_node), function(binding) { if(has(binding, "resume")) { binding.resume(); } });
							return !!bindings;
						}
});
