	var create_template = function(template_str) {
		parseTemplate(template_str, {
			startHTML: function(tag, attributes, unary) {
				console.log("Start HTML", arguments);
			},
			endHTML: function(tag) {
				console.log("End HTML", arguments);
			},
			chars: function(str) {
				console.log("Chars", arguments);
			},
			HTMLcomment: function(text) {
				console.log("HTML Comment", arguments);
			},
			startHB: function() {
				console.log("Start Handlebars", arguments);
			},
			endHB: function() {
				console.log("End Handlebars", arguments);
			},
			HBComment: function(text) {
				console.log("Handlebars Comment", arguments);
			}
		});
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
