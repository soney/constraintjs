var nohash_stopwatch = new Stopwatch();
var hash_stopwatch = new Stopwatch();
var obj_stopwatch = new Stopwatch();

var nohash_set_time, hash_set_time, obj_set_time, nohash_lookup_time, hash_lookup_time, obj_lookup_time;

var nohash = cjs.map({
	hash: function(i) {
		return 1;
	}
});
var hash = cjs.map({
	hash: function(i) {
		return i;
	}
});
var obj = {};


var num_items = 100;
var num_lookups = 100;

for(var i = 0; i<num_items; i++) {
	hash_stopwatch.start();
	hash.put(i, "item"+i);
	hash_stopwatch.stop();

	nohash_stopwatch.start();
	nohash.put(i, "item"+i);
	nohash_stopwatch.stop();

	obj_stopwatch.start();
	obj[i] = "item" + i;
	obj_stopwatch.stop();
}

nohash_set_time = nohash_stopwatch.elapsed();
hash_set_time = hash_stopwatch.elapsed();
obj_set_time = obj_stopwatch.elapsed();

for(var i = 0; i<num_lookups; i++) {
	var to_lookup = Math.floor(Math.random() * num_items);
	hash_stopwatch.start();
	if(hash.get(to_lookup) !== "item"+to_lookup) {
		console.log("ERROR");
	}
	hash_stopwatch.stop();

	nohash_stopwatch.start();
	if(nohash.get(to_lookup) !== "item"+to_lookup) {
		console.log("ERROR");
	}
	nohash_stopwatch.stop();

	obj_stopwatch.start();
	if(obj[to_lookup] !== "item"+to_lookup) {
		console.log("ERROR");
	}
	obj_stopwatch.stop();
}
nohash_lookup_time = nohash_stopwatch.elapsed() - nohash_set_time;
hash_lookup_time = hash_stopwatch.elapsed() - hash_set_time;
obj_lookup_time = obj_stopwatch.elapsed() - obj_set_time;

console.log("With hash: " + hash_set_time + " + " + hash_lookup_time + " = " + hash_stopwatch.elapsed());
console.log("Without hash: " + nohash_set_time + " + " + nohash_lookup_time + " = " + nohash_stopwatch.elapsed());
console.log("Object: " + obj_set_time + " + " + obj_lookup_time + " = " + obj_stopwatch.elapsed());
