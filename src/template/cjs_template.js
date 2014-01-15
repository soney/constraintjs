var child_is_dynamic_html		= function(child)	{ return child.type === "unary_hb" && child.literal; },
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
	get_instance_node = function(c) { return c.node || c.getNodes(); },
	get_node_value = function(node, context, lineage, curr_bindings) {
		var op, object, call_context, args, val, name, i;
		if(!node) { return; }
		switch(node.type) {
			case THIS_EXP: return cjs.get(last(lineage).this_exp);
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
					name = node.name.slice(1);
					for(i = lineage.length-1; i>=0; i--) {
						object = lineage[i].at;
						if(object && has(object, name)) {
							val = object[name];
							break;
						}
					}
				} else {
					val = context[node.name];
				}

				return is_constraint(val) ? val.get() : val;
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
	get_escaped_html = function(c) {
		if(c.nodeType === 3) {
			return escapeHTML(c.textContent);
		} else {
			return escapeHTML(c.outerHTML);
		}
	},
	get_concatenated_inner_html_constraint = function(children, context, lineage, curr_bindings) {
		var args = arguments;
		return cjs(function() {
			return map(children, function(child) {
				if(child.type === "unary_hb") {
					if(child.literal) {
						return get_node_value(child.val, context, lineage);
					} else {
						return escapeHTML(get_node_value(child.val, context, lineage));
					}
				} else {
					var child_val = get_instance_node(child);

					if(isArray(child_val)) {
						return map(child_val, get_escaped_html).join("");
					} else {
						return get_escaped_html(child_val);
					}
				}
			}).join("");
		});
	},
	get_concatenated_children_constraint = function(children, args) {
		return cjs(function() {
					var rv = [];
					each(children, function(child) {
						var c_plural = get_instance_node(child);
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
		var root = {
			children: [],
			type: "root"
		}, stack = [root],
		last_pop = false, has_container = false, fsm_stack = [], condition_stack = [];

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
					type: "chars",
					str: str
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
					var push_onto_children = true;

					last_pop = {
						type: "hb",
						tag: tag,
						children: []
					};
					switch(tag) {
						case "each":
							last_pop.parsed_content = rest_body(parsed_content);
							last_pop.else_child = false;
							break;
						case "unless":
						case "if":
							last_pop.reverse = tag === "unless";
							last_pop.sub_conditions = [];
							last_pop.condition = rest_body(parsed_content);
							condition_stack.push(last_pop);
							break;
						case "elif":
						case "else":
							push_onto_children = false;
							var last_stack = last(stack);
							if(last_stack.type === "hb" && last_stack.tag === "each") {
								last_stack.else_child = last_pop;
							} else {
								last(condition_stack).sub_conditions.push(last_pop);
							}
							last_pop.condition = tag === "else" ? ELSE_COND : rest_body(parsed_content);
							break;
						case "each":
						case "fsm":
							last_pop.fsm_target = rest_body(parsed_content);
							last_pop.sub_states = {};
							fsm_stack.push(last_pop);
							break;
						case "state":
							var state_name = parsed_content.body[1].name;
							last(fsm_stack).sub_states[state_name] = last_pop;
							push_onto_children = false;
							break;
						case "with":
							last_pop.content = rest_body(parsed_content);
							break;
					}
					if(push_onto_children) {
						last(stack).children.push(last_pop);
					}
					stack.push(last_pop);
				}
			},
			endHB: function(tag) {
				switch(tag) {
					case "if":
					case "unless":
						condition_stack.pop();
						break;
					case "fsm":
						fsm_stack.pop();
				}
				stack.pop();
			},
			partialHB: function(tagName, parsed_content) {
				last_pop = {
					type: "partial_hb",
					tag: tagName,
					content: rest_body(parsed_content)
				};

				last(stack).children.push(last_pop);
			}
		});
		return root;
	},
	call_each = function(arr, prop_name) {
		each(arr, function(x) {
			if(has(x, prop_name)) {
				x[prop_name]();
			}
		});
	},
	create_template_instance = function(template, context, lineage, parent_dom_node) {
		var type = template.type,
			instance_children,
			element;

		if(type === "chars") {
			return {type: type, node: doc.createTextNode(template.str) };
		} else if(type === "root" || type === "html") {
			var args = arguments,
				on_regex_match;
			instance_children = map(template.children, function(child) {
				return create_template_instance(child, context, lineage);
			});

			if(type === "root") {
				if(parent_dom_node) {
					element = parent_dom_node;
				} else if(instance_children.length === 1 && template.children[0].type === "html") {
					return instance_children[0];
				} else {
					element = doc.createElement("span");
				}
			} else {
				element = doc.createElement(template.tag);
			}

			var bindings = [];

			each(template.attributes, function(attr) {
				if(attr.name.match(name_regex)) {
					context[attr.value] = getInputValueConstraint(element);
				} else if((on_regex_match = attr.name.match(on_regex))) {
					var event_name = on_regex_match[2];
					element.addEventListener(event_name, context[attr.value]);
				} else {
					var constraint = get_constraint(attr.value, context, lineage);
					if(is_constraint(constraint)) {
						bindings.push(attr_binding(element, attr.name, constraint));
					} else {
						element.setAttribute(attr.name, constraint);
					}
				}
			});

			if(any_child_is_dynamic_html(template.children)) { // this is where it starts to suck...every child's innerHTML has to be taken and concatenated
				var concatenated_html = get_concatenated_inner_html_constraint(instance_children, context, lineage);
				bindings.push(concatenated_html, html_binding(element, concatenated_html));
			} else {
				var children_constraint = get_concatenated_children_constraint(instance_children, args);
				bindings.push(children_constraint, children_binding(element, children_constraint));
			}

			return {
				node: element,
				type: type,
				pause: function() {
					call_each(instance_children.concat(bindings), "pause");
				},
				resume: function() {
					call_each(instance_children.concat(bindings), "resume");
				},
				destroy: function() {
					call_each(instance_children.concat(bindings), "destroy");
				}
			};
		} else if(type === "unary_hb") {
			var textNode, parsed_elem = first_body(template.parsed_content),
				literal = template.literal,
				val_constraint = cjs(function() {
					return get_node_value(parsed_elem, context, lineage);
				}),
				node, txt_binding;
			if(!literal) {
				node = doc.createTextNode("");
				txt_binding = text_binding(node, val_constraint);
			}
			return {
				type: type,
				literal: template.literal,
				val: parsed_elem,
				node: node,
				destroy: function() { if(txt_binding) txt_binding.destroy(true); },
				pause: function() { if(txt_binding) txt_binding.pause(); },
				resume: function() { if(txt_binding) txt_binding.resume(); }
			};
		} else if (type === "hb") {
			var tag = template.tag;
			if(tag === "each") {
				var old_arr_val = [], arr_val, lastLineages = [], child_vals = [];
				return {
					type: type,
					getNodes: function() {
						arr_val = get_node_value(template.parsed_content, context, lineage);

						if(is_array(arr_val)) { // array constraint
							arr_val = arr_val.toArray();
						}

						if(!isArray(arr_val)) { 
							if(is_map(arr_val)) { // map constraint
								arr_val = arr_val.entries();
								each(arr_val, function(x) {
									x.is_obj = IS_OBJ;
								});
							} else {
								// IS_OBJ provides a way to ensure the user didn't happen to pass in a similarly formatted array
								arr_val = map(arr_val, function(v, k) { return { key: k, value: v, is_obj: IS_OBJ }; });
							}
						} else if(arr_val.length === 0 && template.else_child) {
							arr_val = [ELSE_COND];
						}

						var diff = get_array_diff(old_arr_val, arr_val, map_aware_array_eq),
							rv = [];
						each(diff.index_changed, function(ic_info) {
							var lastLineageItem = lastLineages[ic_info.from];
							if(lastLineageItem && lastLineageItem.at && lastLineageItem.at.index) {
								lastLineageItem.at.index.set(ic_info.to);
							}
						});
						each(diff.removed, function(removed_info) {
							var index = removed_info.from,
								lastLineageItem = lastLineages[index];
							child_vals.splice(index, 1);
							if(lastLineageItem && lastLineageItem.at) {
								each(lastLineageItem.at, function(v) {
									v.destroy(true);
								});
							}
						});
						each(diff.added, function(added_info) {
							var v = added_info.item,
								index = added_info.to,
								is_else = v === ELSE_COND,
								lastLineageItem = is_else ? false : ((v && v.is_obj === IS_OBJ) ? {this_exp: v.value , at: {key: cjs.constraint(v.key)}} : {this_exp: v, at: {index: cjs.constraint(index)}}),
								concated_lineage = is_else ? lineage : lineage.concat(lastLineageItem),
								vals = map(is_else ? template.else_child.children : template.children, function(child) {
									var dom_child = create_template_instance(child, context, concated_lineage);
									return get_instance_node(dom_child);
								});

							child_vals.splice(index, 0, vals);
							lastLineages.splice(index, 0, lastLineageItem);
						}, this);
						each(diff.moved, function(moved_info) {
							var from_index = moved_info.from_index,
								to_index = moved_info.to_index,
								dom_elem = mdom[from_index],
								lastLineageItem = lastLineages[from_index];

							child_vals.splice(from_index, 1);
							child_vals.splice(to_index, 0, dom_elem);
							lastLineages.splice(from_index, 1);
							lastLineages.splice(to_index, 0, lastLineageItem);
						});
						old_arr_val = arr_val;
						return flatten(child_vals, true);
					}
				};
			} else if(tag === "if" || tag === "unless") {
				instance_children = [];
				return {
					type: type,
					getNodes: function() {
						var len = template.sub_conditions.length,
							cond = !!get_node_value(template.condition, context, lineage),
							i, children = false, memo_index;

						if(template.reverse) {
							cond = !cond;
						}

						if(cond) {
							i = 0; children = template.children;
						} else if(len > 0) {
							for(i = 0; i<len; i++) {
								cond = template.sub_conditions[i];

								if(cond.condition === ELSE_COND || get_node_value(cond.condition, context, lineage)) {
									children = cond.children;
									i++;
									break;
								}
							}
						}

						if(!children) {
							return [];
						} else {
							if(!instance_children[i]) {
								children = i===0 ? template.children : template.sub_conditions[i-1].children;
								instance_children[i] =  flatten(map(children, function(child) {
									return create_template_instance(child, context, lineage);
								}), true);
							}
							
							return flatten(map(instance_children[i], get_instance_node), true);
						}
					}
				};
			} else if(tag === "fsm") {
				var memoized_children = {};
				return {
					type: type,
					getNodes: function() {
						var fsm = get_node_value(template.fsm_target, context, lineage),
							state = fsm.getState(),
							do_child_create = function(child) {
								return create_template_instance(child, context, lineage);
							}, state_name;

						if(!lineage) {
							lineage = [];
						}

						for(state_name in template.sub_states) {
							if(template.sub_states.hasOwnProperty(state_name)) {
								if(state === state_name) {
									var children;
									if(has(memoized_children, state_name)) {
										children = memoized_children[state_name];
									} else {
										children = memoized_children[state_name] = flatten(map(template.sub_states[state_name].children, do_child_create), true);
									}
									return flatten(map(children, get_instance_node), true);
								}
							}
						}
						return [];
					}
				};
			} else if(tag === "with") {
				var new_context = get_node_value(template.content, context, lineage),
					new_lineage = lineage.concat({this_exp: new_context});

				instance_children = flatten(map(template.children, function(child) {
					return create_template_instance(child, new_context, new_lineage);
				}));
				return {
					node: flatten(map(instance_children, get_instance_node), true)
				};
			}
		} else if (type === "partial_hb") {
			var partial = partials[template.tag],
				concated_context = get_node_value(template.content, context, lineage),
				nodes = partial(concated_context);
			return {
				node: nodes,
				pause: function() { nodes.pause(); },
				destroy: function() { nodes.destroy(); },
				resume: function() { ndoes.resume(); }
			};
		} else if (type === "comment") {
			return {
				node: doc.createComment(template.str)
			};
		}
		return { node: [] };
	},
	partials = {},
	isPolyDOM = function(x) {
		return is_jquery_obj(x) || isNList(x) || isAnyElement(x);
	},
	getFirstDOMChild = function(x) {
		if(is_jquery_obj(x) || isNList(x))	{ return x[0]; }
		else if(isAnyElement(x))			{ return x; }
		else								{ return false; }
	},
	template_instance_nodes = [],
	template_instances = [],
	instance_id = 1,
	memoize_template = function(context, parent_dom_node) {
		var template = this,
			instance = create_template_instance(template, context, [{this_exp: context}], getFirstDOMChild(parent_dom_node)),
			node = instance.node,
			id = (instance.id = instance_id++);

		template_instances[id] = instance;
		template_instance_nodes[id] = node;
		node.setAttribute("data-cjs-template-instance", id);

		return node;
	},
	get_template_instance_index = function(dom_node) {
		var instance_id = dom_node.getAttribute("data-cjs-template-instance");
		if(!instance_id) {
			instance_id = indexOf(template_instance_nodes, dom_node);
		}
		return instance_id;
	},
	get_template_instance = function(dom_node) {
		var nodeIndex = get_template_instance_index(dom_node);
		return nodeIndex >= 0 ? template_instances[nodeIndex] : false;
	};

extend(cjs, {
	/**
	 * Create a new template. If `context` is specified, then this function returns a DOM node with the specified template.
	 * Otherwise, it returns a function that can be called with `context` and `[parent]` to create a new template.
	 *
	 * ConstraintJS templates use a (Handlebars)[http://handlebarsjs.com/]. A template can be created with
	 * `cjs.createTemplate`. The format is described below.
	 * 
	 * ## Basics
	 * ConstraintJS templates take standard HTML and add some features
	 *
	 * ### Constraints
	 * Unary handlebars can contain expressions.
	 *
	 *      <h1>{{title}}</h1>
	 *      <p>{{subtext.toUpperCase()+"!"}}</p>
	 *
	 * called with `{ title: cjs('hello'), subtext: 'world'}`:
	 *
	 *     <h1>hello</h1>
	 *     <p>WORLD!</p>
	 *
	 * ### Literals
	 * If the tags in a node should be treated as HTML, use triple braces: `{{{ literal_val }}}`.
	 *
	 *      <h1>{{title}}</h1>
	 *      <p>{{{subtext}}}</p>
	 *
	 * called with `{ title: cjs('hello'), subtext: '<strong>steel</strong city'}`:
	 *
	 *     <h1>hello</h1>
	 *     <p><strong>steel</strong> city</p>
	 *
	 *
	 * ## Comments
	 *
	 *     {{! comments will be ignored in the output}}
	 *
	 * ## Constraint output
	 *
	 * To call `my_func` on event `(event-name)`, give any targets the attribute:
	 *
	 *     data-cjs-on-(event-name)=my_func
	 * 
	 * For example:
	 *
	 *     <div data-cjs-on-click=update_obj />
	 * 
	 * Will call `update_obj` (a property of the template's context when this div is clicked.
	 *
	 * To add the value of an input element to the template's context, use the property `data-cjs-out`:
	 *
	 *     <input data-cjs-out=user_name />
	 *     <h1>Hello, {{user_name}}</h1>
	 *
	 * ## Block Helpers
	 *
	 * ### Loops
	 *
	 * To create an object for every item in an array or object, you can use the `{{#each}}` block helper.
	 * `{{this}}` refers to the current item and `@key` and `@index` refer to the keys for arrays and objects
	 * respectively.
	 *
	 *     {{#each obj_name}}
	 *         {{@key}}: {{this}}
	 *     {{/each}}
	 *
	 *     {{#each arr_name}}
	 *         {{@index}}: {{this}}
	 *     {{/each}}
	 *
	 * If the length of the array is zero (or the object has no keys) then an `{{#else}}` block can be used: 
	 *     
	 *     {{#each arr_name}}
	 *         {{@index}}: {{this}
	 *         {{#else}}
	 *             <strong>No items!</strong>
	 *     {{/each}}
	 *
	 * ### Conditions
	 * The `{{#if}}` block helper can vary the content of a template depending on some condition.
	 * This block helper can have any number of sub-conditions with the related `{{#elif}}` and `{{#else}}` tags.
	 *
	 *     {{#if cond1}}
	 *         Cond content
	 *     {{#elif other_cond}}
	 *         other_cond content
	 *     {{#else}}
	 *         else content
	 *     {{/if}}
	 *
	 * The opposite of an `{{#if}}` block is `{{#unless}}`:
	 *     {{#unless logged_in}}
	 *         Not logged in!
	 *     {{/unless}
	 *
	 * ### State
	 *
	 * The `{{#fsm}}` block helper can vary the content of a template depending on an FSM state
	 *
	 *     {{#fsm my_fsm}}
	 *         {{#state1}}
	 *             State1 content
	 *         {{#state2}}
	 *             State2 content
	 *         {{#state3}}
	 *             State3 content
	 *     {{/fsm}}
	 *
	 * ### With helper
	 *
	 * The `{{#with}}` block helper changes the context in which constraints are evaluated.
	 *
	 *     {{#with obj}}
	 *         Value: {{x}}
	 *     {{/with}}
	 *
	 * when called with `{ obj: {x: 1} }` results in `Value: 1`
	 *
	 * ## Partials
	 *
	 * Partials allow templates to be nested.
	 *
	 *     var my_temp = cjs.createTemplate(...);
	 *     cjs.registerPartial('my_template', my_temp);
	 * Then, in any other template,
	 *
	 *     {{>my_template context}}
	 * 
	 * Nests a copy of `my_template` in `context`
	 *
	 * @method cjs.createTemplate
	 * @param {string|dom} template - the template as either a string or a `script` tag whose contents are the template
	 * @param {object} [context] - Any number of target objects to listen to
	 * @param {dom} [parent] - The parent DOM node for the template
	 * @return {function|dom} - An event that can be attached to 
	 *
	 * @see cjs.destroyTemplate
	 * @see cjs.pauseTemplate
	 * @see cjs.resumeTemplate
	 *
	 * @example
	 *
	 *     <script id='my_template' type='cjs/template'>
	 *         {{x}}
	 *     </script>
	 *     var template_elem = document.getElementById('my_template');
	 *     var template = cjs.createTemplate(template_elem);
	 *     var element1 = template({x: 1});
	 *     var element2 = template({x: 2});
	 *
	 * @example
	 *
	 *     var element = cjs.createTemplate("{{x}}", {x: 1});
	 */
	createTemplate:		function(template_str) {
							if(!isString(template_str)) {
								if(is_jquery_obj(template_str) || isNList(template_str)) {
									template_str = template_str.length > 0 ? trim(template_str[0].textContent) : "";
								} else if(isElement(template_str)) {
									template_str = trim(template_str.textContent);
								} else {
									template_str = "" + template_str;
								}
							}

							var template = create_template(template_str);

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
							var index = get_template_instance_index(getFirstDOMChild(dom_node)),
								instance = index >= 0 ? template_instances[index] : false;

							if(instance) {
								instance.destroy();
								delete template_instances[index];
							}
							return this;
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
							var instance = get_template_instance(dom_node);
							if(instance) { instance.pause(); }
							return this;
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
							var instance = get_template_instance(dom_node);
							if(instance) { instance.resume(); }
							return this;
						}
});
