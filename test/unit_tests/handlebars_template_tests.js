(function() {
var filter_props = function(larger, smaller) {

	var rv = {};
	if(smaller instanceof Array) { rv = []; }
	var prop_val;
	for(var prop_name in smaller) {
		prop_val  = smaller[prop_name];
		if(typeof prop_val === 'string' || typeof prop_val === 'number') {
			rv[prop_name] = larger[prop_name];
		} else {
			rv[prop_name] = filter_props(larger[prop_name], prop_val);
		}
	}
	return rv;
};

var parse = cjs._.bind(cjs.__parsers.handlebars, cjs.__parsers);
var test_parser = function(inp, out) {
	return deepEqual(filter_props(parse(inp), out), out);
};
var ir_build = function(inp, options) {
	var parse_tree = parse(inp, options);
	var ir = cjs.__ir_builders.handlebars(parse_tree);
	return ir;
};
var test_ir_builder = function(inp, out) {
	return deepEqual(filter_props(ir_build(inp), out), out);
};

module("Handlebars Templates");

test('Handlebars Parser', function() {
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

test('Handlebars Parser', function() {
	test_ir_builder("<div>" +
					"{{#if a}}" +
					"<div class={{b}}>abc {{c}}</div>" +
					"{{#else}}" +
					"<span>Something</span>" +
					"{{/if}}" +
					"</div>", {});
});

}());
