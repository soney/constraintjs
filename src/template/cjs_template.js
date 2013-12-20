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
	default_template_create = function(context, parent_dom_node, curr_bindings) {
		var args = [context, [{this_exp: context}], curr_bindings], // context & lineage
			container = parent_dom_node || doc.createElement("span"),
			first_child;
		if(this.children.length === 1 && (first_child = this.children[0]) && first_child.isHTML) {
			return first_child.create.apply(first_child, args);
		}

		if(any_child_is_dynamic_html(this.children)) { // this is where it starts to suck...every child's innerHTML has to be taken and concatenated
			var concatenated_html = get_concatenated_inner_html_constraint(this.children, context);
			curr_bindings.push(concatenated_html, html_binding(container, concatenated_html));
		} else {
			var children_constraint = get_concatenated_children_constraint(this.children, args);
			curr_bindings.push(children_constraint, children_binding(container, children_constraint));
		}
		return container;
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
	memoize_dom_elems = function() {
		var memoized_vals = [];
		return {
			get: function(lineage) {
				var hash = lineage.length,
					mvals = memoized_vals[hash],
					i = 0,
					len = mvals ? mvals.length : 0,
					mval;
				for(; i<len; i++) {
					mval = mvals[i];
					if(array_this_eq(mval.lineage, lineage)) {
						return mval.value;
					}
				}
			},
			set: function(lineage, value) {
				var hash = lineage.length,
					value_info = {lineage: lineage, value: value};

				if(memoized_vals.hasOwnProperty(hash)) {
					memoized_vals[hash].push(value_info);
				} else {
					memoized_vals[hash] = [value_info];
				}
			}
		};
	},
	IS_OBJ = {},
	map_aware_array_eq = function(a, b) {
		return a === b || (a && a.is_obj === IS_OBJ && a.key === b.key && a.value === b.value);
	},
	name_regex = /^(data-)?cjs-out$/,
	on_regex = /^(data-)?cjs-on-(\w+)$/,
	create_template = function(template_str) {
		var stack = [{
			children: [],
			create: default_template_create
		}], last_pop = false, has_container = false, condition_stack = [], fsm_stack = [];

		parseTemplate(template_str, {
			startHTML: function(tag, attributes, unary) {
				last_pop = {
					create: function(context, lineage, curr_bindings) {
						var args = arguments,
							element = doc.createElement(tag),
							on_regex_match;

						each(attributes, function(attr) {
							if(attr.name.match(name_regex)) {
								context[attr.value] = getInputValueConstraint(element);
							} else if((on_regex_match = attr.name.match(on_regex))) {
								var event_name = on_regex_match[2];
								element.addEventListener(event_name, context[attr.value]);
							} else {
								var constraint = get_constraint(attr.value, context, lineage, curr_bindings);
								if(is_constraint(constraint)) {
									attr_binding(element, attr.name, constraint);
								} else {
									element.setAttribute(attr.name, constraint);
								}
							}
						});

						if(any_child_is_dynamic_html(this.children)) { // this is where it starts to suck...every child's innerHTML has to be taken and concatenated
							var concatenated_html = get_concatenated_inner_html_constraint(this.children, context, lineage, curr_bindings);
							curr_bindings.push(concatenated_html, html_binding(element, concatenated_html));
						} else {
							var children_constraint = get_concatenated_children_constraint(this.children, args);
							curr_bindings.push(children_constraint, children_binding(element, children_constraint));
						}
						return element;
					},
					children: [],
					isHTML: true
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
					create: function() { return doc.createComment(str); }
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
				var memoized_elems, setter_name, type_name, push_onto_children;
				if(unary) {
					if(literal) { type_name = "isDynamicHTML"; setter_name = "html"; }
					else { type_name = "isText"; setter_name = "text"; }
					last_pop = {
						create: function(context, lineage, curr_bindings) {
							var elem = doc.createTextNode(""),
								val = get_node_value(first_body(parsed_content), context, lineage, curr_bindings);
							curr_bindings.push(cjs[setter_name](elem, val));
							return elem;
						},
						tag: tag
					};
					last_pop[type_name] = true;

					last(stack).children.push(last_pop);
				} else {
					push_onto_children = true;
					if(tag === "each") {
						memoized_elems = memoize_dom_elems();

						last_pop = {
							create: function(context, lineage, curr_bindings) {
								var mvals, mdom, mLastLineage, val_diff, rv = [],
									val = get_node_value(rest_body(parsed_content), context, lineage, curr_bindings),
									memoized_val = memoized_elems.get(lineage);

								if(!isArray(val)) {
									// IS_OBJ provides a way to ensure the user didn't happen to pass in a similarly formatted array
									val = map(val, function(v, k) { return { key: k, value: v, is_obj: IS_OBJ }; });
								} else if(val.length === 0 && this.else_child) {
									val = [ELSE_COND];
								}


								if(memoized_val) {
									mvals = memoized_val.val;
									mdom = memoized_val.dom;
									mLastLineage = memoized_val.lineage;
								} else {
									mvals = [];
									mdom = [];
									mLastLineage = [];
									memoized_elems.set(lineage, {val: val, dom: mdom, lineage: mLastLineage});
								}

								val_diff = get_array_diff(mvals, val, map_aware_array_eq);

								each(val_diff.index_changed, function(ic_info) {
									var lastLineageItem = mLastLineage[ic_info.from];
									if(lastLineageItem && lastLineageItem.at && lastLineageItem.at.index) {
										lastLineageItem.at.index.set(ic_info.to);
									}
								});
								each(val_diff.removed, function(removed_info) {
									var index = removed_info.from,
										lastLineageItem = mLastLineage[index];
									mdom.splice(index, 1);
									if(lastLineageItem && lastLineageItem.at) {
										each(lastLineageItem.at, function(v) {
											v.destroy(true);
										});
									}
								});
								each(val_diff.added, function(added_info) {
									var v = added_info.item,
										index = added_info.to,
										is_else = v === ELSE_COND,
										lastLineageItem = is_else ? false : {this_exp: v, at: ((v && v.is_obj === IS_OBJ) ? {key: cjs(v.key)} : { index: cjs(index)})},
										concated_lineage = is_else ? lineage : lineage.concat(lastLineageItem),
										vals = map(is_else ? this.else_child.children : this.children, function(child) {
											var dom_child = child.create(context, concated_lineage, curr_bindings);
											return dom_child;
										});
									mdom.splice(index, 0, vals);
									mLastLineage.splice(index, 0, lastLineageItem);
								}, this);
								each(val_diff.moved, function(moved_info) {
									var from_index = moved_info.from_index,
										to_index = moved_info.to_index,
										dom_elem = mdom[from_index],
										lastLineageItem = mLastLineage[from_index];

									mdom.splice(from_index, 1);
									mdom.splice(to_index, 0, dom_elem);
									mLastLineage.splice(from_index, 1);
									mLastLineage.splice(to_index, 0, lastLineageItem);
								});

								mvals.splice.apply(mvals, ([0, mvals.length]).concat(val));
								return flatten(mdom, true);
							},
							children: [],
							isEach: true,
							else_child: false 
						};
					} else if(tag === "if" || tag === "unless") {
						memoized_elems = memoize_dom_elems();
						last_pop = {
							create: function(context, lineage, curr_bindings) {
								var len = this.sub_conditions.length,
									cond = !!get_node_value(this.condition, context, lineage, curr_bindings),
									i = -1, children, memo_index;

								if(this.reverse) {
									cond = !cond;
								}

								if(cond) {
									i = 0;
								} else if(len > 0) {
									for(i = 0; i<len; i++) {
										cond = this.sub_conditions[i];

										if(cond.condition === ELSE_COND || get_node_value(cond.condition, context, lineage, curr_bindings)) {
											i++; break;
										}
									}
								}

								if(i < 0) {
									return [];
								} else {
									var memoized_children = memoized_elems.get(lineage);
									if(!memoized_children) {
										memoized_children = [];
										memoized_elems.set(lineage, memoized_children);
									}

									if(!memoized_children[i]) {
										if(i === 0) {
											children = this.children;
										} else {
											children = this.sub_conditions[i-1].children;
										}
										memoized_children[i] = flatten(map(children, function(child) {
											return child.create(context, lineage, curr_bindings);
										}), true);
									}

									return memoized_children[i];
								}
							},
							children: [],
							sub_conditions: [],
							condition: rest_body(parsed_content),
							reverse: tag === "unless"
						};

						condition_stack.push(last_pop);
					} else if(tag === "elif" || tag === "else") {
						last_pop = {
							children: [],
							condition: tag === "else" ? ELSE_COND : rest_body(parsed_content)
						};
						var last_stack = last(stack);
						if(last_stack.isEach) {
							last_stack.else_child = last_pop;
						} else {
							last(condition_stack).sub_conditions.push(last_pop);
						}
						push_onto_children = false;
					} else if(tag === "fsm") {
						memoized_elems = memoize_dom_elems();
						var fsm_target = rest_body(parsed_content);
						last_pop = {
							create: function(context, lineage, curr_bindings) {
								var fsm = get_node_value(fsm_target, context, lineage, curr_bindings),
									state = fsm.getState(),
									do_child_create = function(child) {
										return child.create(context, lineage, curr_bindings);
									}, state_name, memoized_children;

								if(!lineage) {
									lineage = [];
								}

								for(state_name in this.sub_states) {
									if(this.sub_states.hasOwnProperty(state_name)) {
										if(state === state_name) {
											memoized_children = memoized_elems.get(lineage);
											if(!memoized_children) {
												memoized_children = {};
												memoized_elems.set(lineage, memoized_children);
											}

											if(!has(memoized_children, state_name)) {
												memoized_children[state_name] = map(this.sub_states[state_name].children, do_child_create);
											}
											return memoized_children[state_name];
										}
									}
								}
								return [];
							},
							children: [],
							sub_states: {}
						};
						fsm_stack.push(last_pop);
					} else if(tag === "state") {
						if(parsed_content.body.length > 1) {
							var state_name = parsed_content.body[1].name;
							last_pop = { children: [] };
							last(fsm_stack).sub_states[state_name] = last_pop;
							push_onto_children = false;
						}
					} else if(tag === "with") {
						last_pop = {
							create: function(context, lineage, curr_bindings) {
								var new_context = get_node_value(rest_body(parsed_content), context, lineage, curr_bindings),
									concatenated_lineage = lineage.concat({this_exp: new_context});
								return map(this.children, function(child) {
									return child.create(new_context, concatenated_lineage, curr_bindings);
								});
							},
							children: []
						};
					} else {
						return;
					}

					if(push_onto_children) {
						last(stack).children.push(last_pop);
					}
					stack.push(last_pop);
				}
			},
			endHB: function(tag) {
				if(tag === "if" || tag === "unless") {
					condition_stack.pop();
				} else if(tag === "fsm") {
					fsm_stack.pop();
				}
				stack.pop();
			},
			partialHB: function(tagName, parsed_content) {
				var partial = partials[tagName];
				if(partial) {
					last_pop = {
						create: function(context, lineage, curr_bindings) {
							var new_context = get_node_value(rest_body(parsed_content), context, lineage, curr_bindings);
							return partial(new_context);
						}
					};

					last(stack).children.push(last_pop);
				}
			}
		});
		return stack.pop();
	},
	memoized_template_nodes = [],
	memoized_template_bindings = [],
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
