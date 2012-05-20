#!/usr/bin/env node

var devel_mode = true;

var express = require('express');
var fs = require('fs');
var ejs = require('ejs');
var cjs_inc = require('./include_libs');

var app = express.createServer();
if(devel_mode) {
	cjs_inc.main = cjs_inc.main_src;
} else {
	cjs_inc.main = cjs_inc.main_build;
}
var text_after = function(str, portion) {
	var index = str.lastIndexOf(portion);
	if(index >= 0) {
		return str.slice(index + portion.length);
	} else {
		return null;
	}
};
var text_before = function(str, portion) {
	var index = str.lastIndexOf(portion);
	if(index >= 0) {
		return str.substring(0, index + portion.length);
	} else {
		return null;
	}
};

var callback_map = function(arr, func, callback) {
	var rv = [];
	var waiting_for = arr.length;
	arr.forEach(function(item, index) {
		func(item, function(mapped) {
			rv[index] = mapped;
			waiting_for--;
			if(waiting_for <= 0) {
				callback(rv);
			}
		});
	});
};
var jslint_options = { //http://www.jslint.com/lint.html
	sloppy: true // true if the ES5 'use strict'; pragma is not required. Do not use this pragma unless you know what you are doing.
	, vars: true // true if multiple var statement per function should be allowed.
	, nomen: true // true if names should not be checked for initial or trailing underbars.
	, white: true // true if strict whitespace rules should be ignored.
	, plusplus: true // true if ++ and -- should be allowed.
	, predef: ["cjs", "module", "exports"]
};

app.configure(function() {
	app.use(app.router);
	app.use(express.static(__dirname));


	app.get("*/list_files*", function(req, res, next) {
		var path = req.query.path;
		fs.readdir(path, function(err, files) {
			if(err) {
				var files_str = JSON.stringify({errno: err.errno});
				res.writeHead(200, {
					  'Content-Type': 'text/plain'
					, 'Content-Length': files_str.length
				});
				res.end(files_str);
			} else {
				var files_str = JSON.stringify(files);
				res.writeHead(200, {
					  'Content-Type': 'text/plain'
					, 'Content-Length': files_str.length
				});
				res.end(files_str);
			}
		});
	});
	app.get("*/file_type*", function(req, res, next) {
		var path = req.query.path;
		fs.stat(path, function(err, stats) {
			if(err) {
				var files_str = JSON.stringify({errno: err.errno});
				res.writeHead(200, {
					  'Content-Type': 'text/plain'
					, 'Content-Length': files_str.length
				});
				res.end(files_str);
			} else {
				var type_str;
				if(stats.isDirectory()) {
					type_str = "directory";
				} else  {
					type_str = "file";
				}
				res.writeHead(200, {
					  'Content-Type': 'text/plain'
					, 'Content-Length': type_str.length
				});
				res.end(type_str);
			}
		});
	});
	app.get("*/command/*", function(req, res, next) {
		var command = text_after(req.originalUrl, "/command/");
		var do_confirm = function() {
			var body = "done";
			res.writeHead(200, {
				  'Content-Type': 'text/html'
				, 'Content-Length': body.length
			});
			res.end(body);
		};
		if(command==="recompile") {
			var dev_mode = cjs_inc.main === cjs_inc.main_src;
			delete require.cache[__dirname+'/include_libs.js']
			cjs_inc = require(__dirname + '/include_libs');
			delete require.cache[__dirname+'/Makefile.dryice.js']
			var makefile = require("./Makefile.dryice");
			cjs_inc.main = dev_mode ? cjs_inc.main_src : cjs_inc.main_build;
			makefile.build(do_confirm);
		} else if(command === "refresh_include") {
			var dev_mode = cjs_inc.main === cjs_inc.main_src;
			delete require.cache[__dirname+'/include_libs.js']
			cjs_inc = require(__dirname + '/include_libs');
			cjs_inc.main = dev_mode ? cjs_inc.main_src : cjs_inc.main_build;
			do_confirm();
		} else if(command === "make_src_mode") {
			cjs_inc.main = cjs_inc.main_src;
			do_confirm();
		} else if(command === "make_build_mode") {
			cjs_inc.main = cjs_inc.main_build;
			do_confirm();
		}
	});

	app.get("*.ejs.html*|/", function(req, res, next) {
		var relative_url = req.originalUrl.slice(1); //remove the initial '/'
		var filename;
		if(relative_url === "") {
			filename = "index.ejs.html";
		} else {
			filename = text_before(relative_url, ".ejs.html");
		}

		get_file_string(filename, function(str) {
			if(!str) {
				next();
			} else {
				var num_slashes = (relative_url.split('/').length-1);
				var relative_path = "";
				for(var i = 0; i<num_slashes; i++) {
					relative_path += "../";
				}
				var locals = {
					include: function(files) {
						return cjs_inc.include_templates(files.map(function(file) {
							return relative_path+file;
						}));
					}
					, cjs_inc: cjs_inc
					, dev_mode: cjs_inc.core === cjs_inc.src
				};

				if(filename.indexOf("jslint")>=0) {
					var jslint = require("jslint/lib/nodelint");
					var errors_only = true;
					var lintFile = function(file, options, callback) {
						fs.readFile(file, function (err, data) {
							if (err) {
								throw err;
							}
							data = data.toString("utf8");

							jslint(data, options);
							var report = jslint.report(errors_only);
							if(callback) {
								callback(report);
							}
						});
					};
					var files = req.query.filename ? [req.query.filename] : cjs_inc.main_src;
					callback_map(files, function(file_name, good_callback) {
						lintFile(file_name, jslint_options, function(report) {
							good_callback(report);
						});
					}, function(rv) {
						locals.reports = rv.map(function(report, index) {
							return {
								file: files[index]
								, lint: report
							};
						});

						body = ejs.render(str, {locals: locals});
						res.writeHead(200, {
							  'Content-Type': 'text/html'
							, 'Content-Length': body.length
						});
						res.end(body);
					});
					return;
				}
				
				var body = ejs.render(str, {locals: locals});
				res.writeHead(200, {
					  'Content-Type': 'text/html'
					, 'Content-Length': body.length
				});
				res.end(body);
			}
		});
	});
});

var makefile = require("./Makefile.dryice");
makefile.build(function() {
	app.listen(8000);
	console.log("Interactive times at http://localhost:8000/");
	process.on('SIGINT', function () {
		console.log("iao...");
		process.exit(0);
	});
});

var render_files = function(res, files) {
	concat_files(files, function(str) {
		res.writeHead(200, {
		  'Content-Length': str.length,
		  'Content-Type': 'text/javascript' });
		res.end(str);
	});
};

var concat_files = function(file_list, callback) {
	if(typeof file_list === "string") file_list = [file_list];
	var current_index = 0;
	var rv = "";
	var get_curr = function() {
		get_file_string(file_list[current_index], function(str) {
			rv += str;
			current_index++;
			if(current_index >= file_list.length) {
				callback(rv);
			} else {
				get_curr();
			}
		});
	};
	get_curr();
};

var get_file_string = function(path, callback) {
	fs.readFile(path, 'ascii', function(err, data) {
		callback(data);
	});
};
