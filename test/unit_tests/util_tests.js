module("Util");

test('Quick Dict', function() {
	var dict = Euclase._quick_dict();

	equals(dict.get(0), undefined); //Integer key
	equals(dict.get('x'), undefined); //Textual key
	equals(dict.get_length(), 0);

	//Numerical keys
	dict.set(0, '0');
	equals(dict.get(0), '0');
	equals(dict.get_length(), 1);

	//Setting existing items
	dict.set(0, '0a');
	equals(dict.get(0), '0a');
	equals(dict.get_length(), 1); //The length should not have changed


	//String keys
	dict.set('x', 'X');
	equals(dict.get('x'), 'X');
	equals(dict.get_length(), 2); //The length should not have changed

	dict.set('y', 'Y');
	equals(dict.get('y'), 'Y');
	equals(dict.get_length(), 3); //The length should not have changed

	dict.unset('x');
	equals(dict.get('x'), undefined); //Textual key
	equals(dict.get_length(), 2);

	equals(dict.get('y'), 'Y');
	equals(dict.get_length(), 2); //The length should not have changed

	/**/
});

test('Graph', function() {
	var graph = Euclase._graph();

	var contains = function(arr, obj) {
		return arr.some(function(x) {
			return x == obj;
		});
	};

	var n1 = graph.create_node(); n1.name = "n1";
	var n2 = graph.create_node(); n2.name = "n2";
	var n3 = graph.create_node(); n3.name = "n3";
	var n4 = graph.create_node(); n4.name = "n4";
	var n5 = graph.create_node(); n5.name = "n5";
	
	graph.addEdge(n1, n2);
	graph.addEdge(n3, n4);
	graph.addEdge(n2, n3);

	
	ok(graph.hasNode(n1));
	
	ok(graph.hasEdge(n1, n2));
	ok(!graph.hasEdge(n1, n3));
	
	var e = graph.getEdge(n3, n4);
	ok(graph.hasEdge(n3, n4));
	ok(contains(n3.outgoingEdges, e));
	ok(contains(n4.incomingEdges, e));
	graph.removeEdge(n3, n4);
	ok(!graph.hasEdge(n3, n4));
	ok(!contains(n3.outgoingEdges, e));
	ok(!contains(n4.incomingEdges, e));

	graph.addEdge(n2,n5);
	ok(n2.pointsAt()[0]==n3 && n2.pointsAt()[1]==n5 && n2.pointsAt().length==2);
	graph.removeEdge(n2,n5);

	var n1n2 = graph.getEdge(n1,n2);
	var n2n3 = graph.getEdge(n2,n3);
	
	ok(graph.hasNode(n2));
	ok(contains(n1.outgoingEdges, n1n2));
	ok(contains(n2.incomingEdges, n1n2));
	ok(contains(n2.outgoingEdges, n2n3));
	ok(contains(n3.incomingEdges, n2n3));
	ok(graph.hasEdge(n1n2));
	ok(graph.hasEdge(n2n3));
	graph.removeNode(n2);
	//ok(!graph.hasNode(n2));
	ok(!contains(n1.outgoingEdges, n1n2));
	ok(!contains(n2.incomingEdges, n1n2));
	ok(!contains(n2.outgoingEdges, n2n3));
	ok(!contains(n3.incomingEdges, n2n3));
	ok(!graph.hasEdge(n1n2));
	ok(!graph.hasEdge(n2n3));
	/**/
});


test('Constraint Solver', function() {
	var equalSets = function (set1, set2) {
		if(set1.length!=set2.length) return false;
		for(var i = 0; i<set1.length; i++) {
			if(!Euclase._.contains(set2, set1[i])) return false;
		}
		return true;
	}
	
	var constraintSolver = Euclase._constraint_solver;
	
	var o1 = {name:'o1'};
	var o2 = {name:'o2'};
	var o3 = {name:'o3'};
	var o4 = {name:'o4'};
	var o5 = {name:'o5'};
	var o6 = {name:'o6'};
	
	constraintSolver.addObject(o1);
	constraintSolver.addObject(o2);
	constraintSolver.addObject(o3);
	constraintSolver.addObject(o4);
	constraintSolver.addObject(o5);
	constraintSolver.addObject(o6);
	
	constraintSolver.addDependency(o1, o2);
	constraintSolver.addDependency(o4, o5);
	
	ok(equalSets(constraintSolver.immediatelyDependentOn(o1), [o2]));
	constraintSolver.removeObject(o2);	
	ok(equalSets(constraintSolver.immediatelyDependentOn(o1), []));
	
	constraintSolver.addObject(o2);
	constraintSolver.addDependency(o1, o2);
	constraintSolver.addDependency(o2, o3);
	constraintSolver.addDependency(o2, o4);
	ok(equalSets(constraintSolver.immediatelyDependentOn(o2), [o3, o4]));
	constraintSolver.removeObject(o4);
	ok(equalSets(constraintSolver.immediatelyDependentOn(o2), [o3]));
	constraintSolver.addObject(o4);
	constraintSolver.addDependency(o2,o4);
	ok(equalSets(constraintSolver.immediatelyDependentOn(o2), [o3, o4]));
	constraintSolver.removeDependency(o2,o4);
	ok(equalSets(constraintSolver.immediatelyDependentOn(o2), [o3]));
	
	/**/
});

