/*jslint evil: true regexp: true*/
/*global console: true, document:true */
(function(cjs) {
	var _ = cjs._;

	cjs.__parsers = {};
	cjs.__ir_builders = {};
	cjs.__template_builders = {};


	cjs.template = function(a,b,c,d) {
		var template_type = "handlebars"
			, str
			, data = {}
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

		return cjs.__template_builders[template_type](str, data, options);
	};
}(cjs));
