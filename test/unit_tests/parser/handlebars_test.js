module("Handlebars Templates");

test('Basic', function() {
	var parse = cjs._.bind(cjs.__parsers.handlebars, cjs.__parsers);
	var test_parser = function(inp, out) {
		return deepEqual(parse(inp), out);
	};
	test_parser(
		"ABC"
		, {
			partials: []
			, tokens: [
				"multi"
				, [
					"static"
					, "ABC"
				]
			]
		}
	);

	test_parser(
		"{{abc x}}"
		, {
			partials: []
			, tokens: [
				"multi"
				, [
					"mustache"
					, "etag"
					, "abc"
					, "abc x"
				]
			]
		}
	);

	test_parser(
		"{{abc x}}"
		+ "\ndef"
		, {
			partials: []
			, tokens: [
				"multi"
				, [
					"mustache"
					, "etag"
					, "abc"
					, "abc x"
				]
				, [
					"static"
					, "def"
				]
			]
		}
	);
});