test('Array Diff', function() {
	var diff_func = Euclase._.diff;

	var rv;

	//Equal Arrays
	rv = diff_func([], []);
	deepEqual(rv, {
		removed: [
		],
		added: [
		],
		moved: [
		]
	});

	rv = diff_func([1,2], [1,2]);
	deepEqual(rv, {
		removed: [
		],
		added: [
		],
		moved: [
		]
	});

	//Nodes removed

	rv = diff_func([1], []);
	deepEqual(rv, {
		removed: [
			{
				'index'	: 0,
				'item'	: 1
			},
		],
		added: [
		],
		moved: [
		]
	});

	rv = diff_func([1, 2, 3, 1], [1, 2, 3]);
	deepEqual(rv, {
		removed: [
			{
				'index'	: 3,
				'item'	: 1
			},
		],
		added: [
		],
		moved: [
		]
	});

	//Nodes added
	rv = diff_func([], [1, 2]);
	deepEqual(rv, {
		removed: [
		],
		added: [
			{
				'index'	: 0,
				'item'	: 1
			},
			{
				'index'	: 1,
				'item'	: 2
			},
		],
		moved: [
		]
	});

	rv = diff_func([2], [1, 2, 3]);
	deepEqual(rv, {
		removed: [
		],
		added: [
			{
				'index'	: 0,
				'item'	: 1
			},
			{
				'index'	: 2,
				'item'	: 3
			},
		],
		moved: [
		]
	});

	var diffCheck = function(oldArray, newArray, diff) {
		var old_copy = Euclase._.clone(oldArray);
		diff.removed.forEach(function(removed) {
			Euclase._.remove_index(old_copy, removed.index);
		});
		diff.added.forEach(function(added) {
			Euclase._.insert_at(old_copy, added.item, added.index);
		});
		if(old_copy.length != newArray.length) return false;
		diff.moved.forEach(function(moved) {
			if(moved.item != old_copy[moved.from_index]) throw new Exception("Bug in items");
			Euclase._.set_index(old_copy, moved.from_index, moved.to_index);
		});

		for(var i = 0; i < old_copy.length; i++) {
			if(old_copy[i] != newArray[i]) return false;
		}
		return true;
	};
	

	var doCheck = function(from, to) {
		var diff = diff_func(from, to);
		return diffCheck(from, to, diff);
	};

	ok(doCheck(
		[2,3],
		[2,1,3]));
	ok(doCheck(
		[1,2,3],
		[3,1]));
	ok(doCheck(
		[1,2,3],
		[3,2,1]));
	ok(doCheck(
		[1,2,3],
		[3,1,7,19,1,2,3]));
	ok(doCheck(
		[1,2,3],
		[1,3,1,2]));
	ok(doCheck(
		[1,2,3,4],
		[2,4]));

	/**/
});

test('Update Queues', function() {
	var const_1 = Euclase.create("constant", {value: 1});
	var const_2 = Euclase.create("constant", {value: 2});

	var low_ptr_1 = Euclase.create("pointer", {value: const_1});
	var x = const_1.get();
	var low_ptr_2 = Euclase.create("pointer", {value: const_2});

	var high_ptr = Euclase.create("pointer", {value: low_ptr_1});


	var custom_update_queue = Euclase._update_queue.add_queue();

	var high_ptr_value = null;

	var low_ptr = null;

	var low_ptr_value = null;

	var update_low_ptr;

	custom_update_queue.add(function() {
		var old_low_ptr = low_ptr;
		low_ptr = high_ptr._attr("value");

		if(old_low_ptr != low_ptr) {
			if(update_low_ptr != null) {
				custom_update_queue.remove(update_low_ptr);
			}
			update_low_ptr = custom_update_queue.add(function() {
				low_ptr_value = low_ptr.get();
			});
		}

		high_ptr_value = high_ptr.get();
	});
	equals(high_ptr_value, 1);
	equals(low_ptr_value, 1);

	high_ptr.option("value", low_ptr_2);

	equals(high_ptr_value, 2);
	equals(low_ptr_value, 2);

	Euclase._update_queue.remove(custom_update_queue);
	equals(high_ptr_value, 2);
	high_ptr.option("value", low_ptr_1);
	equals(high_ptr_value, 2);

	Euclase._update_queue.add(custom_update_queue);
	equals(high_ptr_value, 1);

	/**/
});
