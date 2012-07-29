(function(cjs) {
var _ = cjs._;
var esprima = window.esprima;

var event_types = {};

var dom_events = ["click", "dblclick", "mousedown", "mouseup", "mouseover", "mousemove", "mouseout", "keydown", "keypress", "keyup", "load", "unload", "abort", "error", "resize", "scroll", "select", "change", "submit", "reset", "focus", "blur", "DOMFocusIn", "DOMFocusOut", "DOMActivate", "DOMSubtreeModified", "DOMNodeInserted", "DOMNodeRemoved", "DOMNodeRemovedFromDocument", "DOMNodeInsertedIntoDocument", "DOMAttrModified", "DOMCharacterDataModified", "cut", "copy", "paste", "beforecut", "beforecopy", "beforepaste", "afterupdate", "beforeupdate", "cellchange", "dataavailable", "datasetchanged", "datasetcomplete", "errorupdate", "rowenter", "rowexit", "rowsdelete", "rowinserted", "contextmenu", "drag", "dragstart", "dragenter", "dragover", "dragleave", "dragend", "drop", "selectstart", "help", "beforeunload", "stop", "beforeeditfocus", "start", "finish", "bounce", "beforeprint", "afterprint", "propertychange", "filterchange", "readystatechange", "losecapture", "touchstart", "touchend", "touchmove", "touchenter", "touchleave", "touchcancel"];


_.forEach(dom_events, function(dom_event) {
	event_types[dom_event] = function(parent) {
		if(parent) {
			var dom_elem;
			if(_.isElement(parent) || parent === window) {
				dom_elem = parent;
			} else {
				dom_elem = parent.dom_element;
			}
			return red.create_event("dom_event", dom_event, dom_elem);
		}
	};
});

var eval_tree = function(node, context) {
	var type = node.type;
	if(type === "ExpressionStatement") {
		return eval_tree(node.expression, context);
	} else if(type === "CallExpression") {
		var callee = eval_tree(node.callee, context);
		var args = _.map(node.arguments, function(argument) {
			return eval_tree(argument, context);
		});
		return callee.apply(this, args);
	} else if(type === "Identifier") {
		var name = node.name;
		if(name === "window") {
			return window;
		}
		return event_types[name];
	} else if(type === "ThisExpression") {
		return context;
	} else if(type === "MemberExpression") {
		var object = eval_tree(node.object, context);
		var property = eval_tree(node.property, context);
		return object[property];
	} else if(type === "Literal") {
		return node.value;
	} else {
		console.log(type, node);
	}
};


(function(proto) {
	proto.on_create = function(str, statechart) {
		this.statechart = statechart;
		this.set_str(str);
	};
	proto.clone = function() {
		return red.create_event("parsed", this.str);
	};
	proto.set_str = function(str) {
		this._str = str;
		this._update_tree();
		this._update_value();
		return this;
	};
	proto.get_str = function() { return this._str; };
	proto._update_tree = function() {
		this._tree = esprima.parse(this.get_str());
	};
	proto._update_value = function() {
		this._event = eval_tree(this._tree.body[0], this.get_context());
		this._event.on_fire(_.bind(this.on_fire, this));
	};
	proto.get_context = function() {
		var statechart = this.statechart;
		var object = statechart.get_context();
		return object;
	};
	proto.clone = function(context) {
		return cjs.create_event("parsed", this.get_str(), context);
	};
}(cjs._create_event_type("parsed").prototype));
}(cjs));
