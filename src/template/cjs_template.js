	var empty_fn = function(){};
	var create_template = function(template_str) {
		var stack = [], last_pop = false;
		parseTemplate(template_str, {
			startHTML: function(tag, attributes, unary) {
				last_pop = {
					create: function() {
						var element = document.createElement(tag);
						each(attributes, function(attr) {
							element.setAttribute(attr.name, attr.value);
						});

						each(this.children, function(child) {
							element.appendChild(child.create());
						});
						return element;
					},
					children: [],
					destroy: empty_fn
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
					}
				};
				if(stack.length > 0) {
					last(stack).children.push(last_pop);
				}
			},
			startHB: function() {
				console.log("Start Handlebars", arguments);
			},
			endHB: function() {
				console.log("End Handlebars", arguments);
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
		if(last_pop === false) {
			return function() {
				return document.createTextNode("");
			};
		} else {
			return bind(last_pop.create, last_pop);
		}
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
