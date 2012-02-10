#!/usr/bin/env node

var cjs_inc = require('./include_libs');


var do_build_main = function() {
	copy({
		source: cjs_inc.main_src
		, dest: cjs_inc.main_build[0]
		, filter: copy.filter.uglifyjs
	});
};

var do_build = function() {
	do_build_main();
};

var copy = require('dryice').copy;

if(require.main === module) { //Called directly
	console.log("Building...");
	do_build();
	console.log("Done!");
} else { //required
	exports.build = function(callback) {
		do_build();
		if(callback) {
			callback();
		}
	};
}
