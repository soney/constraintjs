module("Bindings");

var getTextContent = function(node) {
	if(node.textContent || node.textContent==="") {
		return node.textContent;
	} else {
		return node.innerText;
	}
};

dt("Basic Text Bindings", 2, function() {
	var x = cjs("Hello"),
		y = cjs("World");
	var dom_elem = document.createElement("div");
	cjs.bindText(dom_elem, x, y);
	equal(getTextContent(dom_elem), "HelloWorld");
	x.set("Goodbye");
	equal(getTextContent(dom_elem), "GoodbyeWorld");
});

dt("Dynamic Text Bindings", 6, function() {
	var x = cjs("Hello"),
		y = cjs("World");

	var dom_elem1 = document.createElement("div");
	var dom_elem2 = document.createElement("div");

	var elems = cjs([dom_elem1, dom_elem2]);
	cjs.bindText(elems, x, y);

	equal(getTextContent(dom_elem1), "HelloWorld");
	equal(getTextContent(dom_elem2), "HelloWorld");

	x.set("Goodbye");

	equal(getTextContent(dom_elem1), "GoodbyeWorld");
	equal(getTextContent(dom_elem2), "GoodbyeWorld");

	elems.pop();

	y.set("Pittsburgh");

	equal(getTextContent(dom_elem1), "GoodbyePittsburgh");
	equal(getTextContent(dom_elem2), "GoodbyeWorld");
});

dt("Basic Text Bindings", 2, function() {
	var x = cjs("Hello"),
		y = cjs("World");
	var dom_elem = document.createElement("div");
	cjs.bindText(dom_elem, x, y);
	equal(getTextContent(dom_elem), "HelloWorld");
	x.set("Goodbye");
	equal(getTextContent(dom_elem), "GoodbyeWorld");
});

dt("CSS Bindings", 1, function() {
	var dom_elem = document.createElement("div");
	var curr_map = cjs({});
	cjs.bindCSS(dom_elem, curr_map);
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
	cjs.bindClass(dom_elem, classes);
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
	cjs.bindAttr(dom_elem, "id", attr_val);
	equal(dom_elem.id, "abc");
	attr_val.set("def");
	equal(dom_elem.id, "def");
});
