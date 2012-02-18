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


cjs.bind = function(obj, prop_name, constraint) {
	var update = function(value) {
		obj[prop_name] = value;
	};

	update(constraint.get());
	constraint.onChange(update);

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
	return cjs.bind(elem, prop_name, constraint);
};

cjs.text = function(elem, constraint) {
	return cjs.bind(elem, "textContent", constraint);
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

var move = function(child_node, to_index, from_index) {
	var parent_node = child_node.parentNode;
	if(parent_node) {
		if(from_index < to_index) { //If it's less than the index we're inserting at...
			to_index++; //Increase the index by 1, to make up for the fact that we're removing me at the beginning
		}
		insert_at(child_node, parent_node, to_index);
	}
};


cjs.children = function(elem, constraint) {
	//First clear the existing children of the element
	_.times(elem.childNodes.length, function() {
		elem.removeChild(elem.firstChild);
	});

	var value = cjs.get(constraint);
	//Then get the current value of the constraint...
	//and append all the children
	_.forEach(value, function(child) {
		elem.appendChild(child);
	});

	var _children = _.clone(value);

	constraint.onChange(function(children) {
		var diff = _.diff(_children, children)
			, removed = diff.removed
			, added = diff.added
			, moved = diff.moved;


		_.forEach(removed, function(x) {
			remove(x.item);
		});
		_.forEach(added, function(x) {
			insert_at(x.item, elem, x.index);
		});
		_.forEach(moved, function(x) {
			move(x.item, x.to_index, x.from_index);
		});
	
		_children = _.clone(children); //Value may be mutated, so clone it
	});
};

}}(cjs, this));
