module("Templates");

dt("Static Templates", 7, function() {
	var empty_template = cjs.template("", {});
	equal(empty_template.textContent, "");

	var hello_template = cjs.template("hello world", {});
	equal(hello_template.textContent, "hello world");

	var div_template = cjs.template("<div>hi</div>", {});
	equal(div_template.tagName.toLowerCase(), "div");
	equal(div_template.textContent, "hi");

	var nested_div_template = cjs.template("<div>hi <strong>world</strong></div>", {});
	equal(nested_div_template.tagName.toLowerCase(), "div");
	var strong_content = nested_div_template.getElementsByTagName("strong")[0];
	equal(strong_content.textContent, "world");

	var classed_template = cjs.template("<div class='my_class'>yo</div>", {});
	equal(classed_template.className, "my_class");
});

dt("Dynamic Templates", 4, function() {
	var t1 = cjs.template("{{x}}", {x: "hello world"});
	equal(t1.textContent, "hello world");

	var greet = cjs("hello");
	var city = cjs("pittsburgh");
	var t2 = cjs.template("{{greeting}}, {{city}}", {greeting: greet, city: city});
	equal(t2.textContent, "hello, pittsburgh");
	greet.set("bye");
	equal(t2.textContent, "bye, pittsburgh");
	city.set("world");
	equal(t2.textContent, "bye, world");
});

dt("HTMLized Templates", 7, function() {
	var x = cjs("X"), y = cjs("Y");
	var t1 = cjs.template("{{{x}}}, {{y}}", {x: x, y: y});
	equal(t1.textContent, "X, Y");
	x.set("<strong>X</strong>");
	var strong_content = t1.getElementsByTagName("strong")[0];
	equal(t1.textContent, "X, Y");
	equal(strong_content.textContent, "X");
	y.set("<b>Y</b>");
	equal(t1.textContent, "X, <b>Y</b>");

	var t2 = cjs.template("<div>{{{x}}}, {{y}}</div>", {x: x, y: y});
	equal(t2.textContent, "X, <b>Y</b>");
	var strong_content = t2.getElementsByTagName("strong")[0];
	equal(strong_content.textContent, "X");
	equal(t2.tagName.toLowerCase(), "div");
});
