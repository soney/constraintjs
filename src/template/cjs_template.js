	function escapeHTML(unsafe) {
		return unsafe	.replace(/&/g, "&amp;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;")
						.replace(/"/g, "&quot;")
						.replace(/'/g, "&#039;");
	}
	var compute_val = function(tag, context, lineage) {
		if(tag === "this" && lineage) {
			return last(lineage);
		} else {
			return context[tag];
		}
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

	var create_template = function(template_str) {
		var stack = [{
			children: [],
			create: default_template_create
		}], last_pop = false, has_container = false;

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
									if(child.isArray) {
										var c_plural = child.create.apply(child, args);
										rv.push.apply(rv, c_plural);
									} else {
										rv.push(child.create.apply(child, args));
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
			startHB: function(tag, args, unary, literal) {
				if(unary) {
					if(literal) {
						last_pop = {
							create: function(context, lineage) {
								var elem = document.createTextNode(""),
									val = compute_val(tag, context, lineage);
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
									val = compute_val(tag, context, lineage);
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
					if(tag === "each") {
						var memoized_args = [];
						var memoized_vals = [];
						var memoized_dom_elems = [];

						var arg = args[0];
						last_pop = {
							create: function(context, lineage) {
								var val;
								if(has(context, arg)) {
									val = cjs.get(context[arg]);
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

								var memo_index = indexWhere(memoized_args, function(margs) {
									return margs[0]=== context &&
											margs[1].length === lineage.length &&
											every(margs[1], function(l, i) {
												return l === lineage[i];
											});
								});
									
								var mvals, mdom;
								if(memo_index < 0) {
									memo_index = memoized_args.length;
									memoized_args.push([context, lineage]);
									mdom = memoized_dom_elems[memo_index] = [];
									mvals = [];
								} else {
									mvals = memoized_vals[memo_index];
									mdom = memoized_dom_elems[memo_index];
								}
								memoized_vals[memo_index] = val;

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
							children: [],
							isArray: true
						};
					} else if(tag === "if") {
						last_pop = {
							create: function(context, lineage) {
							},
							children: []
						};
					} else if(tag === "elif") {
						last_pop = {
							create: function(context, lineage) {
							},
							children: []
						};
					} else if(tag === "else") {
						last_pop = {
							create: function(context, lineage) {
							},
							children: []
						};
					} else {
						return;
					}

					if(stack.length > 0) {
						last(stack).children.push(last_pop);
					}
					stack.push(last_pop);
				}
			},
			endHB: function() {
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
