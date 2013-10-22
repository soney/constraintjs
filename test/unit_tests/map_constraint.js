module("Map Constraints");

dt("Basic Map", 4, function() {
	var m = cjs({});
	var ma = cjs(function() {
		if(m.has("a")) {
			return m.get("a");
		} else {
			return 'no a';
		}
	});
	equal(ma.get(), 'no a');
	m.set('a', 1);
	equal(ma.get(), 1);
	m.set('a', 2);
	equal(ma.get(), 2);
	m.remove('a');
	equal(ma.get(), 'no a');
	m.destroy();
	ma.destroy();
	m = ma = null;
});
