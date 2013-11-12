module("Templates");

dt("Simple Templates", 0, function() {
	var template_1 = cjs.template("<div>hello</div>", {x: 1});
	console.log(template_1);
});
