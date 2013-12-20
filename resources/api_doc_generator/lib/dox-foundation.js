/*!
* Load Dependancies
*/
var fs = require('fs'),
	path = require('path'),
	jade = require('jade'),
	dox = require('./dox'),
	_ = require('underscore'),
	template;

/**
* Template used to produce the documentation
*/
var templatePath = exports.templatePath = '../views/template.jade';

/**
* Return a list of methods for the side navigation
*
* @param {Object} file
* @return {Object} Object formatted for template nav helper
* @api private
*/
function buildStructureForFile(file) {
	var names = [];
	var targetLink;

	if (file.dox.length === 0) { return false; }

	file.dox.forEach(function(method){
		if (method.ctx && !method.ignore) { names.push(method.ctx.name); }
	});

	// How deep is your love?
	// If the splitted currentFile (the file we are currently rendering) path got one folder
	// in the path or more, add ../ for each level found
	if(file.currentFile && file.currentFile.split(path.sep).length > 1 ){
		// Depth of current file
		var depth = file.currentFile.split(path.sep).length,
		// Create a prefix with n "../"
		prefix = new Array(depth).join('../');
		// Set up target link with prefix
		targetLink = prefix + file.targetFile;
	} else {
		// Link does not have to be altered
		targetLink = file.targetFile;
	}

	return {
		source: {
			full: file.sourceFile,
			dir: path.dirname(file.sourceFile),
			file: path.basename(file.sourceFile)
		},
		target: file.targetFile,
		methods: names,
		link : targetLink
	};
}

var BRANCH = "v091",
	BASE_URL = "https://github.com/soney/ConstraintJS/blob/v0.9.1/";
var get_link = function(fname, line) {
	var rv = BASE_URL+fname+"#L"+line;
	return rv;
};

var get_doc = function(doc_info) {
	var info = {
			type: false,
			info: false,
			params: [],
			return: false,
			links: [],
			examples:[]
		},
		fname = doc_info.file,
		doc = doc_info.doc,
		link = get_link(fname, doc.line);
	info.link = link;
	info.fname = fname.replace("../src/", "");
	info.line = doc.line;

	if(doc.description) { info.description = doc.description.full; }

	doc.tags.forEach(function(tag) {
		var type = tag.type;
		if(type === 'method' || type === 'class' || type === 'property') {
			info.type = type;
		} else if(tag.type === "param") {
			info.params.push(tag);
		} else if(tag.type === "return") {
			info.returns = tag;
		} else if(tag.type === "see") {
			info.links.push(tag.name);
		} else if(tag.type === "private") {
			info.private = true;
		} else if(tag.type === "expose") {
			info.exposed = true;
		} else if(tag.type === "example") {
			info.examples.push(tag.code);
		} else {
			//console.log(tag);
		}
	});

	return info;
};

/**
* Parse source code to produce documentation
*/
exports.render = function(stack, options) {
	options          = options || { title: 'Documentation' };
	templatePath     = path.resolve(__dirname, templatePath);
    template         = fs.readFileSync(templatePath).toString();
	var docs = [];
	options.docs = docs;

	stack.forEach(function(item) {
		var info;
		var num_descs = 0;
		item.docs.forEach(function(doc) {
			if(doc.description) { num_descs++; }
		});

		info = {
			name: item.name,
			level: item.level,
			subinfos: item.docs.map(function(x) { return get_doc(x, item.name, item.level); }),
			isMultiple: item.docs.length === 1,
			sourceLinks: [],
			examples: []
		};

		var has_source = false;
		info.subinfos.forEach(function(si) {
			var type = si.type;
			if(type === 'method' || type === 'class' || type === 'property') {
				info.type = type;
			}

			if(si.exposed) {
				info.sourceLinks.push({text:"(Exposed: "+si.fname+":"+si.line+")", link: si.link});
			} else {
				if(!has_source) {
					info.sourceLinks.push({text:"Source: "+si.fname+":"+si.line+"", link: si.link});
				}
				has_source = true;
			}
			info.examples.push.apply(info.examples, si.examples);
		});

		docs.push(info);
	});
	return jade.compile(template, { filename: templatePath })(options);
};

/**
* Test if a method should be ignored or not
*
* @param  {Object} method
* @return {Boolean} true if the method is not private nor must be ignored
* @api private
*/
exports.shouldPass = function(method) {
	if(method.isPrivate) {return false;}
	if(method.ignore) {return false;}

	return method.tags.filter(function(tag){
		return tag.type === "private" || tag.type === "ignore";
	}).length === 0;
};

