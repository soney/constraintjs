/*!
* Module dependencies.
*/

var markdown = require('marked'),
	/**
	* Escape the given `html`.
	*
	* @param {String} html
	* @return {String}
	* @api private
	*/

	escape = function(html){
		return String(html)	.replace(/&(?!\w+;)/g, '&amp;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;');
	},
	stripOutsideTags = function(str) {
		return str.replace(/^<\w+>\s*/, '').replace(/\s*<\/\w+>\s*\n?\s*$/, '');
	};

/**
* Parse comments in the given string of `js`.
*
* @param {String} js
* @param {Object} options
* @return {Array}
* @see exports.parseComment
* @api public
*/

var line_num;
exports.parseComments = function(js, options) {
	options = options || {};
	js = js.replace(/\r\n/gm, '\n');
	line_num = 1;

	var comments = [],
	raw = options.raw,
	comment,
	buf = '',
	ignore,
	withinMultiline = false,
	withinSingle = false,
	code,
	start_line_num = line_num;

	for (var i = 0, len = js.length; i < len; ++i) {
		// start comment
		if (!withinMultiline && !withinSingle && '/' == js[i] && '*' == js[i+1]) {
			start_line_num = line_num;
			// code following previous comment
			if (buf.trim().length) {
				comment = comments[comments.length - 1];
				if(comment) {
					comment.code = code = buf.trim();
				}
				buf = '';
			}
			i += 2;
			withinMultiline = true;
			ignore = '!' == js[i];
			// end comment
		} else if (withinMultiline && !withinSingle && '*' == js[i] && '/' == js[i+1]) {
			i += 2;
			buf = buf.replace(/^[ \t]*\* ?/gm, '');
			var comment = exports.parseComment(buf, options);
			comment.ignore = ignore;
			comment.line = start_line_num;
			comments.push(comment);
			withinMultiline = ignore = false;
			buf = '';
		} else if (!withinSingle && !withinMultiline && '/' == js[i] && '/' == js[i+1]) {
			withinSingle = true;
			buf += js[i];
		} else if (withinSingle && !withinMultiline && '\n' == js[i]) {
			withinSingle = false;
			buf += js[i];
			// buffer comment or code
		} else {
			buf += js[i];
		}
		if('\n' == js[i]) {
			line_num++;
		}

	}

	if (comments.length === 0) {
		comments.push({
			tags: [],
			description: {full: '', summary: '', body: ''},
			isPrivate: false,
			line: start_line_num
		});
	}

	// trailing code
	if (buf.trim().length) {
		comment = comments[comments.length - 1];
		code = buf.trim();
		comment.code = code;
	}

	return comments;
};

/**
* Parse the given comment `str`.
*
* The comment object returned contains the following
*
*  - `tags`  array of tag objects
*  - `description` the first line of the comment
*  - `body` lines following the description
*  - `content` both the description and the body
*  - `isPrivate` true when "@api private" is used
*
* @param {String} str
* @param {Object} options
* @return {Object}
* @see exports.parseTag
* @api public
*/

exports.parseComment = function(str, options) {
	str = str.trim();
	options = options || {};

	var comment = { tags: [] },
		raw = options.raw,
		description = {};

	if(str.indexOf("@")===0 && str.indexOf("\n")<0) { // one-line comment
		var tags = '@' + str.split('@').slice(1).join('@');
		comment.tags = tags.split('\n').map(exports.parseTag);
	} else {
		// parse comment body
		description.full = str.split('\n@')[0];
		description.summary = description.full.split('\n\n')[0];
		description.body = description.full.split('\n\n').slice(1).join('\n\n');
		comment.description = description;

		// parse tags
		if (~str.indexOf('\n@')) {
			var tags = str.split('\n@').slice(1).join('\n@');
			comment.tags = tags.split('\n@').map(function(tag) { return "@" + tag; }).map(exports.parseTag);
			comment.isPrivate = comment.tags.some(function(tag){
				return 'api' == tag.type && 'private' == tag.visibility;
			})
		}

		// markdown
		if (!raw) {
			description.full = markdown(description.full);
			description.summary = markdown(description.summary);
			description.body = markdown(description.body);
		}
	}


	return comment;
}

/**
* Parse tag string "@param {Array} name description" etc.
*
* @param {String}
* @return {Object}
* @api public
*/

exports.parseTag = function(str) {
	var tag = {},
		parts = str.split(/[ ]+/),
		type = tag.type = parts.shift().replace('@', '');

	if(str.match(/^@example[\s\n]/)) {
		str = str.replace(/^@example/, "");
		//.trim();
		tag = {type: "example", code: markdown(str)};
		return tag;
	}

	switch (type) {
		case 'param':
		case 'property':
			tag.types = exports.parseTagTypes(parts.shift());
			tag.name = parts.shift() || '';
			tag.description = stripOutsideTags(markdown(parts.join(' ').replace(/^\s*-?\s*/, '')));
			break;
		case 'return':
			tag.types = exports.parseTagTypes(parts.shift());
			tag.description = stripOutsideTags(markdown(parts.join(' ').replace(/^\s*-?\s*/, '')));
			break;
		case 'see':
			if (~str.indexOf('http')) {
				tag.title = parts.length > 1
				? parts.shift()
				: '';
				tag.url = parts.join(' ');
			} else {
				tag.local = parts.join(' ');
			}
		case 'api':
			tag.visibility = parts.shift();
			break;
		case 'type':
			tag.types = exports.parseTagTypes(parts.shift());
			break;
		case 'memberOf':
			tag.parent = parts.shift();
			break;
		case 'augments':
			tag.otherClass = parts.shift();
			break;
		case 'borrows':
			tag.otherMemberName = parts.join(' ').split(' as ')[0];
			tag.thisMemberName = parts.join(' ').split(' as ')[1];
			break;
		case 'throws':
			tag.types = exports.parseTagTypes(parts.shift());
			tag.description = parts.join(' ');
			break;
		default:
			tag.string = parts.join(' ');
			break;
	}

	return tag;
}

/**
* Parse tag type string "{Array|Object}" etc.
*
* @param {String} str
* @return {Array}
* @api public
*/

exports.parseTagTypes = function(str) {
	return str	.replace(/[{}]/g, '')
				.split(/ *[|,\/] */);
};
