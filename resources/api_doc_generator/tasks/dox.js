/*
 * grunt-dox
 * https://github.com/punkave/grunt-dox
 *
 * Copyright (c) 2013 Matt McManus
 * Licensed under the MIT license.
 */

var exec = require('child_process').exec,
    fs = require('fs'),
    path = require('path'),
    rimraf = require('rimraf');


module.exports = function(grunt) {

  grunt.registerMultiTask('dox', 'Generate dox output ', function() {

    var dir = this.filesSrc,
        dest = this.data.dest,
        done = this.async(),
        doxPath = path.resolve(__dirname,'../'),
        _opts = this.options(),
        _args = [];

    // Absolute path to the formatter
    var formatter = [doxPath, 'bin', 'dox-foundation'].join(path.sep);

    // Cleanup any existing docs
    rimraf.sync(dest);

    _args.push('--source');
    _args.push(dir);
    _args.push('--target');
    _args.push(dest);

    // Set options to arguments
    if(_opts.title){
      _args.push('--title');
      _args.push('"' + _opts.title + '"');
    }

    // Pass through ignore params if set
    if (this.data.ignore) {
      _args.push('--ignore');
      this.data.ignore.forEach(function(ignorePath) {
        _args.push(doxPath + ignorePath);
      });
      
    }

    exec(formatter + ' ' + _args.join(" "), {maxBuffer: 5000*1024}, function(error, stout, sterr){
      if (error) { grunt.log.error("ERROR:  "+ error); }
      if (!error) {
        grunt.log.ok('Directory "' + dir + '" doxxed.');
        done();
      }
    });
  });

};
