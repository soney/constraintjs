/*
 * grunt-dox
 * https://github.com/punkave/grunt-dox
 *
 * Copyright (c) 2013 Matt McManus
 * Licensed under the MIT license.
 */

var exec = require('child_process').exec,
	fs = require('fs'),
	mkdirp = require('mkdirp'),
	path = require('path'),
	rimraf = require('rimraf'),
    formatter = require('../lib/dox-foundation'),
	ignoredDirs = 'test,static,templates,node_modules';

module.exports = function(grunt) {
	grunt.registerMultiTask('dox', 'Generate dox output ', function() {
		var src = this.filesSrc,
			dest = this.data.dest,
			indexPath = path.relative(process.cwd(), dest + path.sep + 'index.html'),
			ignore = ignoredDirs.trim().replace(' ', '').split(','),
			options = this.options();

		// Cleanup any existing docs
		rimraf.sync(dest);

		// Find, cleanup and validate all potential files
		var files		= formatter.collectFiles(src, { ignore: ignore }, files),
			doxedFiles	= formatter.doxFiles(src, dest, { raw: false }, files),
			dox			= formatter.compileDox(doxedFiles, options),
			output		= formatter.render(dox, options),
			dir			= path.dirname(indexPath);

		if (!fs.existsSync(dir)) {
			mkdirp.sync(dir);
		}
		fs.writeFileSync(indexPath, output);
	});
};
