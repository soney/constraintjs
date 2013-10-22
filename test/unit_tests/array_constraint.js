module("Array Constraints");

dt("Basic Arrays", 20, function() {
	var arr = cjs([1,2,3]);
	deepEqual(arr.toArray(), [1,2,3]); // simple toArray
	equal(arr.pop(), 3); // Should be the item we removed
	equal(arr.push(3, 4), 4); // should be the length of the array
	deepEqual(arr.map(function(x) { return x+1;}), [2,3,4,5]); // should be an array plus 1
	equal(arr.shift(), 1); // Remove the first item
	equal(arr.length(), 3);
	equal(arr.unshift(0, 1), 5); // return the length
	deepEqual(arr.concat(["other"], cjs(["more", "stuff"])), [0, 1, 2, 3, 4, "other", "more", "stuff"]);
	deepEqual(arr.splice(1, 2, "x"), [1,2]);
	deepEqual(arr.toArray(), [0, "x", 3, 4]);
	deepEqual(arr.splice(1, 2, "x", "y", "z"), ["x", 3]);
	deepEqual(arr.toArray(), [0, "x", "y", "z", 4]);

	arr.setValue(["A", "B", "A", "B"]);
	equal(arr.indexOf(0), -1);
	equal(arr.indexOf("A"), 0);
	equal(arr.lastIndexOf("A"), 2);
	equal(arr.some(function(x) { return x === "B"; }), true);
	equal(arr.every(function(x) { return x === "B"; }), false);
	deepEqual(arr.slice(2), ["A", "B"]);
	deepEqual(arr.length(), 4);
	equal(arr.join(", "), "A, B, A, B");
	arr.destroy();
	arr = null;
});

dt("Unsubstantiated Array Items", 4, function() {
	var arr = cjs([1, 2, 3]);
	var third_item = cjs(function() { return arr.item(2); });
	var fourth_item = cjs(function() { return arr.item(3); });
	equal(third_item.get(), 3);
	equal(fourth_item.get(), undefined);
	arr.splice(0, 0, 0);
	equal(third_item.get(), 2);
	equal(fourth_item.get(), 3);
});
