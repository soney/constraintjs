/* Jison generated parser */
cjs.__parsers.handlebars = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"root":3,"program":4,"EOF":5,"statements":6,"simpleInverse":7,"statement":8,"openInverse":9,"closeBlock":10,"openSingularBlock":11,"openBlock":12,"mustache":13,"partial":14,"CONTENT":15,"COMMENT":16,"OPEN_BLOCK":17,"inMustache":18,"CLOSE":19,"OPEN_INVERSE":20,"OPEN_SBLOCK":21,"OPEN_ENDBLOCK":22,"path":23,"OPEN":24,"OPEN_UNESCAPED":25,"OPEN_PARTIAL":26,"params":27,"hash":28,"param":29,"STRING":30,"INTEGER":31,"BOOLEAN":32,"hashSegments":33,"hashSegment":34,"ID":35,"EQUALS":36,"pathSegments":37,"SEP":38,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",15:"CONTENT",16:"COMMENT",17:"OPEN_BLOCK",19:"CLOSE",20:"OPEN_INVERSE",21:"OPEN_SBLOCK",22:"OPEN_ENDBLOCK",24:"OPEN",25:"OPEN_UNESCAPED",26:"OPEN_PARTIAL",30:"STRING",31:"INTEGER",32:"BOOLEAN",35:"ID",36:"EQUALS",38:"SEP"},
productions_: [0,[3,2],[4,3],[4,1],[4,0],[6,1],[6,2],[8,3],[8,3],[8,3],[8,3],[8,1],[8,1],[8,1],[8,1],[12,3],[9,3],[11,3],[10,3],[13,3],[13,3],[14,3],[14,4],[7,2],[18,3],[18,2],[18,2],[18,1],[27,2],[27,1],[29,1],[29,1],[29,1],[29,1],[28,1],[33,2],[33,1],[34,3],[34,3],[34,3],[34,3],[23,1],[37,3],[37,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: return $$[$0-1]; 
break;
case 2: this.$ = new yy.ProgramNode($$[$0-2], $$[$0]); 
break;
case 3: this.$ = new yy.ProgramNode($$[$0]); 
break;
case 4: this.$ = new yy.ProgramNode([]); 
break;
case 5: this.$ = [$$[$0]]; 
break;
case 6: $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 7: this.$ = new yy.InverseNode($$[$0-2], $$[$0-1], $$[$0]); 
break;
case 8: this.$ = new yy.SingularBlockNode($$[$0-2], $$[$0-1]); 
break;
case 9: this.$ = new yy.SingularBlockNode($$[$0-2], $$[$0-1], $$[$0]); 
break;
case 10: this.$ = new yy.BlockNode($$[$0-2], $$[$0-1], $$[$0]); 
break;
case 11: this.$ = $$[$0]; 
break;
case 12: this.$ = $$[$0]; 
break;
case 13: this.$ = new yy.ContentNode($$[$0]); 
break;
case 14: this.$ = new yy.CommentNode($$[$0]); 
break;
case 15: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]); 
break;
case 16: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]); 
break;
case 17: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]); 
break;
case 18: this.$ = $$[$0-1]; 
break;
case 19: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]); 
break;
case 20: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1], true); 
break;
case 21: this.$ = new yy.PartialNode($$[$0-1]); 
break;
case 22: this.$ = new yy.PartialNode($$[$0-2], $$[$0-1]); 
break;
case 23: 
break;
case 24: this.$ = [[$$[$0-2]].concat($$[$0-1]), $$[$0]]; 
break;
case 25: this.$ = [[$$[$0-1]].concat($$[$0]), null]; 
break;
case 26: this.$ = [[$$[$0-1]], $$[$0]]; 
break;
case 27: this.$ = [[$$[$0]], null]; 
break;
case 28: $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 29: this.$ = [$$[$0]]; 
break;
case 30: this.$ = $$[$0]; 
break;
case 31: this.$ = new yy.StringNode($$[$0]); 
break;
case 32: this.$ = new yy.IntegerNode($$[$0]); 
break;
case 33: this.$ = new yy.BooleanNode($$[$0]); 
break;
case 34: this.$ = new yy.HashNode($$[$0]); 
break;
case 35: $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 36: this.$ = [$$[$0]]; 
break;
case 37: this.$ = [$$[$0-2], $$[$0]]; 
break;
case 38: this.$ = [$$[$0-2], new yy.StringNode($$[$0])]; 
break;
case 39: this.$ = [$$[$0-2], new yy.IntegerNode($$[$0])]; 
break;
case 40: this.$ = [$$[$0-2], new yy.BooleanNode($$[$0])]; 
break;
case 41: this.$ = new yy.IdNode($$[$0]); 
break;
case 42: $$[$0-2].push($$[$0]); this.$ = $$[$0-2]; 
break;
case 43: this.$ = [$$[$0]]; 
break;
}
},
table: [{3:1,4:2,5:[2,4],6:3,8:4,9:5,11:6,12:7,13:8,14:9,15:[1,10],16:[1,11],17:[1,14],20:[1,12],21:[1,13],24:[1,15],25:[1,16],26:[1,17]},{1:[3]},{5:[1,18]},{5:[2,3],7:19,8:20,9:5,11:6,12:7,13:8,14:9,15:[1,10],16:[1,11],17:[1,14],20:[1,21],21:[1,13],22:[2,3],24:[1,15],25:[1,16],26:[1,17]},{5:[2,5],15:[2,5],16:[2,5],17:[2,5],20:[2,5],21:[2,5],22:[2,5],24:[2,5],25:[2,5],26:[2,5]},{4:22,6:3,8:4,9:5,11:6,12:7,13:8,14:9,15:[1,10],16:[1,11],17:[1,14],20:[1,12],21:[1,13],22:[2,4],24:[1,15],25:[1,16],26:[1,17]},{4:23,6:3,8:4,9:5,11:6,12:7,13:8,14:9,15:[1,10],16:[1,11],17:[1,14],20:[1,12],21:[1,13],22:[2,4],24:[1,15],25:[1,16],26:[1,17]},{4:24,6:3,8:4,9:5,11:6,12:7,13:8,14:9,15:[1,10],16:[1,11],17:[1,14],20:[1,12],21:[1,13],22:[2,4],24:[1,15],25:[1,16],26:[1,17]},{5:[2,11],15:[2,11],16:[2,11],17:[2,11],20:[2,11],21:[2,11],22:[2,11],24:[2,11],25:[2,11],26:[2,11]},{5:[2,12],15:[2,12],16:[2,12],17:[2,12],20:[2,12],21:[2,12],22:[2,12],24:[2,12],25:[2,12],26:[2,12]},{5:[2,13],15:[2,13],16:[2,13],17:[2,13],20:[2,13],21:[2,13],22:[2,13],24:[2,13],25:[2,13],26:[2,13]},{5:[2,14],15:[2,14],16:[2,14],17:[2,14],20:[2,14],21:[2,14],22:[2,14],24:[2,14],25:[2,14],26:[2,14]},{18:25,23:26,35:[1,28],37:27},{18:29,23:26,35:[1,28],37:27},{18:30,23:26,35:[1,28],37:27},{18:31,23:26,35:[1,28],37:27},{18:32,23:26,35:[1,28],37:27},{23:33,35:[1,28],37:27},{1:[2,1]},{6:34,8:4,9:5,11:6,12:7,13:8,14:9,15:[1,10],16:[1,11],17:[1,14],20:[1,12],21:[1,13],24:[1,15],25:[1,16],26:[1,17]},{5:[2,6],15:[2,6],16:[2,6],17:[2,6],20:[2,6],21:[2,6],22:[2,6],24:[2,6],25:[2,6],26:[2,6]},{18:25,19:[1,35],23:26,35:[1,28],37:27},{10:36,22:[1,37]},{10:39,11:38,21:[1,13],22:[1,37]},{10:40,22:[1,37]},{19:[1,41]},{19:[2,27],23:46,27:42,28:43,29:44,30:[1,47],31:[1,48],32:[1,49],33:45,34:50,35:[1,51],37:27},{19:[2,41],30:[2,41],31:[2,41],32:[2,41],35:[2,41],38:[1,52]},{19:[2,43],30:[2,43],31:[2,43],32:[2,43],35:[2,43],38:[2,43]},{19:[1,53]},{19:[1,54]},{19:[1,55]},{19:[1,56]},{19:[1,57],23:58,35:[1,28],37:27},{5:[2,2],8:20,9:5,11:6,12:7,13:8,14:9,15:[1,10],16:[1,11],17:[1,14],20:[1,12],21:[1,13],22:[2,2],24:[1,15],25:[1,16],26:[1,17]},{15:[2,23],16:[2,23],17:[2,23],20:[2,23],21:[2,23],24:[2,23],25:[2,23],26:[2,23]},{5:[2,7],15:[2,7],16:[2,7],17:[2,7],20:[2,7],21:[2,7],22:[2,7],24:[2,7],25:[2,7],26:[2,7]},{23:59,35:[1,28],37:27},{5:[2,8],15:[2,8],16:[2,8],17:[2,8],20:[2,8],21:[2,8],22:[2,8],24:[2,8],25:[2,8],26:[2,8]},{5:[2,9],15:[2,9],16:[2,9],17:[2,9],20:[2,9],21:[2,9],22:[2,9],24:[2,9],25:[2,9],26:[2,9]},{5:[2,10],15:[2,10],16:[2,10],17:[2,10],20:[2,10],21:[2,10],22:[2,10],24:[2,10],25:[2,10],26:[2,10]},{15:[2,16],16:[2,16],17:[2,16],20:[2,16],21:[2,16],22:[2,16],24:[2,16],25:[2,16],26:[2,16]},{19:[2,25],23:46,28:60,29:61,30:[1,47],31:[1,48],32:[1,49],33:45,34:50,35:[1,51],37:27},{19:[2,26]},{19:[2,29],30:[2,29],31:[2,29],32:[2,29],35:[2,29]},{19:[2,34],34:62,35:[1,63]},{19:[2,30],30:[2,30],31:[2,30],32:[2,30],35:[2,30]},{19:[2,31],30:[2,31],31:[2,31],32:[2,31],35:[2,31]},{19:[2,32],30:[2,32],31:[2,32],32:[2,32],35:[2,32]},{19:[2,33],30:[2,33],31:[2,33],32:[2,33],35:[2,33]},{19:[2,36],35:[2,36]},{19:[2,43],30:[2,43],31:[2,43],32:[2,43],35:[2,43],36:[1,64],38:[2,43]},{35:[1,65]},{5:[2,17],15:[2,17],16:[2,17],17:[2,17],20:[2,17],21:[2,17],22:[2,17],24:[2,17],25:[2,17],26:[2,17]},{15:[2,15],16:[2,15],17:[2,15],20:[2,15],21:[2,15],22:[2,15],24:[2,15],25:[2,15],26:[2,15]},{5:[2,19],15:[2,19],16:[2,19],17:[2,19],20:[2,19],21:[2,19],22:[2,19],24:[2,19],25:[2,19],26:[2,19]},{5:[2,20],15:[2,20],16:[2,20],17:[2,20],20:[2,20],21:[2,20],22:[2,20],24:[2,20],25:[2,20],26:[2,20]},{5:[2,21],15:[2,21],16:[2,21],17:[2,21],20:[2,21],21:[2,21],22:[2,21],24:[2,21],25:[2,21],26:[2,21]},{19:[1,66]},{19:[1,67]},{19:[2,24]},{19:[2,28],30:[2,28],31:[2,28],32:[2,28],35:[2,28]},{19:[2,35],35:[2,35]},{36:[1,64]},{23:68,30:[1,69],31:[1,70],32:[1,71],35:[1,28],37:27},{19:[2,42],30:[2,42],31:[2,42],32:[2,42],35:[2,42],38:[2,42]},{5:[2,22],15:[2,22],16:[2,22],17:[2,22],20:[2,22],21:[2,22],22:[2,22],24:[2,22],25:[2,22],26:[2,22]},{5:[2,18],15:[2,18],16:[2,18],17:[2,18],20:[2,18],21:[2,18],22:[2,18],24:[2,18],25:[2,18],26:[2,18]},{19:[2,37],35:[2,37]},{19:[2,38],35:[2,38]},{19:[2,39],35:[2,39]},{19:[2,40],35:[2,40]}],
defaultActions: {18:[2,1],43:[2,26],60:[2,24]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.lexer.yylloc == 'undefined')
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        _handle_error:
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                var errStr = '';
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+"\nExpecting "+expected.join(', ') + ", got '" + this.terminals_[symbol]+ "'";
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }

            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column
                };
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};
/* Jison generated lexer */
var lexer = (function(){
var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parseError) {
            this.yy.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext+=ch;
        this.yyleng++;
        this.match+=ch;
        this.matched+=ch;
        var lines = ch.match(/\n/);
        if (lines) this.yylineno++;
        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        this._input = ch + this._input;
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
less:function (n) {
        this._input = this.match.slice(n) + this._input;
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            tempMatch,
            index,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (!this.options.flex) break;
            }
        }
        if (match) {
            lines = match[0].match(/\n.*/g);
            if (lines) this.yylineno += lines.length;
            this.yylloc = {first_line: this.yylloc.last_line,
                           last_line: this.yylineno+1,
                           first_column: this.yylloc.last_column,
                           last_column: lines ? lines[lines.length-1].length-1 : this.yylloc.last_column + match[0].length}
            this.yytext += match[0];
            this.match += match[0];
            this.yyleng = this.yytext.length;
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index],this.conditionStack[this.conditionStack.length-1]);
            if (this.done && this._input) this.done = false;
            if (token) return token;
            else return;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(), 
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.options = {};
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:
                                   if(yy_.yytext.slice(-1) !== "\\") this.begin("mu");
                                   if(yy_.yytext.slice(-1) === "\\") yy_.yytext = yy_.yytext.substr(0,yy_.yyleng-1), this.begin("emu");
                                   if(yy_.yytext) return 15;
                                 
