/*global document:true */
(function(cjs, root) {if(!cjs._is_node) {
var _ = cjs._;
/*

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

cjs.touches = cjs([]);
root.addEventListener("touchstart", function(event) {
	cjs.touches.set(event.touches);
});
root.addEventListener("touchmove", function(event) {
	cjs.touches.set(event.touches);
});
root.addEventListener("touchend", function(event) {
	cjs.touches.set(event.touches);
});
*/

}}(cjs, this));
