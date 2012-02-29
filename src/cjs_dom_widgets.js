/*global document:true */
(function(cjs, root) {if(!cjs._is_node) {
var _ = cjs._;

var mouse = {
	x: cjs.constraint()
	, y: cjs.constraint()
};

root.addEventListener("mousemove", function(event) {
	mouse.x.set(event.pageX);
	mouse.y.set(event.pageY);
});

cjs.mouse = mouse;


var modifiers = {alt: false, ctrl: false, shift: false};
var keyboard = {
	pressed: cjs.constraint([])
	, modifiers : cjs.constraint(modifiers)
};


var update_modifiers = function(event) {
	var new_modifiers = {
		alt: event.altKey
		, ctrl: event.ctrlKey
		, shift: event.shiftKey
	};

	if(!_.isEqual(new_modifiers, modifiers)) {
		modifiers = new_modifiers;
		keyboard.modifiers.set(modifiers);
	}
};

var pressed_keys = [];
root.addEventListener("keydown", function(event) {
	update_modifiers(event);

	var keyCode = event.keyCode;
	pressed_keys = _.union(pressed_keys, [keyCode]);
	keyboard.pressed.set(pressed_keys);
});

root.addEventListener("keyup", function(event) {
	update_modifiers(event);

	var keyCode = event.keyCode;
	pressed_keys = _.without(pressed_keys, keyCode);
	keyboard.pressed.set(pressed_keys);
});

cjs.keyboard = keyboard;

cjs.time = cjs.constraint(function() {
	return (new Date()).getTime();
});
root.setInterval(_.bind(cjs.time.nullify, cjs.time), 10);


cjs.bind = function(obj, prop_name, constraint, setter) {
	if(!_.isFunction(setter)) {
		setter = function(o, pn, v) {
			o[pn] = v;
		};
	} 
	var update = function(value) {
		setter(obj, prop_name, value);
	};

	_.defer(function() {
		update(constraint.get());

		constraint.onChange(update);
	});

	return _.bind(cjs.unbind, cjs, constraint, update);
};
cjs.unbind = function(constraint, update) {
	constraint.offChange(update);
};

cjs.css = function(elem, prop_name, constraint) {
	var name = _.camel_case(prop_name);
	return cjs.bind(elem.style, name, constraint);
};

cjs.attr = function(elem, prop_name, constraint) {
	return cjs.bind(elem, prop_name, constraint, function(obj, name, value) {
		obj.setAttribute(name, value);
	});
};

cjs.text = function(elem, constraint) {
/*
	var textnode = document.createTextNode();
	var unbind_text_node = cjs.bind(textnode, "nodeValue", constraint);
	var unbind_children_constraint = cjs.children(elem, [textnode], unbind_text_node);

	return function() {
		unbind_text_node();
		unbind_children_constraint();
	};
	*/
	return cjs.children(elem, constraint);
};

cjs['class'] = function(elem, constraint) {
	return cjs.bind(elem, "className", constraint);
};

var insert_at = function(child_node, parent_node, index) {
	var children = parent_node.childNodes;
	if(children.length <= index) {
		parent_node.appendChild(child_node);
	} else {
		var before_child = children[index];
		parent_node.insertBefore(child_node, before_child);
	}
};
var remove = function(child_node) {
	var parentNode = child_node.parentNode;
	if(parentNode !== null) {
		parentNode.removeChild(child_node);
	}
};

var remove_index = function(parent_node, index) {
	var children = parent_node.childNodes;
	if(children.length > index) {
		var child_node = children[index];
		remove(child_node);
	}
};

var move_child = function(parent_node, to_index, from_index) {
	var children = parent_node.childNodes;
	if(children.length > from_index) {
		var child_node = children[from_index];
		if(parent_node) {
			if(from_index < to_index) { //If it's less than the index we're inserting at...
				to_index++; //Increase the index by 1, to make up for the fact that we're removing me at the beginning
			}
			insert_at(child_node, parent_node, to_index);
		}
	}
};

var element_data = [];

var get_data_obj = function(elem) {
	var data_obj_index = _.index_where(element_data, function(obj) {
		return obj.elem === elem;
	});

	if(data_obj_index < 0) {
		return null;
	} else {
		return element_data[data_obj_index];
	}
};

var get_data = function(elem, key) {
	var data_obj = get_data_obj(elem);

	if(data_obj === null) {
		return null;
	} else {
		return data_obj.data[key];
	}
};

var set_data = function(elem, key, value) {
	var data_obj = get_data_obj(elem);

	if(data_obj === null) {
		data_obj = {
			elem: elem
			, data: {}
		};
		element_data.push(data_obj);
	}

	data_obj.data[key] = value;
};


var convert_item = function(item) {
	if(_.isElement(item)) {
		return item;
	} else {
		var node = document.createTextNode(item);
		return node;
	}
};

cjs.children = function(elem) {
	var child_constraints = _.rest(arguments);

	var constraint = cjs.create("simple_constraint", function() {
		var c_constraints = _(child_constraints).chain()
												.map(function(x) {
													return cjs.get(x);
												})
												.flatten(true) //Flatten on a single level
												.value();
		return c_constraints;
	});

	var _children = [];

	var do_unbind = function() { };
	var unbind = function() {
		do_unbind();
	};

	_.defer(function() {
		var unbind_children_constraint = get_data(elem, "unbind_children_constraint");
		set_data(elem, "unbind_children_constraint", unbind);
		if(_.isFunction(unbind_children_constraint)) {
			unbind_children_constraint();
		}

		var value = cjs.get(constraint);
		//First clear the existing children of the element
		_.times(elem.childNodes.length, function() {
			elem.removeChild(elem.firstChild);
		});

		if(!_.isArray(value)) {
			value = [value];
		}

		if(_.isElement(elem)) {
			//Then get the current value of the constraint...
			//and append all the children
			_.forEach(value, function(child) {
				var item = convert_item(child);
				elem.appendChild(item);
			});
		} else if(_.isTextElement(elem)) {
			elem.nodeValue = _.map(value, function(child) {
				return String(child);
			}).join("");
		}

		_children = _.clone(value);


		if(cjs.is_constraint(constraint)) {
			constraint.onChange(function(children) {
				if(!_.isArray(children)) {
					children = [children];
				}
				if(_.isElement(elem)) {
					var diff = _.diff(_children, children)
						, removed = diff.removed
						, added = diff.added
						, moved = diff.moved;

					_.forEach(removed, function(x) {
						remove_index(elem, x.index);
					});
					_.forEach(added, function(x) {
						var item = convert_item(x.item);
						insert_at(item, elem, x.index);
					});
					_.forEach(moved, function(x) {
						move_child(elem, x.to_index, x.from_index);
					});
				
					_children = _.clone(children); //Value may be mutated, so clone it
				} else if(_.isTextElement(elem)) {
					elem.nodeValue = _.map(children, function(child) {
						return String(child);
					}).join("");
				}
			});

			var last_listener = constraint.last_listener;
			do_unbind = function() {
				constraint.offChange(last_listener);
			};
		}
	});


	return unbind;
};

}}(cjs, this));
