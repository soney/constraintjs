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

var BASE_URL = "https://github.com/soney/ConstraintJS/blob/";
var get_link = function(fname, line, blob_name) {
	var rv = BASE_URL+blob_name+'/'+fname+"#L"+line;
	return rv;
};

var get_doc = function(doc_info, options) {
	var info = {
			type: false,
			info: false,
			params: [],
			links: [],
			examples:[]
		},
		fname = doc_info.file,
		doc = doc_info.doc,
		link = get_link(fname, doc.line, options.blob_name);
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
exports.render = function(docs, options) {
	templatePath = path.resolve(__dirname, templatePath);
	var template	 = fs.readFileSync(templatePath).toString(),
		options		 = _.extend({
							docs: docs
						}, options);
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
	if(source.length >= 1){
		var dirtyPaths = source;

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

		var doNotIgnore = _.all(ignore, function(d) {
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
			if(source.length >= 1){
				var tmpSource = source;

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

exports.compileDox = function(files, options) {
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
					tag.link = tag.name.replace(".", "_");
				} else {
				}
			});
		});
	});

	var tree = {children: []};
	var keys = [];
	for(var key in subjects) {
		if(subjects.hasOwnProperty(key)) {
			keys.push(key);
		}
	}

	keys = keys.sort(function(a, b) {
		var diff = a.split(".").length - b.split(".").length;
		if(diff === 0) {
			var pna = _.last(a.split(".")),
				pnb = _.last(b.split("."));

			if(pna[0].toLowerCase() !== pna[0] && pnb[0].toLowerCase() === pnb[0]) {
				return 1;
			} else if(pna[0].toLowerCase() === pna[0] && pnb[0].toLowerCase() !== pnb[0]) {
				return -1;
			}
			return a.localeCompare(b);
		} else {
			return diff;
		}
	});

	//sort by levels
	keys.forEach(function(key) {
		var objs = key.replace(".prototype", "").split("."),
			ctree = tree,
			info = get_doc_info(subjects[key], options);

		var level = 0;
		objs.forEach(function(obj, i) {
			var index = _	.chain(ctree.children)
							.pluck("propname")
							.indexOf(obj)
							.value();
			//console.log(index);
			if(index < 0) {
				var new_tree = {name: key, propname: obj, children: []};
				ctree.children.push(new_tree);
				ctree = new_tree;
			} else {
				ctree = ctree.children[index];
			}
			level++;
		});

		if(info.type === 'method' || info.type === 'class') {
			ctree.short_colloquial =  ctree.propname.replace('.prototype', '')+'()';
			if(info.calltypes.length === 1) {
				ctree.colloquial = ctree.name + '(' + info.calltypes[0].params.map(function(x) { return x.name; }).join(', ') + ')';
			} else {
				ctree.colloquial = ctree.name + '(...)';
			}
			if(info.type === 'class') {
				ctree.colloquial = 'new ' + ctree.colloquial;
			}
		} else {
			ctree.short_colloquial = ctree.propname.replace('.prototype', '');
			ctree.colloquial = ctree.name.replace('.prototype', '');
		}
		ctree.short = ctree.name.indexOf(".")<0 ? ctree.name : "."+_.last(ctree.name.split("."));

		_.extend(ctree, info);
	});
	if(tree.children.length === 1) {
		tree = tree.children[0];
	}

	return tree;
};

var get_doc_info = function(docs, options) {
	var subinfos = docs.map(function(x) { return get_doc(x, options); }),
		info = {
			calltypes: [],
			description: "",
			type: "",
			sourceLinks: [],
			links: [],
			examples: []
		},
		has_source = false;

	_.each(subinfos, function(si) {
		if(si.returns || si.params.length>0) {
			info.calltypes.push(si);
		}
		if(si.description && (si.description.length > info.description.length)) {
			info.description = si.description;
		}
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
		info.links.push.apply(info.links, si.links);
		info.examples.push.apply(info.examples, si.examples);
	});


	return info;
};
