/*jslint evil: true regexp: true*/
/*global console: true, document:true */
(function(cjs) {
	var _ = cjs._;

	cjs.__parsers = {};
	cjs.__ir_builders = {};
	cjs.__template_builders = {};

	var script_regex = /^#(\w+)$/;
	cjs.template = function(a,b,c,d) {
		var template_type = "handlebars"
			, str
			, data = undefined
			, options = {};
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
		if(!_.isNull(matches)) {
			var script_id = matches[1];
			var scripts = document.getElementsByTagName("script");
			var template_script = null;
			_.forEach(scripts, function(script) {
				var type = script.getAttribute("type");
				if(type === "cjs/template") {
					var id = script.getAttribute("id");
					if(id === script_id) {
						template_script = script;
					}
				}
			});
			if(_.isNull(template_script)) {
				str = "Could not find <script type='cjs/template' id='" + script_id + "'>(...)</script>";
			} else {
				str = template_script.innerText;
			}
		}

		return cjs.__template_builders[template_type](str, data, options);
	};
}(cjs));
