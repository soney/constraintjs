// Based on [Mu's parser](https://github.com/raycmorgan/Mu) and
// John Resig's [HTML parser](http://erik.eae.net/simplehtmlparser/simplehtmlparser.js)
var makeMap = function(str){
	var obj = {};
	each(str.split(","), function(item) { obj[item] = true; });
	return obj;
};

// Regular Expressions for parsing tags and attributes
var startTag = /^<([\-A-Za-z0-9_]+)((?:\s+[a-zA-Z0-9_\-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|(?:[^>\s]+)))?)*)\s*(\/?)>/,
	endTag = /^<\/([\-A-Za-z0-9_]+)[^>]*>/,
	handlebar = /^\{\{([#=!>|{\/])?\s*((?:(?:"[^"]*")|(?:'[^']*')|[^\}])*)\s*(\/?)\}?\}\}/,
	attr = /([\-A-Za-z0-9_]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^\/>\s]+)))?/g,
	//hb_attr = /\{\{([^\}]*)\}\}/g,
	HB_TYPE = "hb",
	HTML_TYPE = "html";
	
// Empty Elements - HTML 4.01
var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed"),
// Block Elements - HTML 4.01
	block = makeMap("address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul"),
// Inline Elements - HTML 4.01
	inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var"),
// Elements that you can, intentionally, leave open (and which close themselves)
	closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr"),
// Attributes that have their values filled in disabled="disabled"
	fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected"),
// Special Elements (can contain anything)
	special = makeMap("script,style");

var IF_TAG    = "if",
	ELIF_TAG  = "elif",
	ELSE_TAG  = "else",
	STATE_TAG = "state",
	EACH_TAG  = "each",
	WITH_TAG  = "with",
	FSM_TAG   = "fsm",
	UNLESS_TAG= "unless";

// Dictates what parents children must have; state must be a direct descendent of diagram
var parent_rules = {};
parent_rules[STATE_TAG] = { parent: [FSM_TAG] };
parent_rules[ELIF_TAG] = { parent: [IF_TAG] };
parent_rules[ELSE_TAG] = { parent: [IF_TAG, EACH_TAG] };

var autoclose_nodes = {};
autoclose_nodes[ELIF_TAG] =  { when_open_sibling: [ELIF_TAG, ELSE_TAG] };
autoclose_nodes[ELSE_TAG] =  {
	when_close_parent: [IF_TAG, EACH_TAG],
	when_open_sibling: []
};
autoclose_nodes[STATE_TAG] = { when_open_sibling: [STATE_TAG] };

// elsif and else must come after either if or elsif
var sibling_rules = {};
sibling_rules[ELIF_TAG] = {
	follows: [ELIF_TAG], //what it may follow
	or_parent: [IF_TAG] //or the parent can be 'if'
};
sibling_rules[ELSE_TAG] = {
	follows: [ELIF_TAG],
	or_parent: [IF_TAG, EACH_TAG]
};
sibling_rules[STATE_TAG] = {
	follows: [STATE_TAG],
	or_parent: [FSM_TAG]
};

var parseTemplate = function(input_str, handler) {
	var html_index, hb_index, last_closed_hb_tag, index, chars, match, stack = [], last = input_str;
	stack.last = function() {
		return this[this.length - 1];
	};

	var replace_fn = function(all, text) {
		text = text	.replace(/<!--(.*?)-->/g, "$1")
					.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1");

		if (handler.chars) {
			handler.chars(text);
		}

		return "";
	};

	while (input_str) {
		chars = true;

		// Make sure we're not in a script or style element
		if (!stack.last() || !special[stack.last()]) {
			// Comment
			if (input_str.indexOf("<!--") === 0) {
				index = input_str.indexOf("-->");

				if (index >= 0) {
					if (handler.HTMLcomment) {
						handler.HTMLcomment( input_str.substring( 4, index ) );
					}
					input_str = input_str.substring( index + 3 );
					chars = false;
				}

			// end tag
			} else if (input_str.indexOf("</") === 0) {
				match = input_str.match(endTag);

				if (match) {
					input_str = input_str.substring(match[0].length);
					match[0].replace(endTag, parseEndTag);
					chars = false;
				}

			// start tag
			} else if(input_str.indexOf("<") === 0) {
				match = input_str.match(startTag);

				if (match) {
					input_str = input_str.substring(match[0].length);
					match[0].replace(startTag, parseStartTag);
					chars = false;
				}
			} else if(input_str.indexOf("{{") === 0) {
				match = input_str.match(handlebar);
				if(match) {
					input_str = input_str.substring(match[0].length);
					match[0].replace(handlebar, parseHandlebar);
					chars = false;
				}
			}

			if(chars) {
				html_index = input_str.indexOf("<");
				hb_index = input_str.indexOf("{{");

				if(html_index < 0) { index = hb_index; }
				else if(hb_index < 0) { index = html_index; }
				else { index = Math.min(html_index, hb_index); }
				
				var text = index < 0 ? input_str : input_str.substring(0, index);
				input_str = index < 0 ? "" : input_str.substring(index);
				
				handler.chars(text);
			}
		} else {
			input_str = input_str.replace(new RegExp("(.*)<\/" + stack.last() + "[^>]*>"), replace_fn);

			parseEndTag("", stack.last());
		}

		if (input_str == last) {
			throw new Error("Parse Error: " + input_str);
		}
		last = input_str;
	}
	
	// Clean up any remaining tags
	parseEndTag();

	function parseStartTag( tag, tagName, rest, unary ) {
		tagName = tagName.toLowerCase();

		if ( block[ tagName ] ) {
			while ( stack.last() && inline[ stack.last() ] ) {
				parseEndTag( "", stack.last() );
			}
		}

		if ( closeSelf[ tagName ] && stack.last() == tagName ) {
			parseEndTag( "", tagName );
		}

		unary = empty[ tagName ] || !!unary;

		if ( !unary ) {
			stack.push({type: HTML_TYPE, tag: tagName});
		}
		
		if (handler.startHTML) {
			var attrs = [];

			rest.replace(attr, function(match, name) {
				var value = arguments[2] ? arguments[2] :
					arguments[3] ? arguments[3] :
					arguments[4] ? arguments[4] :
					fillAttrs[name] ? name : "";
				
				attrs.push({
					name: name,
					value: value,
					escaped: value.replace(/(^|[^\\])"/g, '$1\\\"') //"
				});
			});

			handler.startHTML(tagName, attrs, unary);
		}
	}

	function parseEndTag(tag, tagName) {
		popStackUntilTag(tagName, HTML_TYPE);
	}
	function getLatestHandlebarParent() {
		var i, stack_i;
		for(i = stack.length - 1; i>= 0; i--) {
			stack_i = stack[i];
			if(stack_i.type === HB_TYPE) {
				return stack_i;
			}
		}
		return undefined;
	}
	function parseHandlebar(tag, prefix, content) {
		var last_stack, tagName, parsed_content = jsep(content);

		if(parsed_content.type === COMPOUND) {
			if(parsed_content.body.length > 0 && parsed_content.body[0].type === IDENTIFIER) {
				tagName = parsed_content.body[0].name;
			}
		} else {
			if(parsed_content.type === IDENTIFIER) {
				tagName = parsed_content.name;
			}
		}

		switch (prefix) {
			case '{': // literal
				handler.startHB(tagName, parsed_content, true, true);
				break;
			case '>': // partial
				handler.partialHB(tagName, parsed_content);
				break;
			case '#': // start block
				last_stack = getLatestHandlebarParent();

				if(last_stack && has(autoclose_nodes, last_stack.tag)) {
					var autoclose_node = autoclose_nodes[last_stack.tag];
					if(indexOf(autoclose_node.when_open_sibling, tagName) >= 0) {
						popStackUntilTag(last_stack.tag, HB_TYPE);
						last_stack = getLatestHandlebarParent();
					}
				}

				if(has(parent_rules, tagName)) {
					var parent_rule = parent_rules[tagName];
					if(!last_stack || indexOf(parent_rule.parent, last_stack.tag)<0) {
						throw new Error("'" + tagName + "' must be inside of a '"+parent_rule.parent+"' block");
					}
				}

				if(has(sibling_rules, tagName)) {
					var sibling_rule = sibling_rules[tagName];
					if(indexOf(sibling_rule.follows, last_closed_hb_tag) < 0) {
						if(!sibling_rule.or_parent || indexOf(sibling_rule.or_parent, last_stack.tag) < 0) {
							var error_message = "'" + tagName + "' must follow a '" + sibling_rule.follows[0] + "'";
							if(sibling_rule.or_parent) {
								error_message += " or be inside of a '" + sibling_rule.or_parent[0] + "' tag";
							}
							throw new Error(error_message);
						}
					}
				}

				stack.push({type: HB_TYPE, tag: tagName});
				handler.startHB(tagName, parsed_content, false);
				break;

			case '/': // end block
				popStackUntilTag(tagName, HB_TYPE);
				break;
			case '!': // end block
				break;
			default: // unary
				handler.startHB(tagName, parsed_content, true, false);
				break;
		}
	}
	function popStackUntilTag(tagName, type) {
		var i, pos, stack_i;
		for (pos = stack.length - 1; pos >= 0; pos -= 1) {
			if(stack[pos].type === type && stack[pos].tag === tagName) {
				break;
			}
		}
		
		if (pos >= 0) {
			// Close all the open elements, up the stack
			for (i = stack.length - 1; i >= pos; i-- ) {
				stack_i = stack[i];
				if(stack_i.type === HB_TYPE) {
					if (handler.endHB) {
						handler.endHB(stack_i.tag);
					}
				} else {
					if (handler.endHTML) {
						handler.endHTML(stack_i.tag);
					}
				}
			}
			
			// Remove the open elements from the stack
			stack.length = pos;
		}

		if(type === HB_TYPE) {
			last_closed_hb_tag = tagName;
		}
	}
},
create_template = function(template_str) {
	var root = {
		children: [],
		type: ROOT_TYPE
	}, stack = [root],
	last_pop = false, has_container = false, fsm_stack = [], condition_stack = [];

	parseTemplate(template_str, {
		startHTML: function(tag, attributes, unary) {
			last_pop = {
				type: HTML_TYPE,
				tag: tag,
				attributes: attributes,
				unary: unary,
				children: []
			};

			last(stack).children.push(last_pop);

			if(!unary) {
				stack.push(last_pop);
			}
		},
		endHTML: function(tag) {
			last_pop = stack.pop();
		},
		HTMLcomment: function(str) {
			last_pop = {
				type: COMMENT_TYPE,
				str: str
			};
			last(stack).children.push(last_pop);
		},
		chars: function(str) {
			last_pop = {
				type: CHARS_TYPE,
				str: str
			};
			last(stack).children.push(last_pop);
		},
		startHB: function(tag, parsed_content, unary, literal) {
			if(unary) {
				last_pop = {
					type: UNARY_HB_TYPE,
					obj: first_body(parsed_content),
					literal: literal,
					//options: body_event_options(parsed_content),
					tag: tag
				};

				last(stack).children.push(last_pop);
			} else {
				var push_onto_children = true;

				last_pop = {
					type: HB_TYPE,
					tag: tag,
					children: []
				};
				switch(tag) {
					case EACH_TAG:
						last_pop.parsed_content = rest_body(parsed_content);
						last_pop.else_child = false;
						break;
					case UNLESS_TAG:
					case IF_TAG:
						last_pop.reverse = tag === UNLESS_TAG;
						last_pop.sub_conditions = [];
						last_pop.condition = rest_body(parsed_content);
						condition_stack.push(last_pop);
						break;
					case ELIF_TAG:
					case ELSE_TAG:
						var last_stack = last(stack);
						if(last_stack.type === HB_TYPE && last_stack.tag === EACH_TAG) {
							last_stack.else_child = last_pop;
						} else {
							last(condition_stack).sub_conditions.push(last_pop);
						}
						last_pop.condition = tag === ELSE_TAG ? ELSE_COND : rest_body(parsed_content);
						push_onto_children = false;
						break;
					case EACH_TAG:
					case FSM_TAG:
						last_pop.fsm_target = rest_body(parsed_content);
						last_pop.sub_states = {};
						fsm_stack.push(last_pop);
						break;
					case STATE_TAG:
						var state_name = parsed_content.body[1].name;
						last(fsm_stack).sub_states[state_name] = last_pop;
						push_onto_children = false;
						break;
					case WITH_TAG:
						last_pop.content = rest_body(parsed_content);
						break;
				}
				if(push_onto_children) {
					last(stack).children.push(last_pop);
				}
				stack.push(last_pop);
			}
		},
		endHB: function(tag) {
			switch(tag) {
				case IF_TAG:
				case UNLESS_TAG:
					condition_stack.pop();
					break;
				case FSM_TAG:
					fsm_stack.pop();
			}
			stack.pop();
		},
		partialHB: function(tagName, parsed_content) {
			last_pop = {
				type: PARTIAL_HB_TYPE,
				tag: tagName,
				content: rest_body(parsed_content)
			};

			last(stack).children.push(last_pop);
		}
	});
	return root;
};
