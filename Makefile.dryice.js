#!/usr/bin/env node

var cjs_inc = require('./include_libs');
var create_parser = require('./src/parsers/create_parser').create_parser;


var do_build_parsers = function() {
	create_parser(true);
};

var do_build_main = function() {
	copy({
		source: cjs_inc.main_src
		, dest: "build/cjs.min.js"
		, filter: copy.filter.uglifyjs
	});
	copy({
		source: cjs_inc.main_src
		, dest: "build/cjs.js"
	});
};

var do_build = function() {
	do_build_parsers();
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
