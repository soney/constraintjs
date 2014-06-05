module("Map Constraints");

dt("Basic Maps", 16, function() {
	var map = cjs({x: 1});
	equal(map.item("x"), 1);
	map.put("x", 2);
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

	map.destroy();
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
	m.put('a', 1);
	equal(ma.get(), 1);
	m.put('a', 2);
	equal(ma.get(), 2);
	m.remove('a');
	equal(ma.get(), 'no a');
	m.destroy();
	ma.destroy();
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
	m.put('b', 2);
	equal(x.get(), 'no a');
	equal(eval_count, 1);
	m.put('a', 1);
	equal(x.get(), 1);
	equal(eval_count, 2);
	m.put('c', 3);
	equal(eval_count, 2);
	m.put('a', 11);
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
	m2.put('b', 2);
	equal(x.get(), 'no a');
	equal(eval_count, 1);
	m2.put('a', 1);
	equal(x.get(), 1);
	equal(eval_count, 2);
	m2.put('c', 3);
	equal(eval_count, 2);
	m2.put('a', 11);
	equal(x.get(), 11);
	equal(eval_count, 3);

	m.destroy();
	m2.destroy();
	x.destroy();
});

dt("Item values are constraints", 5, function() {
	var m = cjs({});
	var ma = m.itemConstraint('a');
	ok(m.isEmpty());
	equal(ma.get(), undefined);
	m.put('a', cjs(1));
	equal(ma.get(), 1);
	m.put('a', cjs(2));
	equal(ma.get(), 2);
	m.remove('a');
	equal(ma.get(), undefined);
	m.destroy();
	ma.destroy();
	m = ma = null;
});

dt("Maps and maps and maps", 4, function() {
	var m = cjs({})
		sub_m = cjs({}),
		sub_m_2 = cjs({}),
		sub_m_3 = {};

	ok(!m.has("sub"));
	m.put("sub", sub_m);
	m.put("sub2", sub_m_2);
	m.put("sub3", sub_m_3);
	equal(m.get("sub"), sub_m);
	equal(m.get("sub2"), sub_m_2);
	equal(m.get("sub3"), sub_m_3);

	sub_m.put("x", 1);

	m.destroy();
	sub_m.destroy();
	sub_m_2.destroy();
	m = sub_m = sub_m_2 = sub_m_3 = null;
});

dt("Constraints whose value is a map", 1, function() {
	var m = cjs({}),
		//x = new cjs.Constraint(m),
		y = new cjs.Constraint();
	
	//equal(x.get(), m);
	y.set(m);
	equal(y.get(), m);

	m.destroy();
	//x.destroy();
	y.destroy();
	m = /*x =*/ y = null;
});
