	//Based on Mu's parser: https://github.com/raycmorgan/Mu
	/*
	 * HTML Parser By John Resig (ejohn.org)
	 * Original code by Erik Arvidsson, Mozilla Public License
	 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
	 *
	 * // Use like so:
	 * HTMLParser(htmlString, {
	 *     start: function(tag, attrs, unary) {},
	 *     end: function(tag) {},
	 *     chars: function(text) {},
	 *     comment: function(text) {}
	 * });
	 *
	 * // or to get an XML string:
	 * HTMLtoXML(htmlString);
	 *
	 * // or to get an XML DOM Document
	 * HTMLtoDOM(htmlString);
	 *
	 * // or to inject into an existing document/DOM node
	 * HTMLtoDOM(htmlString, document);
	 * HTMLtoDOM(htmlString, document.body);
	 *
	 */
	var makeMap = function(str){
		var obj = {};
		each(str.split(","), function(item) { obj[item] = true; });
		return obj;
	};

	// Regular Expressions for parsing tags and attributes
	var startTag = /^<([\-A-Za-z0-9_]+)((?:\s+\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
		endTag = /^<\/([\-A-Za-z0-9_]+)[^>]*>/,
		handlebar = /^\{\{([#=!@|{\/])?([\-A-Za-z0-9_]+)((?:\s+\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)\}?\}\}/,
		attr = /([\-A-Za-z0-9_]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;
		
	// Empty Elements - HTML 4.01
	var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed");

	// Block Elements - HTML 4.01
	var block = makeMap("address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul");

	// Inline Elements - HTML 4.01
	var inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var");

	// Elements that you can, intentionally, leave open
	// (and which close themselves)
	var closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");

	// Attributes that have their values filled in disabled="disabled"
	var fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected");

	// Special Elements (can contain anything)
	var special = makeMap("script,style");


	// HANDLEBARS RULES
	
	// Dictates what parents children must have; state must be a direct descendent of diagram
	var parent_rules = {
		"state": { parent: "fsm" },
		"elif": { parent: "if" },
		"else": { parent: "if" }
	};

	var autoclose_nodes = {
		"elif": {
			when_open_sibling: ["elif", "else"]
		},
		"else": {
			when_close_parent: ["if"]
		},
		"state": {
			when_open_sibling: ["state"]
		}
	};

	// elsif and else must come after either if or elsif
	var sibling_rules = {
		"elif": {
			follows: ["elif"], //what it may follow
			or_parent: ["if"] //or the parent can be 'if'
		},
		"else": {
			follows: ["elif"],
			or_parent: ["if"]
		},
		"state": {
			follows: ["state"],
			or_parent: ["fsm"]
		}
	};

	var parseTemplate = function(input_str, handler) {
		var html_index, hb_index, last_closed_hb_tag, index, chars, match, stack = [], last = input_str;
		stack.last = function(){
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
					
					if(handler.chars) {
						handler.chars(text);
					}
				}
			} else {
				input_str = input_str.replace(new RegExp("(.*)<\/" + stack.last() + "[^>]*>"), replace_fn);

				parseEndTag("", stack.last());
			}

			if (input_str == last) {
				throw "Parse Error: " + input_str;
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
				stack.push({type: "html", tag: tagName});
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
			popStackUntilTag(tagName, "html");
		}
		function getLatestHandlebarParent() {
			var i, stack_i;
			for(i = stack.length - 1; i>= 0; i--) {
				stack_i = stack[i];
				if(stack_i.type === "hb") {
					return stack_i;
				}
			}
			return undefined;
		}
		function parseHandlebar(tag, prefix, tagName, rest) {
			var last_stack, params = rest.trim();

			switch (prefix) {
				case undefined: // unary
					if(handler.startHB) {
						handler.startHB(tagName, params, true, false);
					}
					break;

				case '{': // literal
					if(handler.startHB) {
						handler.startHB(tagName, params, true, true);
					}
					break;

				case '!': // comment
					if(handler.HBComment) {
						var text = tag.replace(/\{\{!(--)?(.*?)(--)?\}\}/g, "$1");
						handler.HBComment(text);
					}
					break;

				case '#': // start block
					last_stack = getLatestHandlebarParent();

					if(last_stack && has(autoclose_nodes, last_stack.tag)) {
						var autoclose_node = autoclose_nodes[last_stack.tag];
						if(autoclose_node.when_open_sibling.indexOf(tagName) >= 0) {
							popStackUntilTag(last_stack.tag, "hb");
							last_stack = getLatestHandlebarParent();
						}
					}

					if(has(parent_rules, tagName)) {
						var parent_rule = parent_rules[tagName];
						if(!last_stack || parent_rule.parent !== last_stack.tag) {
							throw new Error("'" + tagName + "' must be inside of a '"+parent_rule.parent+"' block");
						}
					}

					if(has(sibling_rules, tagName)) {
						var sibling_rule = sibling_rules[tagName];
						if(sibling_rule.follows.indexOf(last_closed_hb_tag) < 0) {
							if(!sibling_rule.or_parent || sibling_rule.or_parent.indexOf(last_stack.tag) < 0) {
								var error_message = "'" + tagName + "' must follow a '" + sibling_rule.follows[0] + "'";
								if(sibling_rule.or_parent) {
									error_message += " or be inside of a '" + sibling_rule.or_parent[0] + "' tag";
								}
								throw new Error(error_message);
							}
						}
					}

					stack.push({type: "hb", tag: tagName});
					if(handler.startHB) {
						handler.startHB(tagName, params, false);
					}
					break;

				case '/': // end block
					popStackUntilTag(tagName, "hb");
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
					if(stack_i.type === "hb") {
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

			if(type === "hb") {
				last_closed_hb_tag = tagName;
			}
		}
	};