break;
case 1: return 15; 
break;
case 2: this.popState(); return 15; 
break;
case 3: return 26; 
break;
case 4: return 21; 
break;
case 5: return 21; 
break;
case 6: return 21; 
break;
case 7: return 17; 
break;
case 8: return 22; 
break;
case 9: return 20; 
break;
case 10: return 25; 
break;
case 11: return 25; 
break;
case 12: yy_.yytext = yy_.yytext.substr(3,yy_.yyleng-5); this.popState(); return 16; 
break;
case 13: return 24; 
break;
case 14: return 36; 
break;
case 15: return 35; 
break;
case 16: return 35; 
break;
case 17: return 38; 
break;
case 18: /*ignore whitespace*/ 
break;
case 19: this.popState(); return 19; 
break;
case 20: this.popState(); return 19; 
break;
case 21: yy_.yytext = yy_.yytext.substr(1,yy_.yyleng-2).replace(/\\"/g,'"'); return 30; 
break;
case 22: return 32; 
break;
case 23: return 32; 
break;
case 24: return 31; 
break;
case 25: return 35; 
break;
case 26: yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 35; 
break;
case 27: return 'INVALID'; 
break;
case 28: return 5; 
break;
}
};
lexer.rules = [/^(?:[^\x00]*?(?=(\{\{)))/,/^(?:[^\x00]+)/,/^(?:[^\x00]{2,}?(?=(\{\{)))/,/^(?:\{\{>)/,/^(?:\{\{#state\b)/,/^(?:\{\{#elif\b)/,/^(?:\{\{#else\b)/,/^(?:\{\{#)/,/^(?:\{\{\/)/,/^(?:\{\{\^)/,/^(?:\{\{\{)/,/^(?:\{\{&)/,/^(?:\{\{![\s\S]*?\}\})/,/^(?:\{\{)/,/^(?:=)/,/^(?:\.(?=[} ]))/,/^(?:\.\.)/,/^(?:[\/.])/,/^(?:\s+)/,/^(?:\}\}\})/,/^(?:\}\})/,/^(?:"(\\["]|[^"])*")/,/^(?:true(?=[}\s]))/,/^(?:false(?=[}\s]))/,/^(?:[0-9]+(?=[}\s]))/,/^(?:[a-zA-Z0-9_$-]+(?=[=}\s\/.]))/,/^(?:\[[^\]]*\])/,/^(?:.)/,/^(?:$)/];
lexer.conditions = {"mu":{"rules":[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28],"inclusive":false},"emu":{"rules":[2],"inclusive":false},"INITIAL":{"rules":[0,1,28],"inclusive":true}};
return lexer;})()
parser.lexer = lexer;
return parser;
})();