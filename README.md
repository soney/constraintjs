##ConstraintJS
For documentation or the full ConstraintJS API, visit the ConstraintJS website: [cjs.from.so/](http://cjs.from.so/ "ConstraintJS Website")

### Using
Use the download link on the [ConstraintJS website](http://cjs.from.so/ "ConstraintJS Website") to download the latest stable release.

### Building from source
If you'd rather build from this repository, you must install [node.js](http://nodejs.org/, "node.js") and [Grunt](http://gruntjs.com/installing-grunt, "Installing Grunt"). Then, from inside the constraintjs source directory, run:

	npm install .
	grunt

The CJS Library will appear in the *build/* directory.

### Notes on Development
Changes should be made to the files in *src/*; ***NOT*** the files in *build/*. By default, the sourcemap generated for *cjs.min.js* links to the  *build/cjs.js* file. To build a version that links back to the original *src/* files, add an extra parameter to `grunt`:

	grunt dev
