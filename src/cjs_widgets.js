(function(cjs, root) {if(!cjs._is_node) {
var _ = cjs._;

var mouse = {
	$x: cjs.$()
	, $y: cjs.$()
};

root.addEventListener("mousemove", function(event) {
	mouse.$x.set(event.pageX);
	mouse.$y.set(event.pageY);
});

cjs.mouse = mouse;


var modifiers = {alt: false, ctrl: false, shift: false};
var keyboard = {
	$pressed: cjs.$([])
	, $modifiers : cjs.$(modifiers)
};


var update_modifiers = function(event) {
	var new_modifiers = {
		alt: event.altKey
		, ctrl: event.ctrlKey
		, shift: event.shiftKey
	};

	if(!_.isEqual(new_modifiers, modifiers)) {
		modifiers = new_modifiers;
		keyboard.$modifiers.set(modifiers);
	}
};

var pressed_keys = [];
root.addEventListener("keydown", function(event) {
	update_modifiers(event);

	var keyCode = event.keyCode;
	pressed_keys = _.union(pressed_keys, [keyCode]);
	keyboard.$pressed.set(pressed_keys);
});

root.addEventListener("keyup", function(event) {
	update_modifiers(event);

	var keyCode = event.keyCode;
	pressed_keys = _.without(pressed_keys, keyCode);
	keyboard.$pressed.set(pressed_keys);
});

cjs.keyboard = keyboard;

cjs.$time = cjs.$(function() {
	return (new Date()).getTime();
});
root.setInterval(_.bind(cjs.$time.nullify, cjs.$time), 10);


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

}}(cjs, this));
