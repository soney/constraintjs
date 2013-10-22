module("Map Constraints");

dt("Basic Maps", 16, function() {
	var map = cjs({x: 1});
	equal(map.item("x"), 1);
	map.set("x", 2);
	equal(map.item("x"), 2);
	ok(!map.has("y"));
	map.item("y", 3);
	ok(map.has("y"));
	equal(map.size(), 2);
	map.setHash(function() { return ""; });
	equal(map.size(), 2);
	deepEqual(map.toObject(), {x: 2, y: 3});
	map.clear();
	ok(map.isEmpty());
	map.put("b", 2);
	map.put("a", 1, 0);
	map.put("c", 3);
	deepEqual(map.keys(), ["a", "b", "c"]);
	deepEqual(map.values(), [1, 2, 3]);
	equal(map.indexOf("a"), 0);
	equal(map.indexOf("b"), 1);
	map.move("a", 1);
	equal(map.indexOf("a"), 1);
	equal(map.indexOf("b"), 0);
	map.remove("a");
	equal(map.indexOf("c"), 1);
	equal(map.keyForValue(2), "b");
});

dt("Constraints on items", 5, function() {
	var m = cjs({});
	var ma = cjs(function() {
		if(m.has("a")) {
			return m.get("a");
		} else {
			return 'no a';
		}
	});
	ok(m.isEmpty());
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
