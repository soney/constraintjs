	cjs.__parsers = {};
	cjs.__ir_builders = {};
	cjs.__template_builders = {};

	var script_regex = /^#(\w+)$/;
	cjs.template = function(a,b,c,d) {
		var template_type = "handlebars", str, data, options = {};

		if(arguments.length === 1) {
			str = a;
		} else if(arguments.length === 2) {
			str = a;
			data = b;
		} else if(arguments.length === 3) {
			str = a;
			data = b;
			options = c;
		} else  {
			template_type = a;
			str = b;
			data = c;
			options = d;
		} 

		var matches = str.match(script_regex);
		if(matches) {
			var script_id = matches[1];
			var scripts = document.getElementsByTagName("script");
			var template_script = null;
			each(scripts, function(script) {
				var type = script.getAttribute("type");
				if(type === "cjs/template") {
					var id = script.getAttribute("id");
					if(id === script_id) {
						template_script = script;
					}
				}
			});
			if(template_script) {
				str = template_script.innerText;
			} else {
				str = "Could not find &lt;script type='cjs/template' id='" + script_id + "'&gt;(...)&lt;/script&gt;";
			}
		}

		return cjs.__template_builders[template_type](str, data, options);
	};
