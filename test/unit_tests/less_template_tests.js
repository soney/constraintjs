module("LESS Templates");

test('LESS Parser', function() {
	var parse = cjs._.bind(cjs.__parsers.less, cjs.__parsers);
	var test_parser = function(inp, out) {
		return deepEqual(parse(inp), out);
	};
	test_parser(
		".class {"
		+ "prop_name: value"
		+ "}"
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
});

test('LESS Intermediate Rep', function() {
	var parse = cjs._.bind(cjs.__parsers.less, cjs.__parsers);
	var build_ir = cjs._.bind(cjs.__ir_builders.less, cjs.__ir_builders);
	var test_ir = function(inp, out) {
		return deepEqual(build_ir(parse(inp)), out);
	};

/*
	test_ir("ABC" 
		, {
			type: "text"
			, value: "ABC"
		}
	);
	*/
});
