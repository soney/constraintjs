module.exports = function(grunt) {
	var package = grunt.file.readJSON('package.json'); // Project configuration.

	var src_files = ["src/util.js", "src/core.js", "src/array.js", "src/map.js", "src/liven.js", "src/memoize.js"];
	var enclosed_src_files = (["src/header.js"]).concat(src_files, "src/footer.js");

	grunt.initConfig({
		pkg: package,
		jshint: {
			build: {
				src: src_files
			}
		},
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
						'<%= grunt.template.today("yyyy-mm-dd h:MM:ss TT") %> */\n',
				report: 'gzip'
			},
			build: {
				src: "build/cjs.js", // Use concatenated files
				dest: "build/cjs.min.js"
			}
		},
		concat: {
			options: {
				banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
						'<%= grunt.template.today("yyyy-mm-dd h:MM:ss TT") %> */\n',
				process: {
					data: {
						version: package.version // the updated version will be added to the concatenated file
					}
				}
			},
			js: {
				src: enclosed_src_files,
				dest: "build/cjs.js"
			}
		},
		clean: {
			build: ["build/"]
		}
	});

	// Load the plugin that provides the "uglify" task.
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-clean');

	// Default task(s).
	grunt.registerTask('default', ['concat', 'jshint', 'uglify']);
	grunt.registerTask('test', ['concat', 'jshint']); // Skip uglification if just testing
};
