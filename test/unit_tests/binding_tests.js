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
