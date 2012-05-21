module("Handlebars Templates");

test('Basic', function() {
	var parse = cjs._.bind(cjs.__parsers.handlebars.parse, cjs.__parsers.handlebars);
	console.log(parse(
			"{{#diagram friends.state}}"
		+		"{{#state pending}}A"
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
