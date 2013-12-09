module("Utils");

dt("Array Diff", 9, function() {
	var ad = cjs.arrayDiff([1,2,3], [1,2]);
	equal(ad.removed.length, 1);
	equal(ad.added.length, 0);
	equal(ad.moved.length, 0);

	//ad = cjs.array_diff([1,2,3], [1,2]);
	equal(ad.removed.length, 1);
	equal(ad.added.length, 0);
	equal(ad.moved.length, 0);

	//ad = cjs.array_diff([1,2,3], [1,2]);
	equal(ad.removed.length, 1);
	equal(ad.added.length, 0);
	equal(ad.moved.length, 0);
	//console.log(ad);
});
