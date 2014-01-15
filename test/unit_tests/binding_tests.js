module("Bindings");

dt("Basic Text Bindings", 2, function() {
	var x = cjs("Hello"),
		y = cjs("World");
	var dom_elem = document.createElement("div");
	cjs.text(dom_elem, x, y);
	equal(dom_elem.textContent, "HelloWorld");
	x.set("Goodbye");
	equal(dom_elem.textContent, "GoodbyeWorld");
});

dt("Dynamic Text Bindings", 6, function() {
	var x = cjs("Hello"),
		y = cjs("World");

	var dom_elem1 = document.createElement("div");
	var dom_elem2 = document.createElement("div");

	var elems = cjs([dom_elem1, dom_elem2]);
	cjs.text(elems, x, y);

	equal(dom_elem1.textContent, "HelloWorld");
	equal(dom_elem2.textContent, "HelloWorld");

	x.set("Goodbye");

	equal(dom_elem1.textContent, "GoodbyeWorld");
	equal(dom_elem2.textContent, "GoodbyeWorld");

	elems.pop();

	y.set("Pittsburgh");

	equal(dom_elem1.textContent, "GoodbyePittsburgh");
	equal(dom_elem2.textContent, "GoodbyeWorld");
});

dt("Basic Text Bindings", 2, function() {
	var x = cjs("Hello"),
		y = cjs("World");
	var dom_elem = document.createElement("div");
	cjs.text(dom_elem, x, y);
	equal(dom_elem.textContent, "HelloWorld");
	x.set("Goodbye");
	equal(dom_elem.textContent, "GoodbyeWorld");
});

dt("CSS Bindings", 1, function() {
	var dom_elem = document.createElement("div");
	var curr_map = cjs({});
	cjs.css(dom_elem, curr_map);
	curr_map.put("color", "red");
	equal(dom_elem.style.color, "red");
});

dt("Class Bindings", 15, function() {
	var dom_elem = document.createElement("div");
	var classes = cjs([]);
	dom_elem.className = "existing_class";
	ok(dom_elem.className.indexOf("class1") < 0, "No class 1");
	ok(dom_elem.className.indexOf("class2") < 0, "No class 2");
	ok(dom_elem.className.indexOf("existing_class") >= 0, "Old class still there");
	cjs.class(dom_elem, classes);
	ok(dom_elem.className.indexOf("class1") < 0, "No class 1");
	ok(dom_elem.className.indexOf("class2") < 0, "No class 2");
	ok(dom_elem.className.indexOf("existing_class") >= 0, "Old class still there");
	classes.push("class1");
	ok(dom_elem.className.indexOf("class1") >= 0, "Has class 1");
	ok(dom_elem.className.indexOf("class2") < 0, "No class 2");
	ok(dom_elem.className.indexOf("existing_class") >= 0, "Old class still there");
	classes.push("class2");
	ok(dom_elem.className.indexOf("class1") >= 0, "Has class 1");
	ok(dom_elem.className.indexOf("class2") >= 0, "Has class 2");
	ok(dom_elem.className.indexOf("existing_class") >= 0, "Old class still there");
	classes.pop();
	ok(dom_elem.className.indexOf("class1") >= 0, "Has class 1");
	ok(dom_elem.className.indexOf("class2") < 0, "No class 2");
	ok(dom_elem.className.indexOf("existing_class") >= 0, "Old class still there");
});

dt("Attr Bindings", 2, function() {
	var dom_elem = document.createElement("div");
	var attr_val = cjs("abc");
	cjs.attr(dom_elem, "class", attr_val);
	equal(dom_elem.className, "abc");
	attr_val.set("def");
	equal(dom_elem.className, "def");
});
