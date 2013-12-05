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

dt("Map Optimization", 20, function() {
	var m = cjs({});
	var eval_count = 0;
	var x = cjs(function() {
		eval_count++;
		if(m.has("a")) {
			return m.get("a");
		} else {
			return 'no a';
		}
	});
	equal(eval_count, 0);
	equal(x.get(), 'no a');
	equal(eval_count, 1);
	m.set('b', 2);
	equal(x.get(), 'no a');
	equal(eval_count, 1);
	m.set('a', 1);
	equal(x.get(), 1);
	equal(eval_count, 2);
	m.set('c', 3);
	equal(eval_count, 2);
	m.set('a', 11);
	equal(x.get(), 11);
	equal(eval_count, 3);

	eval_count = 0;
	var m2 = cjs({}, {
		hash: function(x) { return "nohash"; }
	});
	x.set(function() {
		eval_count++;
		return m2.get("a") || 'no a';
	});

	equal(eval_count, 0);
	equal(x.get(), 'no a');
	equal(eval_count, 1);
	m2.set('b', 2);
	equal(x.get(), 'no a');
	equal(eval_count, 1);
	m2.set('a', 1);
	equal(x.get(), 1);
	equal(eval_count, 2);
	m2.set('c', 3);
	equal(eval_count, 2);
	m2.set('a', 11);
	equal(x.get(), 11);
	equal(eval_count, 3);
});
