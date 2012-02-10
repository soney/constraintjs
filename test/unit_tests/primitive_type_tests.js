module("Primitive Types");

test('Primitive', function() {
	var po1 = Euclase.create("primitive", {key1: 'po1_val1'});
	ok(po1!=null);
	equals(po1.option("key1"), 'po1_val1');

	var po2 = Euclase.create("primitive", {key1: 'po2_val1'});
	ok(po2!=null);
	equals(po1.option("key1"), 'po1_val1');
	equals(po2.option("key1"), 'po2_val1');
	ok(po1.id!=null && po2.id!=null && po1.id!=po2.id);
	/**/
});

test('Constant', function() {
	var val1 = Euclase.create("constant", {value: 1});
	equals(val1.get(), 1);

	var valX = Euclase.create("constant", {value: "X"});
	equals(valX.get(), "X");
});

test('Dict', function() {
	var dict1 = Euclase.create("dict");

	var func = function(){};
	dict1.item("func", func); 
	equals(dict1.item("func"), func);

	var val1 = Euclase.create("constant", {value: 1});


	var valX = "X";
	dict1.item("X", valX);
	equals(dict1.item("X"), "X");

	//var constant = Euclase.create("constant", {value: "X_2"});
	dict1.item("X", "X_2");
	//dict1.item("X", Euclase.create("constant", {value: "X_2"}));
	equals(dict1.item("X"), "X_2");

	var valY = Euclase.create("constant", {value: "Y"});
	dict1.item("Y", valY);
	equals(dict1.item("Y"), "Y");

	var valZ = Euclase.create("constant", {value: "Z"});
	dict1.item("Z", valZ);
	equals(dict1.item("Z"), "Z");

	dict1.clear();
	same(dict1.get_keys(), []);
	/**/
});

test('Dict: Attribute Renaming', function() {
	var dict1 = Euclase.create("dict");

	var val1 = Euclase.create("constant", {value: 1});
	deepEqual(dict1.get_keys(), []);

	ok(!dict1.has_key('a'));
	dict1.item("a", val1);
	ok(dict1.has_key('a'));

	dict1.change_key("a", "b");
	ok(!dict1.has_key('a'));
	ok(dict1.has_key('b'));

	equals(dict1.item('b'), 1);
	dict1.item("b", Euclase.create("constant", {value: 2}));
	ok(dict1.has_key('b'));
	equals(dict1.item("b"), 2);
});

/*
test('Dict: Cloning', function() {
	var dict1 = Euclase._clone_widget("basic");

	dict1.item("x", Euclase.create("object_property", {cell_values: ["'d1'"]}));

	var cloned_dict1 = dict1.clone({
									cell_values: {
											x: ["'x1'"]
									}
								});
	var cloned_dict2 = dict1.clone();
});
	/**/

test('Array', function() {
	var arr1 = Euclase.create("dict");

	//Empty array...length 0
	equals(arr1.get_length(), 0);

	
	var val1 = Euclase.create("constant", ({value: 0}));

	//Push a new value into the array
	arr1.push(val1);
	
	//The length should be 1 and the 0th item should be the item we just pushed in
	equals(arr1.get_length(), 1);
	ok(arr1.raw_item(0)===val1);

	//Now, remove the 0th item
	arr1.unset_item(0);
	
	//...the length should be back to 0
	equals(arr1.get_length(), 0);
	
	//Impressive.
	//I know, right!
	//Ok, set item with index 10

	arr1.item(10, val1);
	
	//The length should be 11
	equals(arr1.get_length(), 11);
	//And the 10th item should be what we put in
	ok(arr1.raw_item(10)===val1);
	
	//Now, if we remove the 10th item...
	arr1.unset_item(10);
	//The length should be back to 0
	equals(arr1.get_length(), 0);
	
	//If we put something into slots 50,100
	arr1.item(100, Euclase.create("constant", {value: 100}));
	arr1.item(50 , Euclase.create("constant", {value: 50}));
	
	//The length should be 101
	equals(arr1.get_length(), 101);

	//when we remove the item in slot 100...
	arr1.unset_item(100);
	
	//...the length should just go down to 51 (because the item in slot 50)
	equals(arr1.get_length(), 51);
	
	//Adding another object onto the end...
	arr1.push(val1);
	//Should up the length by 1
	equals(arr1.get_length(), 52);
	ok(arr1.raw_item(51)===val1);
	
	var val0 = Euclase.create("constant", {value: 0});
	var val1 = Euclase.create("constant", {value: 1});
	var val2 = Euclase.create("constant", {value: 2});
	var val3 = Euclase.create("constant", {value: 3});
	
	arr1.clear();
	equals(arr1.get_length(), 0);
	
	arr1.push(val0);
	arr1.push(val1);
	arr1.push(val2);
	arr1.push(val3);
	
	arr1.insert(0, Euclase.create("constant", {value: "Butting in at the front"}));
	equals(arr1.item(0), "Butting in at the front");
	ok(arr1.raw_item(1)===val0);
	arr1.insert(3, Euclase.create("constant", {value: "Butting in at third"}));
	equals(arr1.item(3), "Butting in at third");
	ok(arr1.raw_item(2)===val1);
	ok(arr1.raw_item(4)===val2);
	equals(arr1.get_length(), 6);
	arr1.insert(6, Euclase.create("constant", {value: "Butting in at last"}));
	equals(arr1.item(6), "Butting in at last");
	ok(arr1.raw_item(4)===val2);
	equals(arr1.get_length(), 7);
	
	arr1.unset_item(3);
	arr1.unset_item(5);
	arr1.unset_item(0);
	
	arr1.clear();
	arr1.insert(0, val1);
	
	//The length should be 1 and the 0th item should be the item we just pushed in
	equals(arr1.get_length(), 1);
	ok(arr1.raw_item(0)===val1);
});

test('Dict Filters', function() {
	var arr1 = Euclase.create("dict");
	arr1.push(5);
	arr1.push(2);
	arr1.push(7);
	arr1.push(4);
	var even_numbers = arr1.filter(function(value) {
		return value%2 === 0;
	});
	deepEqual(even_numbers.to_array(), [2,4]);
	arr1.push(18);
	deepEqual(even_numbers.to_array(), [2,4,18]);
	arr1.item(0, 0);
	deepEqual(even_numbers.to_array(), [0, 2,4,18]);
});

test('Dict Map', function() {
	var basis = Euclase.create("dict");
	basis.push(1);
	var create_called = 0;
	var destroy_called = 0;
	var map = Euclase.create("dict_map", {
		source: basis
		, create_item: function(x) {
			create_called++;
			return x+1;
		}
		, destroy_item: function(x) {
			destroy_called++;
		}
	});
	equals(map.item(0), 2);
	equals(create_called, 1);
	basis.push(2);
	equals(map.item(0), 2);
	equals(map.item(1), 3);
	equals(create_called, 2);

	equals(destroy_called, 0);
	basis.unset_item(0);
	equals(map.item(0), 3);
	equals(destroy_called, 1);
	equals(create_called, 2);
});
