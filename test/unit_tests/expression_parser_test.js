
(function() {
var parse = cjs._.bind(cjs.__parsers.expression, cjs.__parsers);
var test_parser = function(inp, out) {
	var actual_out = {};
	var parse_val = parse(inp);
	cjs._.forEach(out, function(prop_val, prop_name) {
		actual_out[prop_name] = parse_val[prop_name];
	});
	console.log(parse_val);
	return deepEqual(actual_out, out);
};

module("Expression Parser");

test('Constants', function() {
	test_parser("'abc'", {value: "abc"});
	test_parser('"abc"', {value: "abc"});
	test_parser("123", {value: 123});
	test_parser("12.3", {value: 12.3});
});

test('Variables', function() {
	test_parser("abc", {var_name: "abc"});
});

test('bleh', function() {
	test_parser("a(b, c(d,e), f)", {});
	test_parser("a b + c", {});
});


}());
