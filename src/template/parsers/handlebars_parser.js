(function(cjs) {
//Based on Mu's parser: https://github.com/raycmorgan/Mu
var _ = cjs._;

//These are nodes that don't have to be closed.
// For instance: 
// {{#diagram d}}
//	{{#state A}} a
//	{{#state B}} b
// {{/diagram}}
//
// doesn't require closing {{#state}}
var unclosed_nodes = {
	"diagram": {
		sub_nodes: ["state"]
	}
	, "if": {
		sub_nodes: ["elif", "else"]
	}
};

// Dictates what parents children must have; state must be a direct descendent of diagram
var parent_rules = {
	"state": {
		parent: "diagram"
		, direct: true
	}
};

// elsif and else must come after either if or elsif
var sibling_rules = {
	"elif": {
		follows: ["if", "elif"] //what it may follow
		, direct: true //that it must directly follow
		, or_parent: ["if"] //or the parent can be 'if'
	}
	, "else": {
		follows: ["if", "elif"]
		, direct: true
		, or_parent: ["if"]
	}
};


cjs.__parsers.handlebars = function (template, options) {
	var parser = new Parser(template, options);
	return parser.tokenize();
};

var carriage = '__CJS_CARRIAGE__'
	, carriageRegExp = new RegExp(carriage, 'g')
	, newline = '__CJS_NEWLINE__'
	, newlineRegExp = new RegExp(newline, 'g');



function Parser(template, options) {
	this.template = template	.replace(/\r\n/g, carriage)
								.replace(/\n/g, newline);;
	this.options  = options || {};

	this.sections = [];
	this.tokens   = ['multi'];
	this.partials = [];
	this.buffer   = this.template;
	this.state    = 'static'; // 'static' or 'tag'
	//this.currentLine = '';

	this.setTag(['{{', '}}']);
}

Parser.prototype = {
	tokenize: function () {
		while (this.buffer) {
			this.state === 'static' ? this.scanText() : this.scanTag();
		}

		if (this.sections.length > 0) {
			throw new Error('Encountered an unclosed section.');
		}

		var template = this.template.replace(carriageRegExp, '\r\n')
									.replace(newlineRegExp, '\n');

		return {partials: this.partials, tokens: this.tokens, content: template};
	}

	, appendMultiContent: function (content) {
		var i, len, multi;
		for (i = 0, len = this.sections.length; i < len; i++) {
			multi = this.sections[i][1];
			multi = multi[multi.length - 1][4] += content;
		}
	}

	, setTag: function (tags) {
		this.otag = tags[0] || '{{';
		this.ctag = tags[1] || '}}';
	}

	, scanText: function () {
		// Eat up everything up to the {{
		// if there is anything, then push a new 
		
		var index = this.buffer.indexOf(this.otag);

		if (index === -1) {
			index = this.buffer.length;
		}

		var content = this.buffer.substring(0, index)
									.replace(carriageRegExp, '\r\n')
									.replace(newlineRegExp, '\n');

		if (content !== '') {
			this.appendMultiContent(content);
			this.tokens.push(['static', content]);
		}

		this.buffer = this.buffer.substring(index + this.otag.length);
		this.state  = 'tag';
	}

	, scanTag: function () {
		var ctag = this.ctag
			, matcher = 
					"^" +
					"\\s*" +                           // Skip any whitespace

					"(#|\\^|/|=|!|<|>|&|\\{)?" +       // Check for a tag type and capture it
					"\\s*" +                           // Skip any whitespace
					"([^(?:\\}?" + e(ctag) + ")]+)" +  // Capture the text inside of the tag
					"\\s*" +                           // Skip any whitespace


					"\\}?" +                           // Skip balancing '}' if it exists
					e(ctag) +                          // Find the close of the tag

					"(.*)$"                            // Capture the rest of the string
					;

		matcher = new RegExp(matcher);

		var match = this.buffer.match(matcher);

		if (!match) {
			throw new Error('Encountered an unclosed tag: "' + this.otag + this.buffer + '"');
		}

		var sigil = match[1]
			, content = match[2].trim()
			, remainder = match[3]
			, tagText = this.otag + this.buffer.substring(0, this.buffer.length - remainder.length);

		var tag_name = content_until(content, " ");

		switch (sigil) {
			case undefined:
				this.tokens.push(['mustache', 'etag', tag_name, content]);
				this.appendMultiContent(tagText);
				break;

			case '>':
			case '<':
				this.tokens.push(['mustache', 'partial', tag_name, content]);
				this.partials.push(content);
				this.appendMultiContent(tagText);
				break;

			case '{':
			case '&':
				this.tokens.push(['mustache', 'utag', tag_name, content]);
				this.appendMultiContent(tagText);
				break;

			case '!':
				// Ignore comments
				break;

			case '=':
				this.setTag(content.split(' '));
				this.appendMultiContent(tagText);
				break;

			case '#':
			case '^':
				var type = sigil === '#' ? 'section' : 'inverted_section';


				var res = _.last(this.sections) || []
					, name = res[0]
					, tokens = res[1];
				var unclosed_sub_nodes = _.pluck(unclosed_nodes, "sub_nodes");
				var auto_close = false;
				for(var i = 0, len = unclosed_sub_nodes.length; i<len; i++) {
					if(_.indexOf(unclosed_sub_nodes[i], name) >= 0 && _.indexOf(unclosed_sub_nodes[i], tag_name) >= 0) {
						auto_close = true;
						break;
					}
				}

				if(auto_close) {
					this.tokens = tokens;
					this.sections.pop();
				}

				this.appendMultiContent(tagText);

				if(_.has(parent_rules, tag_name)) {
					var parent_rule = parent_rules[tag_name];
					if(parent_rule.direct === true) {
						var last_section = _.last(this.sections);
						var parent_tag_name = last_section[0];
						if(parent_tag_name !== parent_rule.parent) {
							throw new Error(tag_name + ' must be a direct child of ' + parent);
						}
					} else {
						var found = false;
						for(var i = this.sections.length-1; i>=0; i--) {
							var section = this.sections[i];
							if(section[0] === parent_rule.parent) {
								found = true;
								break;
							}
						}
						if(!found) {
							throw new Error(tag_name + ' must be a child of ' + parent);
						}
					}
				}


				if(_.has(sibling_rules, tag_name)) {
					var sibling = _.last(this.tokens);
					var sibling_tag_name = sibling[2];
					
					var sibling_tag_rules = sibling_rules[tag_name];

					if(sibling_tag_rules.direct) {
						if(_.indexOf(sibling_tag_rules.follows, sibling_tag_name) < 0) {
							var last_section = _.last(this.sections) || [];
							var parent_tag_name = last_section[0];
							if(_.indexOf(sibling_tag_rules.or_parent, parent_tag_name) < 0) {
								var follows_options = _.clone(sibling_tag_rules.follows);
								if(follows_options.length > 1) {
									follows_options[follows_options.length-1] =  "or " + _.last(follows_options);
								}
								var follows_options_str;

								if(follows_options.length > 2) {
									follows_options_str = follows_options.join(", ");
								} else {
									follows_options_str = follows_options.join(" ");
								}

								throw new Error(tag_name + ' must follow ' + follows_options_str);
							}
						}
					}
				}

				block = ['multi'];

				this.tokens.push(['mustache', type, tag_name, content, '', block]);
				this.sections.push([tag_name, this.tokens]);
				this.tokens = block;
				break;

			case '/':
				var res = _.last(this.sections) || []
					, name = res[0]
					, tokens = res[1];

				if (!name) {
					throw new Error('Closing unopened ' + tag_name);
				} else if (name !== tag_name) {
					var auto_close = false;
					if(_.has(unclosed_nodes, tag_name)) {
						var unclosed_children = unclosed_nodes[tag_name].sub_nodes;
						if(_.indexOf(unclosed_children, name) >= 0) {
							auto_close = true;
						}
					}
					if(auto_close) {
						this.sections.pop();

						res = _.last(this.sections) || [];
						name = res[0];
						tokens = res[1];
					} else {
						throw new Error("Unclosed section " + name);
					}
				}
				
				this.tokens = tokens;
				this.sections.pop();
				this.appendMultiContent(tagText);
				break;
		}

		this.buffer = remainder;
		this.state  = 'static';
	}
}


//
// Used to escape RegExp strings
//
function e(text) {
	// thank you Simon Willison
	if(!arguments.callee.sRE) {
		var specials = [
			'/', '.', '*', '+', '?', '|',
			'(', ')', '[', ']', '{', '}', '\\'
		];
		arguments.callee.sRE = new RegExp('(\\' + specials.join('|\\') + ')', 'g');
	}

	return text.replace(arguments.callee.sRE, '\\$1');
}

function content_until(str, until_str) {
	var index = str.indexOf(until_str);
	if(index < 0) { return str; }
	else { return str.substring(0, index); }
}

}(cjs));
