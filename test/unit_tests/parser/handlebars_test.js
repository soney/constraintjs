module("Handlebars Templates");

test('Basic', function() {
	var parse = cjs._.bind(cjs.__parsers.handlebars, cjs.__parsers);
	console.log(parse(
			"{{#diagram a}}"
		+		"{{#state pending}}A{{/state}}"
		/*
		+		"{{#state rejected}}B"
		+		"{{#state resolved}}C"
		+			"{{#each friends friend i}}"
		+				"{{#diagram pics.state}}"
		+					"{{#state pending}}Loading friends..."
		+					"{{#state rejected}}Error"
		+					"{{#state resolved}}"
		+				"{{/diagram}}"
		+				"{{friend.name}}"
		+			"{{/each}}"
		*/
		+	"{{/diagram}}"
		));
});
