/*jslint evil: true regexp: true*/
/*global console: true, document:true */
(function(cjs) {
	var _ = cjs._;

	var templ = function(str) {
		var results = "";
		_.html_parser(str, {
				start: function(tag, attrs, unary) {
				},
				end: function(tag) {
				},
				chars: function(text) {
				},
				comment: function(text) {
				},
				startHandlebars: function(tag, attrs, block) {
				}
				, endHandlebars: function(tag) {
				}
			});
		console.log(results);
	};

	cjs.define("template", templ);
}(cjs));
