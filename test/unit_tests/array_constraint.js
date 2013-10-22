module("Array Constraints");

dt("Basic Arrays", 8, function() {
	var arr = cjs([1,2,3]);
	deepEqual(arr.toArray(), [1,2,3]); // simple toArray
	equal(arr.pop(), 3); // Should be the item we removed
	equal(arr.push(3, 4), 4); // should be the length of the array
	deepEqual(arr.map(function(x) { return x+1;}), [2,3,4,5]); // should be an array plus 1
	equal(arr.shift(), 1); // Remove the first item
	equal(arr.length(), 3);
	equal(arr.unshift(0, 1), 5); // return the length
	deepEqual(arr.concat(["other"], cjs(["more", "stuff"])), [0, 1, 2, 3, 4, "other", "more", "stuff"]);
});
