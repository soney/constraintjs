module("Examples");

dt("Two Eaches", 3, function() {
	var a1 = cjs([1,2,3]),
		a2 = cjs(["A", "B", "C"]);
	var tmplate = cjs.createTemplate("{{#each a1}}{{this}}{{/each}}{{#each a2}}{{this}}{{/each}}", {a1: a1, a2: a2});
	equal(tmplate.textContent, "123ABC");
	a2.splice(1, 1);
	equal(tmplate.textContent, "123AC");
	a1.splice(2, 1, "yo");
	equal(tmplate.textContent, "12yoAC");
});
