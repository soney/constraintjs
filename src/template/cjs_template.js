	var binary_operators = {
		"===":	function (a, b) { return a === b;}, "!==":	function (a, b) { return a !== b; },
		"==":	function (a, b) { return a == b; }, "!=":	function (a, b) { return a != b; },
		">":	function (a, b) { return a > b;  }, ">=":	function (a, b) { return a >= b; },
		"<":	function (a, b) { return a < b;  }, "<=":	function (a, b) { return a <= b; },
		"+":	function (a, b) { return a + b;  }, "-":	function (a, b) { return a - b; },
		"*":	function (a, b) { return a * b;  }, "/":	function (a, b) { return a / b; },
		"%":	function (a, b) { return a % b;  }, "^":	function (a, b) { return a ^ b; },
		"&&":	function (a, b) { return a && b; }, "||":	function (a, b) { return a || b; },
		"&":	function (a, b) { return a & b;  }, "|":	function (a, b) { return a | b; },
		"<<":	function (a, b) { return a << b; }, ">>":	function (a, b) { return a >> b; },
		">>>":  function (a, b) { return a >>> b;}
	};
	var unary_operators = {
		"-":	function (a) { return -a; }, "!":	function (a) { return !a; },
		"~":	function (a) { return ~a; }
	};

	function escapeHTML(unsafe) {
		return unsafe	.replace(/&/g, "&amp;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;")
						.replace(/"/g, "&quot;")
						.replace(/'/g, "&#039;");
	}
	var compute_object_property = function(object, prop_node, context, lineage) {
		return object ? object[property.computed ? get_node_value(prop_node, context, lineage) : prop_node.name] :
						undefined;
	};

	var ELSE_COND = {};

	var get_node_value = function(node, context, lineage) {
		var op, object, call_context, args;
		if(!node) { return undefined; }
		switch(node.type) {
			case THIS_EXP: return last(lineage);
			case LITERAL: return node.value;
			case UNARY_EXP:
				op = unary_operators[node.operator];
				return op ? op(get_node_value(node.argument, context, lineage)) :
							undefined;
			case BINARY_EXP:
			case LOGICAL_EXP:
				return op ? op(get_node_value(node.left, context, lineage), get_node_value(node.right, context, lineage)) :
							undefined;
			case IDENTIFIER:
				return cjs.get(context[node.name]);
			case MEMBER_EXP:
				object = get_node_value(node.object, context, lineage);
				return compute_object_property(object, node.property, context, lineage);
			case COMPOUND:
				return compute_object_property(node.body[0], node.property, context, lineage);
			case CURR_LEVEL_EXP:
				object = last(lineage);
				return compute_object_property(object, node.argument, context, lineage);
			case PARENT_EXP:
				object = lineage ? lineage[lineage.length - 2] : undefined;
				return compute_object_property(object, node.argument, context, lineage);
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
		return undefined;
	};

	var create_node_constraint = function(node, context, lineage) {
		var args = arguments;
		while(node.type === MEMBER_EXP) {
			if(node.object.name === PARENT_LEVEL) {
				lineage.pop();
				node = node.property;
			} else if(node.object.name === SAME_LEVEL) {
				node = node.property;
			} else { break; }
		}
		if(node.type === LITERAL) {
			return get_node_value.apply(root, args);
		}
		return cjs(function() {
			return get_node_value.apply(root, args);
		});
	};

	var child_is_dynamic_html = function(child) {
		return child.isDynamicHTML;
	};
	var child_is_text = function(child) {
		return child.isText;
	};
	var every_child_is_text = function(arr) {
		return every(arr, child_is_text);
	};
	var any_child_is_dynamic_html = function(arr) {
		return indexWhere(arr, child_is_dynamic_html) >= 0;
	};
	var get_concatenated_constraint = function(children, context, lineage) {
		return cjs(function() {
			return map(children, function(child) {
				if(has(child, "text")) {
					return child.text;
				} else {
					return cjs.get(context[child.tag]);
				}
			}).join("");
		});
	};
	var get_concatenated_inner_html_constraint = function(children, context, lineage) {
		return cjs(function() {
			return map(children, function(child) {
				if(child.isDynamicHTML) {
					return cjs.get(context[child.tag]);
				} else if(has(child, "text")) {
					return escapeHTML(child.text);
				} else if(has(child, "tag")) {
					return escapeHTML(cjs.get(context[child.tag]));
				} else {
					var child_val = child.create(context, lineage);
					return child_val.outerHTML;
				}
			}).join("");
		});
	};

	var default_template_create = function(context) {
		if(every_child_is_text(this.children)) {
			var concatenated_text = get_concatenated_constraint(this.children, context);
			var textNode = document.createTextNode("");
			cjs.text(textNode, concatenated_text);
			return textNode;
		} else {
			var args = arguments;
			if(this.children.length === 1) {
				var first_child = this.children[0];
				if(first_child.isHTML) {
					return first_child.create.apply(first_child, args);
				}
			}

			var container = document.createElement("span");
			if(any_child_is_dynamic_html(this.children)) { // this is where it starts to suck...every child's innerHTML has to be taken and concatenated
				var concatenated_html = get_concatenated_inner_html_constraint(this.children, context);
				cjs.html(container, concatenated_html);
				return container;
			} else {
				each(this.children, function(child) {
					container.appendChild(child.create.apply(child, args));
				});
				return container;
			}
		}
		return document.createTextNode("");
	};

	var hb_regex = /^\{\{([\-A-Za-z0-9_]+)\}\}/;

	var get_constraint = function(str, context, lineage) {
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
	};
	var memoize_dom_elems = function() {
		var memoized_args = [];
		var memoized_vals = [];

		return {
			get: function(context, lineage) {
				var memo_index = indexWhere(memoized_args, function(margs) {
					return margs[0]=== context &&
							margs[1].length === lineage.length &&
							every(margs[1], function(l, i) {
								return l === lineage[i];
							});
				});
				return memoized_vals[memo_index];
			},
			set: function(context, lineage, val) {
				memoized_args.push([context, lineage]);
				memoized_vals.push(val);
			}
		};
	};

	var create_template = function(template_str) {
		var stack = [{
			children: [],
			create: default_template_create
		}], last_pop = false, has_container = false, condition_stack = [];

		parseTemplate(template_str, {
			startHTML: function(tag, attributes, unary) {
				last_pop = {
					create: function(context, lineage) {
						var args = arguments;
						var element = document.createElement(tag);

						each(attributes, function(attr) {
							var constraint = get_constraint(attr.value, context, lineage);
							if(is_constraint(constraint)) {
								cjs.attr(element, attr.name, constraint);
							} else {
								element.setAttribute(attr.name, constraint);
							}
						});

						if(any_child_is_dynamic_html(this.children)) { // this is where it starts to suck...every child's innerHTML has to be taken and concatenated
							var concatenated_html = get_concatenated_inner_html_constraint(this.children, context, lineage);
							cjs.html(element, concatenated_html);
						} else {
							var children_constraint = cjs(function() {
								var rv = [];
								each(this.children, function(child) {
									var c_plural = child.create.apply(child, args);
									if(isArray(c_plural)) {
										rv.push.apply(rv, c_plural);
									} else {
										rv.push(c_plural);
									}
								});
								return rv;
							}, {context: this});

							cjs.children(element, children_constraint);
						}
						return element;
					},
					children: [],
					isHTML: true
				};

				if(stack.length > 0) {
					last(stack).children.push(last_pop);
				}

				if(!unary) {
					stack.push(last_pop);
				}
			},
			endHTML: function(tag) {
				last_pop = stack.pop();
			},
			chars: function(str) {
				last_pop = {
					create: function() {
						return document.createTextNode(str);
					},
					isText: true,
					text: str
				};
				if(stack.length > 0) {
					last(stack).children.push(last_pop);
				}
			},
			startHB: function(tag, rest, unary, literal) {
				var memoized_elems;
				if(unary) {
					if(literal) {
						last_pop = {
							create: function(context, lineage) {
								var elem = document.createTextNode(""),
									val = get_node_value(jsep(tag), context, lineage);
								cjs.text(elem, val);
								return elem;
							},
							isDynamicHTML: true,
							tag: tag
						};
					} else {
						last_pop = {
							create: function(context, lineage) {
								var elem = document.createTextNode(""),
									val = get_node_value(jsep(tag), context, lineage);
								cjs.text(elem, val);
								return elem;
							},
							isText: true,
							tag: tag
						};
					}

					if(stack.length > 0) {
						last(stack).children.push(last_pop);
					}
				} else {
					var push_onto_children = true;
					if(tag === "each") {
						memoized_elems = memoize_dom_elems();

						last_pop = {
							create: function(context, lineage) {
								var val, mvals, mdom;
								if(has(context, rest)) {
									val = cjs.get(context[rest]);
									if(!isArray(val)) {
										val = [val];
									}
								} else {
									val = [];
								}

								var rv = [];
								if(!lineage) {
									lineage = [];
								}

								var memoized_val = memoized_elems.get(context, lineage);
								if(memoized_val) {
									mvals = memoized_val.val;
									mdom = memoized_val.dom;
								} else {
									mvals = [];
									mdom = [];
									memoized_elems.set(context, lineage, {val: val, dom: mdom});
								}

								var val_diff = get_array_diff(mvals, val);
								each(val_diff.removed, function(removed_info) {
									mdom.splice(removed_info.from, 1);
								});
								each(val_diff.added, function(added_info) {
									var v = added_info.item,
										concated_lineage = lineage.concat(v);
									var vals = map(this.children, function(child) {
										var dom_child = child.create(context, concated_lineage);
										return dom_child;
									});
									mdom.splice(added_info.to, 0, vals);
								}, this);
								each(val_diff.moved, function(moved_info) {
									var dom_elem = mdom[moved_info.from_index];
									mdom.splice(moved_info.from_index, 1);
									mdom.splice(moved_info.to_index, 0, dom_elem);
								});
								return flatten(mdom, true);
							},
							children: []
						};
					} else if(tag === "if" || tag === "unless") {
						memoized_elems = memoize_dom_elems();
						last_pop = {
							create: function(context, lineage) {
								if(!lineage) {
									lineage = [];
								}
								var memoized_val = memoized_elems.get(context, lineage),
									len = this.sub_conditions.length,
									cond = !!get_node_value(this.condition, context, lineage),
									i = -1, children, memo_index;

								if(this.reverse) {
									cond = !initial_condition;
								}

								if(cond) {
									i = 0;
								} else {
									for(i = 0; i<len; i++) {
										cond = this.sub_conditions[i];

										if(cond.condition === ELSE_COND || get_node_value(cond.condition, context, lineage)) {
											i = i+1;
											break;
										}
									}
								}

								if(i < 0) {
									return [];
								} else {
									var memoized_children = memoized_elems.get(context, lineage);
									if(!memoized_children) {
										memoized_children = [];
										memoized_elems.set(context, lineage, memoized_children);
									}

									if(!memoized_children[i]) {
										if(i === 0) {
											children = this.children;
										} else {
											children = this.sub_conditions[i-1].children;
										}
										memoized_children[i] = flatten(map(children, function(child) {
											return child.create(context, lineage);
										}), true);
									}

									return memoized_children[i];
								}
							},
							children: [],
							sub_conditions: [],
							condition: jsep(rest),
							reverse: tag === "unless"
						};

						condition_stack.push(last_pop);
					} else if(tag === "elif" || tag === "else") {
						last_pop = {
							children: [],
							condition: tag === "else" ? ELSE_COND : jsep(rest)
						};
						last(condition_stack).sub_conditions.push(last_pop);
						push_onto_children = false;
					} else {
						return;
					}

					if(push_onto_children && stack.length > 0) {
						last(stack).children.push(last_pop);
					}
					stack.push(last_pop);
				}
			},
			endHB: function(tag) {
				if(tag === "if") {
					condition_stack.pop();
				}
				stack.pop();
			},
			HBComment: function(text) {
				last_pop = {
					create: function() {
						return document.createComment(text);
					}
				};
				if(stack.length > 0) {
					last(stack).children.push(last_pop);
				}
			}
		});
		last_pop = stack.pop();
		return bind(last_pop.create, last_pop);
	};

	var template_strs = [],
		template_values = [];

	cjs.template = function(template_str, template_variables) {
		if(!isString(template_str)) {
			if(is_jquery_obj(template_obj)) {
				template_str = template_str.length > 0 ? template_str[0].innerText : "";
			} else if(nList && template_str instanceof nList) {
				template_str = template_str.length > 0 ? template_str[0].innerText : "";
			} else if(isElement(template_str)) {
				template_str = template_str.innerText;
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
			return template(template_variables);
		} else { // create the template as a function that can be called with a context
			return template;
		}
	};
