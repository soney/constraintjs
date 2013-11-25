module.exports = function(grunt) {
	var package = grunt.file.readJSON('package.json'), // Project configuration.
		src_files = ["src/util.js", "src/core.js", "src/array.js", "src/map.js", "src/liven.js",
					"src/memoize.js", "src/binding.js", "src/state_machine/cjs_fsm.js",
					"src/state_machine/cjs_events.js", "src/state_machine/cjs_fsm_constraint.js",
					"src/template/jsep.js", "src/template/cjs_parser.js","src/template/cjs_template.js"],
		enclosed_src_files = (["src/header.js"]).concat(src_files, "src/footer.js");

	grunt.initConfig({
		pkg: package,
		jshint: {
			source: {
				src: src_files
			},
			post_concat: {
				src: "build/cjs.js"
			}
		},
		uglify: {
			development: {
				options: {
					banner: '// v<%= pkg.version %>',
					report: 'gzip',
					sourceMapIn: "build/cjs.js.map",
					sourceMap: "build/cjs.min.js.map",
					sourceMappingURL: "cjs.min.js.map"
				},
				src: "build/cjs.js", // Use concatenated files
				dest: "build/cjs.min.js"
			},
			production: {
				options: {
					banner: '//<%= pkg.version %>',
					sourceMap: "build/cjs.min.js.map",
					sourceMappingURL: "cjs.min.js.map",
					sourceMapRoot: '..'
				},
				src: "build/cjs.js", // Use concatenated files
				dest: "build/cjs.min.js"
			}
		},
		concat_sourcemap: {
			options: {
				banner: '/*!<%= pkg.name %> - v<%= pkg.version %> - ' +
						'<%= grunt.template.today("yyyy-mm-dd h:MM:ss TT") %> */\n',
				process: {
					data: {
						version: package.version // the updated version will be added to the concatenated file
					}
				},
				sourceRoot: '..'
			},
			js: {
				src: enclosed_src_files,
				dest: "build/cjs.js"
			}
		},
		concat: {
			options: {
				banner: '/*!<%= pkg.name %> - v<%= pkg.version %> - ' +
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
		qunit: {
			files: ['test/unit_tests.html']
		},
		clean: {
			build: ["build/"]
		},
		watch: {
			test: {
				files: src_files.concat(['test/unit_tests.js', 'test/unit_tests/*.js']),
				tasks: ['jshint:source', 'concat_sourcemap', 'jshint:post_concat', 'qunit']
			},
			quickdev: {
				files: src_files,
				tasks: ['concat_sourcemap']
			},
			full: {
				files: src_files.concat(['test/unit_tests.js', 'test/unit_tests/*.js']),
				tasks: ['jshint:source', 'concat_sourcemap', 'jshint:post_concat', 'qunit', 'uglify']
			}
		},
		compress: {
			production: {
				options: {
					archive: 'ConstraintJS-<%= pkg.version %>.zip'
				},
				files: [{
					expand: true,
					cwd: 'build/',
					src: '*',
					dest: 'cjs'
				}]
			}
		}
	});

	// Load the plugin that provides the "uglify" task.
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-concat-sourcemap');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-qunit');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-compress');

	// Default task(s).
	grunt.registerTask('default', ['jshint:source', 'concat_sourcemap', 'jshint:post_concat', 'qunit', 'uglify:development']);
	grunt.registerTask('dev', ['jshint:source', 'concat_sourcemap', 'jshint:post_concat', 'qunit', 'uglify:development', 'watch:full']);
	grunt.registerTask('quickdev', ['concat_sourcemap', 'watch:quickdev']);
	grunt.registerTask('package', ['clean', 'jshint:source', 'concat', 'jshint:post_concat', 'qunit', 'uglify:production', 'compress']);
};
