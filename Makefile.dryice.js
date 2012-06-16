#!/usr/bin/env node

var args = process.argv.slice(2)
var command = args[0];

if(!command) {
	command = "build";
}

var cjs_inc = require('./include_libs');

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
	do_build_main();
};

var copy = require('dryice').copy;

if(require.main === module) { //Called directly
	if(command === "build") {
		console.log("Building...");
		do_build();
		console.log("Done!");
	} else if(command === "dist") {
		//http://stackoverflow.com/questions/5754153/zip-archives-in-node-js
		var spawn = require('child_process').spawn
			, fs = require('fs');

		var package_info = JSON.parse(fs.readFileSync("package.json")); 
		var version = package_info.version;
		var filename = "dist/cjs_"+version+".zip";
		var zip = spawn('zip', ['-rj', filename, "build/cjs.js", "build/cjs.min.js"], {cwd: __dirname});
		zip.on('exit', function (code) {
			if(code !== 0) {
				console.log('zip process exited with code ' + code);
			}
		});
	}
} else { //required
	exports.build = function(callback) {
		do_build();
		if(callback) {
			callback();
		}
	};
}
