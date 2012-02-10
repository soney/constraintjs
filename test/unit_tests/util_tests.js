module("Util");

test('Graph', function() {
	var graph = cjs.create("graph");

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
