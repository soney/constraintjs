var child_is_dynamic_html		= function(child)	{ return child.type === UNARY_HB_TYPE && child.literal; },
	child_is_text				= function(child)	{ return child.isText; },
	every_child_is_text			= function(arr)		{ return every(arr, child_is_text); },
	any_child_is_dynamic_html	= function(arr)		{ return any(arr, child_is_dynamic_html); },
	PARTIAL_HB_TYPE = "partial_hb",
	UNARY_HB_TYPE = "unary_hb",
	CHARS_TYPE = "chars",
	ROOT_TYPE = "root",
	COMMENT_TYPE = "comment",

	TEMPLATE_INSTANCE_PROP = "data-cjs-template-instance",

	outerHTML = function (node){
		// if IE, Chrome take the internal method otherwise build one
		return node.outerHTML || (
			function(n){
				var div = document.createElement('div'), h;
				div.appendChild( n.cloneNode(true) );
				h = div.innerHTML;
				div = null;
				return h;
			})(node);
	},
	escapeHTML = function (unsafe) {
		return unsafe	.replace(/&/g, "&amp;").replace(/</g, "&lt;")
						.replace(/>/g, "&gt;") .replace(/"/g, "&quot;")
						.replace(/'/g, "&#039;");
	},
	compute_object_property = function(object, prop_node, context, lineage) {
		return object ? object[prop_node.computed ? get_node_value(prop_node, context, lineage) : prop_node.name] :
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
	get_instance_nodes = function(c) { return c.node || c.getNodes(); },
	get_node_value = function(node, context, lineage) {
		var op, object, call_context, args, val, name, i;
		if(!node) { return; }
		switch(node.type) {
			case THIS_EXP: return cjs.get(last(lineage).this_exp);
			case LITERAL: return node.value;
			case UNARY_EXP:
				op = unary_operators[node.operator];
				return op ? op(get_node_value(node.argument, context, lineage)) :
							undefined;
			case BINARY_EXP:
			case LOGICAL_EXP:
				op = binary_operators[node.operator];
				return op ? op(get_node_value(node.left, context, lineage), get_node_value(node.right, context, lineage)) :
							undefined;
			case IDENTIFIER:
				if(node.name.charAt(0) === "@") {
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
				object = get_node_value(node.object, context, lineage);
				return compute_object_property(object, node.property, context, lineage);
			case COMPOUND:
				return get_node_value(node.body[0], context, lineage);
			case CURR_LEVEL_EXP:
				object = last(lineage).this_exp;
				return compute_object_property(object, node.argument, context, lineage);
			case PARENT_EXP:
				object = (lineage && lineage.length > 1) ? lineage[lineage.length - 2].this_exp : undefined;
				return compute_object_property(object, node.argument, context, lineage);
			case CONDITIONAL_EXP:
				return get_node_value(node.test, context, lineage) ? get_node_value(node.consequent, context, lineage) :
																get_node_value(node.alternate, context, lineage);
			case CALL_EXP:
				if(node.callee.type === MEMBER_EXP) {
					call_context = get_node_value(node.callee.object, context, lineage);
					object = compute_object_property(call_context, node.callee.property, context, lineage);
				} else {
					call_context = root;
					object = get_node_value(node.callee, context, lineage);
				}

				if(object && isFunction(object)) {
					args = map(node['arguments'], function(arg) {
						return get_node_value(arg, context, lineage);
					});
					return object.apply(call_context, args);
				}
		}
	},
	get_escaped_html = function(c) {
		if(c.nodeType === 3) {
			return escapeHTML(getTextContent(c));
		} else {
			return escapeHTML(outerHTML(c));
		}
	},
	get_concatenated_inner_html_constraint = function(children, context, lineage) {
		var args = arguments;
		return cjs(function() {
			return map(children, function(child) {
				if(child.type === UNARY_HB_TYPE) {
					if(child.literal) {
						return get_node_value(child.val, context, lineage);
					} else {
						return escapeHTML(get_node_value(child.val, context, lineage)+"");
					}
				} else {
					var child_val = get_instance_nodes(child);

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
						var c_plural = get_instance_nodes(child);
						if(isArray(c_plural)) {
							rv.push.apply(rv, c_plural);
						} else {
							rv.push(c_plural);
						}
					});
					return rv;
				});
	},
	hb_regex = /^\{\{([^\}]+)\}\}/,
	get_constraint = function(str, context, lineage) {
		var has_constraint = false,
			has_str = false,
			strs = [],
			index, match_val, len = 0, substr,
			last_val_is_str = false;

		while(str.length > 0) {
			index =  str.indexOf("{");

			if(index === 0) {
				match_val = str.match(hb_regex);
				if(match_val) {
					strs[len++] = cjs(bindArgs(get_node_value, jsep(match_val[1]), context, lineage));
					str = str.substr(match_val[0].length);

					last_val_is_str = false;
					has_constraint = true;
					continue;
				} else { // !match_val
					index++; // capture this '{' in index
				}
			}

			if(index < 0) {
				index = str.length;
			}

			substr = str.substr(0, index);
			str = str.substr(index);

			if(last_val_is_str) {
				strs[len-1] = strs[len-1] + substr;
			} else {
				strs[len++] = substr;
			}
			has_str = last_val_is_str = true;
		}

		if(has_constraint) {
			return (!has_str && strs.length===1) ? strs[0] :
					cjs(function() {
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
	call_each = function(arr, prop_name) {
		var args = rest(arguments, 2);
		each(arr, function(x) {
			if(has(x, prop_name)) {
				x[prop_name].apply(x, args);
			}
		});
	},
	pause_each    = function(arr) { call_each.apply(this, ([arr, "pause"]).concat(rest(arguments))); },
	resume_each   = function(arr) { call_each.apply(this, ([arr, "resume"]).concat(rest(arguments))); },
	destroy_each  = function(arr) { call_each.apply(this, ([arr, "destroy"]).concat(rest(arguments))); },
	onadd_each    = function(arr) { call_each.apply(this, ([arr, "onAdd"]).concat(rest(arguments))); },
	onremove_each = function(arr) { call_each.apply(this, ([arr, "onRemove"]).concat(rest(arguments))); },

	create_template_instance = function(template, context, lineage, parent_dom_node) {
		var type = template.type,
			instance_children,
			element,
			active_children;

		if(type === CHARS_TYPE) {
			return {type: type, node: doc.createTextNode(template.str) };
		} else if(type === ROOT_TYPE || type === HTML_TYPE) {
			var args = arguments,
				on_regex_match,
				bindings = [], binding;
			instance_children = map(template.children, function(child) {
				return create_template_instance(child, context, lineage);
			});

			if(type === ROOT_TYPE) {
				if(parent_dom_node) {
					element = parent_dom_node;
				} else if(instance_children.length === 1 && template.children[0].type === HTML_TYPE) {
					return instance_children[0];
				} else {
					element = doc.createElement("span");
				}
			} else {
				element = doc.createElement(template.tag);
			}

			each(template.attributes, function(attr) {
				var name = attr.name, value = attr.value;
				if(name.match(name_regex)) {
					bindings.push((context[value] = getInputValueConstraint(element)));
				} else if((on_regex_match = name.match(on_regex))) {
					var event_name = on_regex_match[2];
					aEL(element, event_name, bind(context[value], cjs.get(last(lineage).this_exp)));
				} else {
					var constraint = get_constraint(value, context, lineage);
					if(is_constraint(constraint)) {
						if(attr.name === "class") {
							var class_constraint = cjs(function() {
								var cval = constraint.get();
								return cval.split(" ");
							});
							bindings.push(constraint, class_constraint, class_binding(element, class_constraint));
						} else {
							bindings.push(constraint, attr_binding(element, name, constraint));
						}
					} else {
						element.setAttribute(attr.name, constraint);
					}
				}
			});

			if(any_child_is_dynamic_html(template.children)) { // this is where it starts to suck...every child's innerHTML has to be taken and concatenated
				var concatenated_html = get_concatenated_inner_html_constraint(instance_children, context, lineage);
				binding = html_binding(element, concatenated_html);
				bindings.push(concatenated_html, binding);
			} else {
				var children_constraint = get_concatenated_children_constraint(instance_children, args);
				binding	= children_binding(element, children_constraint);
				bindings.push(children_constraint, binding);
			}

			return {
				node: element,
				type: type,
				onAdd:   function() {
					resume_each(bindings);
					onadd_each(instance_children);
				},
				onRemove:  function() {
					pause_each(bindings);
					onremove_each(instance_children);
				},
				pause: function() {
					pause_each(instance_children.concat(bindings));
				},
				resume: function() {
					resume_each(instance_children.concat(bindings));
				},
				destroy: function() {
					destroy_each(instance_children.concat(bindings));
				}
			};
		} else if(type === UNARY_HB_TYPE) {
			var textNode, parsed_elem = template.obj,
				val_constraint = cjs(function() {
					return get_node_value(parsed_elem, context, lineage);
				}),
				node, txt_binding;
			if(!template.literal) {
				var curr_value = cjs.get(val_constraint);
				if(isPolyDOM(curr_value)) {
					node = getFirstDOMChild(curr_value);
				} else {
					node = doc.createTextNode(""+curr_value);
					txt_binding = text_binding(node, val_constraint);
				}
			}

			return {
				type: type,
				literal: template.literal,
				val: parsed_elem,
				node: node,
				destroy: function() {
					if(txt_binding) {
						txt_binding.destroy(true);
					}
					val_constraint.destroy(true);
				},
				pause: function() { if(txt_binding) txt_binding.pause(); },
				resume: function() { if(txt_binding) txt_binding.resume(); },
				onRemove: function() { this.pause(); },
				onAdd: function() { this.resume(); }
			};
		} else if (type === HB_TYPE) {
			var tag = template.tag;
			if(tag === EACH_TAG) {
				var old_arr_val = [], arr_val, lastLineages = [];
				active_children = [];
				return {
					type: type,
					onRemove: function() { each(active_children, onremove_each); },
					onAdd: function() { each(active_children, onadd_each); },
					pause: function() { each(active_children, pause_each); },
					resume: function() { each(active_children, resume_each); },
					destroy: function() {
						each(active_children, destroy_each);
						active_children = [];
					},
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
								if(is_constraint(arr_val)) {
									arr_val = arr_val.get();
								}
								// IS_OBJ provides a way to ensure the user didn't happen to pass in a similarly formatted array
								arr_val = map(arr_val, function(v, k) { return { key: k, value: v, is_obj: IS_OBJ }; });
							}
						} else if(arr_val.length === 0 && template.else_child) {
							arr_val = [ELSE_COND];
						}

						var diff = get_array_diff(old_arr_val, arr_val, map_aware_array_eq),
							rv = [],
							added_nodes = [], removed_nodes = [];
						old_arr_val = arr_val;
						each(diff.index_changed, function(ic_info) {
							var lastLineageItem = lastLineages[ic_info.from];
							if(lastLineageItem && lastLineageItem.at && lastLineageItem.at.index) {
								lastLineageItem.at.index.set(ic_info.to);
							}
						});
						each(diff.removed, function(removed_info) {
							var index = removed_info.from,
								lastLineageItem = lastLineages[index];

							removed_nodes.push.apply(removed_nodes, active_children[index]);

							removeIndex(active_children, index);
							if(lastLineageItem && lastLineageItem.at) {
								each(lastLineageItem.at, function(v) { v.destroy(true); });
							}
						});
						each(diff.added, function(added_info) {
							var v = added_info.item,
								index = added_info.to,
								is_else = v === ELSE_COND,
								lastLineageItem = is_else ? false : ((v && v.is_obj === IS_OBJ) ? {this_exp: v.value , at: {key: cjs.constraint(v.key)}} :
																									{this_exp: v, at: {index: cjs.constraint(index)}}),
								concated_lineage = is_else ? lineage : lineage.concat(lastLineageItem),
								children = is_else ? template.else_child.children : template.children,
								child_nodes = map(children, function(child) {
									return create_template_instance(child, context, concated_lineage);
								});

							active_children.splice(index, 0, child_nodes);
							lastLineages.splice(index, 0, lastLineageItem);

							added_nodes.push.apply(added_nodes, child_nodes);
						}, this);
						each(diff.moved, function(moved_info) {
							var from_index = moved_info.from_index,
								to_index = moved_info.to_index,
								dom_elem = mdom[from_index],
								child_nodes = active_children[from_index],
								lastLineageItem = lastLineages[from_index];

							removeIndex(active_children, from_index);
							active_children.splice(to_index, 0, child_nodes);

							removeIndex(lastLineages, from_index);
							lastLineages.splice(to_index, 0, lastLineageItem);
						});

						onremove_each(removed_nodes);
						destroy_each(removed_nodes);
						onadd_each(added_nodes);

						var child_vals = map(active_children, function(child_nodes) {
							var instance_nodes = flatten(map(child_nodes, function(child_node) {
								return get_instance_nodes(child_node);
							}), true);
							return instance_nodes;
						});
						return flatten(child_vals, true);
					}
				};
			} else if(tag === IF_TAG || tag === UNLESS_TAG) {
				instance_children = [];
				active_children = [];
				var old_index = -1;
				return {
					type: type,
					onRemove: function() { onremove_each(active_children); },
					onAdd: function() { onadd_each(active_children); },
					pause: function() { pause_each(active_children); },
					resume: function() { resume_each(active_children); },
					destroy: function() {
						if(old_index >= 0) {
							active_children=[];
							old_index=-1;
						}
						each(instance_children, destroy_each);
					},
					getNodes: function() {
						var len = template.sub_conditions.length,
							cond = !!cjs.get(get_node_value(template.condition, context, lineage)),
							i, children = false, memo_index, rv;

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

						if(old_index !== i) { onremove_each(active_children); }

						if(!children) {
							rv = active_children = [];
						} else {
							if(instance_children[i]) {
								active_children = instance_children[i];
							} else {
								children = i===0 ? template.children : template.sub_conditions[i-1].children;
								active_children = instance_children[i] = map(children, function(child) {
									return create_template_instance(child, context, lineage);
								});
							}
							
							rv = flatten(map(active_children, get_instance_nodes), true);
						}

						if(old_index !== i) { onadd_each(active_children); }

						old_index = i;

						return rv;
					}
				};
			} else if(tag === FSM_TAG) {
				var memoized_children = {},
					old_state = false;
				active_children = [];
				return {
					pause: function() { pause_each(active_children); },
					resume: function() { resume_each(active_children); },
					destroy: function() {
						if(old_state) {
							destroy_each(active_children);
							active_children = [];
							old_state = false;
						}
					},
					onRemove: function() { this.pause(); },
					onAdd: function() { this.resume(); },
					type: type,
					getNodes: function() {
						var fsm = get_node_value(template.fsm_target, context, lineage),
							state = fsm.getState(),
							do_child_create = function(child) {
								return create_template_instance(child, context, lineage);
							}, state_name,
							rv = [];

						if(old_state !== state) {
							onremove_each(active_children);
						}

						for(state_name in template.sub_states) {
							if(template.sub_states.hasOwnProperty(state_name)) {
								if(state === state_name) {
									if(!has(memoized_children, state_name)) {
										memoized_children[state_name] = map(template.sub_states[state_name].children, do_child_create);
									}
									active_children = memoized_children[state_name];
									rv = flatten(map(active_children, get_instance_nodes), true);
									break;
								}
							}
						}

						if(old_state !== state) {
							onadd_each(active_children);
						}
						old_state = state;

						return rv;
					}
				};
			} else if(tag === WITH_TAG) {
				var new_context = get_node_value(template.content, context, lineage),
					new_lineage = lineage.concat({this_exp: new_context});

				instance_children = flatten(map(template.children, function(child) {
					return create_template_instance(child, new_context, new_lineage);
				}));
				return {
					pause: function() { pause_each(instance_children); },
					resume: function() { resume_each(instance_children); },
					onRemove: function() { onremove_each(instance_children); },
					onAdd: function() { onadd_each(instance_children); },
					destroy: function() { destroy_each(instance_children); },
					node: flatten(map(instance_children, get_instance_nodes), true)
				};
			}
		} else if (type === PARTIAL_HB_TYPE) {
			var partial, dom_node, instance,
				parsed_content = template.content,
				get_context = function() {
					return parsed_content.type === COMPOUND ?
										map(parsed_content.body, function(x) {
											return get_node_value(x, context, lineage);
										}) : [get_node_value(template.content, context, lineage)];
				},
				is_custom = false;

			if(has(partials, template.tag)) {
				partial = partials[template.tag];
				dom_node = partial.apply(root, get_context());
				instance = get_template_instance(dom_node);
			} else if(has(custom_partials, template.tag)) {
				partial = custom_partials[template.tag];
				instance = partial.apply(root, get_context());
				dom_node = instance.node;
				is_custom = true;
			} else {
				throw new Error("Could not find partial with name '"+template.tag+"'");
			}

			return {
				node: dom_node,
				pause: function() { if(instance) instance.pause(dom_node); },
				destroy: function() {
					if(is_custom) {
						instance.destroy(dom_node);
					} else {
						cjs.destroyTemplate(dom_node);
					}
				},
				onAdd: function() {
					if(instance) {
						instance.onAdd.apply(instance, ([dom_node]).concat(get_context()));
					}
				},
				onRemove: function() { if(instance) instance.onRemove(dom_node); },
				resume: function() { if(instance) instance.resume(dom_node); }
			};
		} else if (type === COMMENT_TYPE) {
			return {
				node: doc.createComment(template.str)
			};
		}
		return {node: [] };
	},
	partials = {},
	custom_partials = {},
	isPolyDOM = function(x) {
		return is_jquery_obj(x) || isNList(x) || isAnyElement(x);
	},
	getFirstDOMChild = function(x) {
		if(is_jquery_obj(x) || isNList(x))	{ return x[0]; }
		else if(isAnyElement(x))			{ return x; }
		else								{ return false; }
	},
	getDOMChildren = function(x) {
		if(is_jquery_obj(x) || isNList(x))	{ return toArray(x); }
		else								{ return x; }
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
		node.setAttribute(TEMPLATE_INSTANCE_PROP, id);

		return node;
	},
	get_template_instance_index = function(dom_node) {
		var instance_id = dom_node.getAttribute(TEMPLATE_INSTANCE_PROP);
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
	 * These literals (triple braces) should be created immediately under a DOM node.
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
									template_str = template_str.length > 0 ? trim(getTextContent(template_str[0])) : "";
								} else if(isElement(template_str)) {
									template_str = trim(getTextContent(template_str));
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
	 * Register a *custom* partial that can be used in other templates
	 *
	 * Options are (only `createNode` is mandatory):
	 *  * `createNode(...)`: A function that returns a new dom node any time this partial is invoked (called with the arguments passed into the partial)
	 *  * `onAdd(dom_node)`: A function that is called when `dom_node` is added to the DOM tree
	 *  * `onRemove(dom_node)`: A function that is called when `dom_node` is removed from the DOM tree
	 *  * `pause(dom_node)`: A function that is called when the template has been paused (usually with `pauseTemplate`)
	 *  * `resume(dom_node)`: A function that is called when the template has been resumed (usually with `resumeTemplate`)
	 *  * `destroyNode(dom_node)`: A function that is called when the template has been destroyed (usually with `destroyTemplate`)
	 *
	 * @method cjs.registerCustomPartial
	 * @param {string} name - The name that this partial can be referred to as
	 * @param {Object} options - The set of options (described in the description)
	 * @return {cjs} - `cjs`
	 * @see cjs.registerPartial
	 * @see cjs.unregisterPartial
	 * @example Registering a custom partial named `my_custom_partial`
	 *
	 *     cjs.registerCustomPartial('my_custom_partial', {
	 *			createNode: function(context) {
	 *				return document.createElement('span');
	 *			},
	 *			destroyNode: function(dom_node) {
	 *				// something like: completely_destroy(dom_node);
	 *			}
	 *			onAdd: function(dom_node) {
	 *				// something like: do_init(dom_node);
	 *			},
	 *			onRemove: function(dom_node) {
	 *				// something like: cleanup(dom_node);
	 *			},
	 *			pause: function(dom_node) {
	 *				// something like: pause_bindings(dom_node);
	 *			},
	 *			resume: function(dom_node) {
	 *				// something like: resume_bindings(dom_node);
	 *			},
	 *     });
	 * Then, in any other template,
	 *
	 *     {{>my_template context}}
	 * 
	 * Nests a copy of `my_template` in `context`
	 */
	registerCustomPartial: function(name, options) {
		custom_partials[name] = function() {
			var node = getFirstDOMChild(options.createNode.apply(this, arguments));
			return {
				node: node,
				onAdd: function() { if(options.onAdd) { options.onAdd.apply(this, arguments); } },
				onRemove: function() { if(options.onRemove) { options.onRemove.apply(this, arguments); } },
				destroy: function() { if(options.destroyNode) { options.destroyNode.apply(this, arguments); } },
				pause: function() { if(options.pause) { options.pause.apply(this, arguments); } },
				resume: function() { if(options.resume) { options.resume.apply(this, arguments); } }
			};
		};
		return this;
	},

	/**
	 * Register a partial that can be used in other templates
	 *
	 * @method cjs.registerPartial
	 * @param {string} name - The name that this partial can be referred to as
	 * @param {Template} value - The template
	 * @return {cjs} - `cjs`
	 * @see cjs.unregisterPartial
	 * @see cjs.registerCustomPartial
	 * @example Registering a partial named `my_temp`
	 *
	 *     var my_temp = cjs.createTemplate(...);
	 *     cjs.registerPartial('my_template', my_temp);
	 * Then, in any other template,
	 *
	 *     {{>my_template context}}
	 * 
	 * Nests a copy of `my_template` in `context`
	 */
	registerPartial:	function(name, value) {
		partials[name] = value;
		return this;
	},

	/**
	 * Unregister a partial for other templates
	 *
	 * @method cjs.unregisterPartial
	 * @param {string} name - The name of the partial
	 * @return {cjs} - `cjs`
	 * @see cjs.registerPartial
	 * @see cjs.registerCustomPartial
	 */
	unregisterPartial:	function(name) {
		delete partials[name];
		delete custom_partials[name];
		return this;
	},

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
								delete template_instances[index];
								instance.destroy();
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
						},

	/**
	 * Parses a string and returns a constraint whose value represents the result of `eval`ing
	 * that string
	 *
	 * @method cjs.createParsedConstraint
	 * @param {string} str - The string to parse
	 * @param {object} context - The context in which to look for variables
	 * @return {cjs.Cosntraint} - Whether the template was successfully resumed
	 * @example Creating a parsed constraint `x`
	 *
	 *     var a = cjs(1);
	 *     var x = cjs.createParsedConstraint("a+b", {a: a, b: cjs(2)})
	 *     x.get(); // 3
	 *     a.set(2);
	 *     x.get(); // 4
	 */
	createParsedConstraint: function(str, context) {
		var node = jsep(str);
		if(node.type === LITERAL) {
			return node.value;
		}

		return cjs(function() {
			return get_node_value(node, context, [context]);
		});
	}
});
