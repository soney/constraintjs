module("Expression Parser");

test('Variables', function() {
	var parse = cjs._.bind(cjs.__parsers.expression, cjs.__parsers);
	var test_parser = function(inp, out) {
		return deepEqual(parse(inp), out);
	};
	var parse_result = parse("a(b(c, d), e)");
	console.log(parse_result);
});