/*
* Create an array of all the right files in the source dir
*/
exports.collectFiles = function(source, options, callback) {
	var dirtyFiles = [],
	ignore  = options.ignore || [],
	files   = [];

	// If more paths are given with the --source flag
	if(source.split(',').length > 1){
		var dirtyPaths = source.split(',');

		dirtyPaths.forEach(function(dirtyPath){
			dirtyFiles = dirtyFiles.concat(require('walkdir').sync(path.resolve(process.cwd(), dirtyPath),{follow_symlinks:true}));
		});
	}
	// Just one path given with the --source flag
	else {
		source  = path.resolve(process.cwd(), source);
		dirtyFiles = require('walkdir').sync(source,{follow_symlinks:true}); // tee hee!
	}

	dirtyFiles.forEach(function(file){
		file = path.relative(process.cwd(), file);

		var doNotIgnore = _.all(ignore, function(d){
			// return true if no part of the path is in the ignore list
			return (file.indexOf(d) === -1);
		});

		if ((file.substr(-2) === 'js') && doNotIgnore) {
			files.push(file);
		}
	});

	return files;
};

/*
* Dox all the files found by collectFiles
*/
exports.doxFiles = function(source, target, options, files) {
	var source_to_return;
	files = files.map(function(file) {
		try {
			// If more paths are given with the --source flag
			if(source.split(',').length >= 1){
				var tmpSource = source.split(',');

				tmpSource.forEach(function(s){
					if(file.indexOf(s) !== -1) {
						source_to_return = s;
					}
				});
			} else {
				source_to_return = source;
			}

			var content = fs.readFileSync(file).toString();

			return {
				sourceFile: file,
				targetFile: path.relative(process.cwd(),target) + path.sep + file + '.html',
				dox:        dox.parseComments(content, options)
			};

		} catch(e) { console.log(e); }
	});

	return files;
};

exports.compileDox = function(files) {
	var subjects = {};
	files.forEach(function(file) {
		var srcFile = file.sourceFile,
			dox = file.dox, lends = "";
		dox.forEach(function(d) {
			delete d.code;
			d.tags.forEach(function(tag) {
				var type = tag.type;
				var info = {doc: d, file: file.sourceFile};
				if(type === "method" || type === "property") {
					var name = lends + (tag.name || tag.string).replace(/\^\d+$/, "");
					if(name[0] === "{") {
						console.log(d);
					}

					if(subjects.hasOwnProperty(name)) {
						subjects[name].push(info);
					} else {
						subjects[name] = [info];
					}
				} else if(type === "lends") {
					lends = tag.string.length > 0 ? tag.string+"." : "";
				} else if(type === "expose" || type==="class") {
					var name = tag.string;
					if(subjects.hasOwnProperty(name)) {
						subjects[name].push(info);
					} else {
						subjects[name] = [info];
					}
				} else if(type === "see") {
					tag.name = lends+tag.local;
				} else {
				}
			});
		});
	});
	var tree = {};
	var keys = [];
	for(var key in subjects) {
		if(subjects.hasOwnProperty(key)) {
			keys.push(key);
		}
	}
	keys = keys.sort(function(a, b) {
		return a.split(".").length - b.split(".").length;
	});
	//sort by levels
	keys.forEach(function(key) {
		var objs = key.split(".");
		var ctree = tree;
		objs.forEach(function(obj, i) {
			if(i === objs.length-1) {
				ctree[obj] = {"@docs": subjects[key]};
			} else {
				if(ctree.hasOwnProperty(obj)) {
					ctree = ctree[obj];
				} else {
					ctree = ctree[obj] = {};
				}
			}
		});
	});

	var stack = [];
	console.log(tree);
	var recursiveAdd = function(tree, curr_stack) {
		if(curr_stack.length > 0) {
			var name = curr_stack.join(".");
			var docs = tree["@docs"];
			var no_protos = curr_stack.filter(function(x) { return x !== "prototype";});
			if(docs && docs.length > 0) {
				stack.push({name: name, docs: docs, level: no_protos.length});
			}
		}
		var keys = [];
		for(var key in tree) {
			if(key !== "@docs" && tree.hasOwnProperty(key)) {
				keys.push(key);
			}
		}
		keys = keys.sort();
		keys.forEach(function(key) {
			recursiveAdd(tree[key], curr_stack.concat(key));
		});
	};
	recursiveAdd(tree, []);
	return stack;
};
