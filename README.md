##ConstraintJS
[cjs.from.so/](http://cjs.from.so/ "ConstraintJS Website")


### Building from source
First, install [Grunt](http://gruntjs.com/installing-grunt, "Installing Grunt"). Then, from inside the cjs source directory, run:

	npm install .
	grunt

The CJS Library will appear in the *build/* directory.

### Notes on Development
Changes should be made to the files in *src/*; ***NOT*** the files in *build/*. By default, the sourcemap generated for *cjs.min.js* links to the  *build/cjs.js* file. To build a version that links back to the original *src/* files, add an extra parameter to `grunt`:

	grunt dev
