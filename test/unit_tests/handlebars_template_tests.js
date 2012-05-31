module("Handlebars Templates");

test('Handlebars Parser', function() {
	var parse = cjs._.bind(cjs.__parsers.handlebars, cjs.__parsers);
	var test_parser = function(inp, out) {
		return deepEqual(parse(inp), out);
	};
	test_parser(
		"ABC"
		, {
			content: "ABC"
			, partials: []
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
			content: "{{abc x}}"
			, partials: []
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
			content: "{{abc x}}"
					+ "\ndef"
			, partials: []
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
					, "\ndef"
				]
			]
		}
	);

	test_parser(
		  "{{#blocka a b c}}"
		+	"d e f"
		+ "{{/blocka}}"
		+ "{{#blockb g h i}}"
		+	"j k l"
		+	"{{#blockc m n o}}"
		+		"p q r"
		+	"{{/blockc}}"
		+ "{{/blockb}}"
		, {
			"content":  "{{#blocka a b c}}"
						+	"d e f"
						+ "{{/blocka}}"
						+ "{{#blockb g h i}}"
						+	"j k l"
						+	"{{#blockc m n o}}"
						+		"p q r"
						+	"{{/blockc}}"
						+ "{{/blockb}}"
			, "partials": []
			, tokens: [
				"multi"
				, [
					"mustache"
					, "section"
					, "blocka"
					, "blocka a b c"
					, "d e f"
					, [
						"multi"
						, [
							"static"
							, "d e f"
						]
					]
				]
				, [
					"mustache"
					, "section"
					, "blockb"
					, "blockb g h i"
					, "j k l{{#blockc m n o}}p q r{{/blockc}}"
					, [
						"multi"
						, [
						"static"
						, "j k l"
						]
						, [
							"mustache"
							, "section"
							, "blockc"
							, "blockc m n o"
							, "p q r"
							, [
								"multi"
								, [
									"static"
									, "p q r"
								]
							]
						]
					]
				]
			]
		}
	);

	test_parser(
		"{{#diagram x}}"
		+ "{{#state a}}A"
		+ "{{#state b}}B"
		+ "{{#state c}}C"
		+ "{{/diagram}}"
		, {
			"content":  "{{#diagram x}}"
						+ "{{#state a}}A"
						+ "{{#state b}}B"
						+ "{{#state c}}C"
						+ "{{/diagram}}"
			, "partials": []
			, "tokens": [
				"multi"
				, [
					"mustache"
					, "section"
					, "diagram"
					, "diagram x"
					, "{{#state a}}A{{#state b}}B{{#state c}}C"
					, [
						"multi"
						, [
							"mustache"
							, "section"
							, "state"
							, "state a"
							, "A"
							, [
								"multi"
								, [
									"static"
									, "A"
								]
							]
						]
						, [
							"mustache"
							, "section"
							, "state"
							, "state b"
							, "B"
							, [
								"multi"
								, [
									"static"
									, "B"
								]
							]
						]
						, [
							"mustache"
							, "section"
							, "state"
							, "state c"
							, "C"
							, [
								"multi"
								, [
									"static"
									, "C"
								]
							]
						]
					]
				]
			]
		} 
	);

});
