module("Utilities");

dt("Array Diff", 9, function() {
	var ad = cjs.arrayDiff([1,2,3], [1,2]);
	equal(ad.removed.length, 1);
	equal(ad.added.length, 0);
	equal(ad.moved.length, 0);

	ad = cjs.arrayDiff([], [1,2]);
	equal(ad.removed.length, 0);
	equal(ad.added.length, 2);
	equal(ad.moved.length, 0);

	ad = cjs.arrayDiff([1, 2,3], [3,2]);
	equal(ad.removed.length, 1);
	equal(ad.added.length, 0);
	equal(ad.moved.length, 1);
});

dt("Array Diff with custom equals", 3, function() {
	var ad = cjs.arrayDiff([{x:1},{x:2},{x:3}], [{x: 3}, {x: 2}], function(a, b) { return a.x === b.x});
	equal(ad.removed.length, 1);
	equal(ad.added.length, 0);
	equal(ad.moved.length, 1);
});

dt("Array Dif with empty items", 1, function() {
	var arr1 = [],
		arr2 = [];
	arr1[2]=arr2[1]='hi';
	deepEqual(cjs.arrayDiff(arr1, arr2), cjs.arrayDiff([undefined, undefined, 'hi'], [undefined, 'hi']));
});
