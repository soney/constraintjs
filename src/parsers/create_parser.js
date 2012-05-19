var fs = require('fs');
var basename = require('path').basename;
var jison = require('jison');

var read_file = function (fname) {
    return fs.readFileSync(fname, "utf8");
};
var write_file = function (fname, data) {
    fs.writeFileSync(fname, data);
}

exports.create_parser = function(opts) {
	if(Object.prototype.toString.call(opts) !== "[object Object]") { opts = {}; }
	if(!opts.hasOwnProperty("file")) {
		opts.file = false;
	}
	if(!opts.hasOwnProperty("lexfile")) {
		opts.lexfile = false;
	}
	if(!opts.hasOwnProperty("outfile")) {
		opts.outfile = false;
	}
	if(!opts.hasOwnProperty("module_type")) {
		opts.module_type = "js";
	}

	if(opts.file) {
		var raw = read_file(opts.file)
            , name = basename((opts.outfile||opts.file)).replace(/\..*$/g,'')
			, lex;
        raw = raw.replace(/\r\n/g, '\n');
		if(opts.lexfile) {
			lex = read_file(opts.lexfile);
		}

		if(opts.outfile) {
			write_file(opts.outfile, processGrammar(raw, lex, name, opts));
		}
	}
};

function processGrammar(rawGrammar, lex, name, opts) {
    var grammar;
    try {
        grammar = require("jison/lib/jison/bnf").parse(rawGrammar);
    } catch (e) {
        try {
            grammar = JSON.parse(rawGrammar);
        } catch (e2) {
            throw e;
        }
    }
    if (lex) grammar.lex = require("jison/lib/jison/jisonlex").parse(lex);
    if (!opts.moduleName && name) opts.moduleName = name.replace(/-\w/g, function (match){ return match.charAt(1).toUpperCase(); });

    var generator = new jison.Generator(grammar, opts);
    return generator.generateModule(opts);
}
