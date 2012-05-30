(function(cjs) {
var _ = cjs._;

var binary_ops = ["+", "-", "/", "*", "^", "&&", "and", "||", "or", "&", "|", "==", "===", ">=", "<=", "<", ">"]; // Must put ops with common substrings to have most specific before less specific (<= before <)
var unary_ops = ["-", "!"];

var start_str_regex = new RegExp("^['\"]");

var ltrim_regex = /^\s+/;
var ltrim = function(str) {
	return str.replace(ltrim_regex,'');
};


var Parser = function(expr, options) {
	this.expr = expr;
	this.options = options;
	this.buffer = this.expr;
	this.curr_node = null;
};

(function(my) {
	var proto = my.prototype;
	proto.tokenize = function() {
		var node;
		while(this.buffer) {
			this.buffer = ltrim(this.buffer);
			node = this.gobble_expression();
			if(node) {
				this.curr_node = node;
			} else {
				throw new Error("Unexpected " + this.buffer);
			}
		}
		return this.curr_node;
	};

	proto.gobble_token = function() {
		this.buffer = ltrim(this.buffer);
		var node = false;
		if(node === false) {
			node = this.parse_variable();
		}
		if(node === false) {
			node = this.parse_dot_property();
		}
		if(node === false) {
			node = this.parse_square_brackets_property();
		}
		if(node === false) {
			node = this.parse_constant();
		}
		if(node === false) {
			node = this.parse_fn_call();
		}
		return node;
	};
	proto.gobble_expression = function() {
		var node;
		node = this.gobble_token();
		return this.gobble_token();
	};

	var var_regex = new RegExp("^([A-Za-z_$][A-Za-z_$0-9]*)");
	proto.parse_variable = function() {
		var match = this.buffer.match(var_regex);
		if(match) {// We're dealing with a variable name
			var var_name = match[1];
			this.buffer = this.buffer.substr(match[0].length);
			return {
				type: "var"
				, var_name: var_name
				, text: match[0]
				};
		}
		return false;
	};
	proto.parse_dot_property = function() {
		if(this.buffer[0] === ".") {
			if(this.curr_node === null) {
				throw new Error("Unexpected .");
			}

			this.buffer = this.buffer.substr(1);
			var prop_node = this.parse_variable();
			if(prop_node) {
				var node = {
					type: "prop"
					, subtype: "dot"
					, parent: this.curr_node
					, child: prop_node
				};
				return node;
			} else {
				throw new Error("Unexpected property '"+this.buffer[0]+"'");
			}
		}
		return false;
	};
	var square_brackets_regex = new RegExp("^\\[([^\\]]+)\\]");
	proto.parse_square_brackets_property = function() {
		var match = this.buffer.match(square_brackets_regex);
		if(match) {// We're dealing with square brackets
			var match_parser = new Parser(match[1]);
			var prop_node = match_parser.tokenize();

			this.buffer = this.buffer.substr(match[0].length);
			if(prop_node) {
				var node = {
					type: "prop"
					, subtype: "square_brackets"
					, parent: this.curr_node
					, child: prop_node
					, outer_text: match[0]
					, inner_text: match[1]
				};
				return node;
			} else {
				throw new Error("Unexpected property '"+match[1]+"'");
			}
		}
		return false;
	};
	var number_regex = new RegExp("^(\\d+(.\\d+)?)");
	proto.parse_constant = function() {
		var match;
		if(match = this.buffer.match(number_regex)) {
			this.buffer = this.buffer.substr(match[0].length);
			var node = {
				type: "constant"
				, text: match[0]
				, value: parseFloat(match[1])
			};
			return node;
		} else if(match = this.buffer.match(start_str_regex)) {
			var quote_type = match[0];
			var matching_quote_index = this.buffer.indexOf(quote_type, quote_type.length);

			if(matching_quote_index >= 0) {
				var content = this.buffer.substring(1, matching_quote_index);
				var node = {
					type: "constant"
					, text: this.buffer.substring(0, matching_quote_index + 1)
					, value: content
				};
				this.buffer = this.buffer.substr(matching_quote_index + 1);
				return node;
			} else {
				throw new Error("Unclosed quote in " + match[0]);
			}
		}
		return false;
	};
	var fn_call_regex = new RegExp("^\\(");
	var fn_arg_regex = new RegExp("^\\s*,");
	var fn_end_arg_regex = new RegExp("^\\s*\\)");
	proto.parse_fn_call = function() {
		if(this.curr_node && (this.curr_node.type === "prop" || this.curr_node.type === "var" || this.curr_node.type === "fn_call")) {
			var match;
			if(match = this.buffer.match(fn_call_regex)) {
				var arg_node = false;
				this.buffer = this.buffer.substr(1); // Kill the open paren
				var args = [];
				var old_curr_node = this.curr_node;
				do {
					this.curr_node = null;
					arg_node = this.gobble_token();
					args.push(arg_node);
					if(match = this.buffer.match(fn_arg_regex)) {
						this.buffer = this.buffer.substr(match[0].length);
					} else if(match = this.buffer.match(fn_end_arg_regex)) {
						this.buffer = this.buffer.substr(match[0].length);
						break;
					}
				} while(arg_node);
				this.curr_node = old_curr_node;
				var node = {
					type: "fn_call"
					, args: args
					, fn: this.curr_node
				};
				return node;
			}
		}
		return false;
	};
}(Parser));



cjs.__parsers.expression = function (expr, options) {
	var parser = new Parser(expr, options);
	return parser.tokenize();
};

}(cjs));
