var fs = require("fs");

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
		opts.module_type = "commonjs";
	}

	if(opts.file) {
		var raw = read_file(opts.file)
			, lex;
        raw = raw.replace(/\r\n/g, '\n');
		if(opts.lexfile) {
			lex = read_file(opts.lex_file);
		}

		if(opts.outfile) {
			write_file(processGrammar(raw, lex, opts.outfile));
		}
	}
};

function processGrammar(rawGrammar, lex, name) {
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
    var opt = grammar.options || {};
    if (lex) grammar.lex = require("jison/lib/jison/jisonlex").parse(lex);
    opt.debug = args.debug;
    if (!opt.moduleType) opt.moduleType = args.moduleType;
    if (!opt.moduleName && name) opt.moduleName = name.replace(/-\w/g, function (match){ return match.charAt(1).toUpperCase(); });

    var generator = new JISON.Generator(grammar, opt);
    return generator.generate(opt);
}
