<p align="center">
  <img src='http://cjs.from.so/resources/cjs_logo_256.png' style='width:100px' alt='ConstraintJS' />
</p>

### Documentation
For documentation or the full ConstraintJS API, visit [cjs.from.so/](http://cjs.from.so/ "ConstraintJS Website").

### Downloads
 * [Latest stable release](https://github.com/soney/constraintjs/releases/latest "Latest stable release")
 * [Latest beta release](https://raw.github.com/soney/constraintjs/master/build/cjs.js "Latest beta release") (not recommended)

### Building from source
If you'd rather build from this repository, you must install [node.js](http://nodejs.org/ "node.js") and [Grunt](http://gruntjs.com/installing-grunt, "Grunt"). Then, from inside the constraintjs source directory, run:

	npm install .
	grunt

The CJS Library will appear in the *build/* directory.

### Notes on Development
Make changes to the files in *src/* instead of *build/*. After you change a file, be sure to run `grunt` to re-build the files in *build/*. By default, the sourcemap generated for *build/cjs.min.js* links to the  *build/cjs.js* file. To build a sourcemap that links back to the original *src/* files (significantly more useful for development), change `grunt` in the instructions above to `grunt dev`:

	npm install .
	grunt dev
