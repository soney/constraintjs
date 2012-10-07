(function(cjs, root) {
var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;
var toString = Object.prototype.toString,
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
	slice = ArrayProto.slice;
var isString = function(obj) {
	return toString.call(obj) == '[object String]';
};
var isArray = function(obj) {
	return toString.call(obj) == '[object Array]';
};
var each = function(obj, iterator, context) {
	if (obj == null) { return; }
	if (nativeForEach && obj.forEach === nativeForEach) {
		obj.forEach(iterator, context);
	} else if (obj.length === +obj.length) {
		for (var i = 0, l = obj.length; i < l; i++) {
			if (i in obj && iterator.call(context, obj[i], i, obj) === breaker) { return; }
		}
	} else {
		for (var key in obj) {
			if (has(obj, key)) {
				if (iterator.call(context, obj[key], key, obj) === breaker) { return; }
			}
		}
	}
};
var map = function(obj, iterator, context) {
	var results = [];
	if (obj == null) { return results; }
	if (nativeMap && obj.map === nativeMap) { return obj.map(iterator, context); }
	each(obj, function(value, index, list) {
		results[results.length] = iterator.call(context, value, index, list);
	});
	if (obj.length === +obj.length) { results.length = obj.length; }
	return results;
};
var extend = function(obj) {
	var args = slice.call(arguments, 1)
		, i
		, len = args.length;
	for(i = 0; i<len; i++) {
		var source = args[i];
		for (var prop in source) {
			obj[prop] = source[prop];
		}
	}
	return obj;
};

var getColorValue = function(color) {
    var t = document.createElement('div');
    t.style.display = 'none';
    t.style.color = color;
    document.body.appendChild(t);

    var style = window.getComputedStyle(t, null);
    var colorValue = style.getPropertyCSSValue('color').getRGBColorValue();
    document.body.removeChild(t);

    var hex = function(x) {
        return ('0' + parseInt(x, 10).toString(16)).slice(-2);
    }

    var hexString = '#';
    with(colorValue) {
        hexString += hex(red.cssText) + hex(green.cssText) + hex(blue.cssText);
    }

    return hexString;
};

var timings = {
	linear: function(percentage, start, end, current) {
		return percentage;
	}
	, _default: function(percentage) {
		return percentage;
	}
};
var speeds = {
	slow: 600
	, fast: 200
	, _default: 400
};
var defaults = {
	speed: "_default"
	, in_filter: function(x) {
		return x;
	}
	, out_filter: function(x) {
		return x;
	}
	, timing: "linear"
	, fps: 30
};
var get_time = function() {
	return (new Date()).getTime();
};

var hex_to_rgb = function(str) {
	var rv = [];
	for(var i = 1; i<6; i+=2) {
		rv.push(parseInt(str.substr(i, 2), 16));
	}
	return rv;
};
function decimalToHex(d, padding) {
    var hex = Number(d).toString(16);
    padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

    while (hex.length < padding) {
        hex = "0" + hex;
    }

    return hex;
}
var rgb_to_hex = function(arr) {
	var rv = "#";
	each(arr, function(item) { rv += decimalToHex(Math.round(item), 2); });
	return rv;
};

var Animation = function(options, unfiltered_from, unfiltered_to) {
	this.options = options;

	this.unfiltered_from = unfiltered_from;
	this.unfiltered_to = unfiltered_to;

	this.from = options.in_filter(this.unfiltered_from);
	this.to = options.in_filter(this.unfiltered_to);

	this.current = this.start;
	this.timing = isString(options.timing) ? (timings[options.timing] || timings._default) : options.timing;
	this.speed = isString(options.speed) ? (speeds[options.speed] || speeds._default) : options.speed;

	this.start_time = null;
	this.end_time = null;

	this.started = false;
	this.done = false;
};
(function(my) {
	var proto = my.prototype;
	proto.get = function(time) {
		if(!this.started) {
			return options.out_filter(this.from);
		} else if(this.done) {
			return options.out_filter(this.to);
		}
		time = time || get_time();
		var raw_percentage = (time - this.start_time) / (this.end_time - this.start_time);
		var percentage = this.timing(raw_percentage, this.start_time, this.end_time, this.current);

		var current_value;

		if(isArray(this.from) && isArray(this.to) &&  this.from.length === this.to.length) {
			current_value = map(this.from, function(from, index) {
				var to = this.to[index];
				return to * percentage + from * (1 - percentage);
			}, this);
		} else {
			current_value = this.to * percentage + this.from * (1 - percentage);
		}

		return this.options.out_filter(current_value);
	}
	proto.start = function() {
		this.start_time = get_time();
		this.end_time = this.start_time + this.speed;
		this.started = true;
	};
	proto.stop = function() {
		this.done = true;
		return this;
	};
}(Animation));


cjs.$.extend("anim", function(based_on, options) {
	var based_on = this;
	options = extend({}, defaults, options);

	var current_animation = null;
	var current_animation_end_timeout = null;
	var invalidation_interval = null;

	var old_val = based_on.get();
	var new_constraint = cjs.$(function() {
		if(current_animation === null) {
			return old_val;
		} else {
			var rv = current_animation.get();
			return rv;
		}
	});

	based_on.onChange(function() {
		//var animate_from = new_constraint.get();
		var animate_from;
		var orig_animate_to = animate_to = based_on.get();

		if(current_animation_end_timeout === null) {
			animate_from = old_val;
		} else {
			animate_from = new_constraint.get();
			root.clearTimeout(current_animation_end_timeout);
		}

		var default_anim_options = {};
		if(isString(animate_from) && isString(animate_to)) {
			animate_from = hex_to_rgb(getColorValue(animate_from));
			animate_to = hex_to_rgb(getColorValue(animate_to));

			default_anim_options.out_filter = rgb_to_hex;
		}

		var anim_options = extend({}, options, default_anim_options);

		current_animation = new Animation(anim_options, animate_from, animate_to);
		current_animation.start();

		invalidation_interval = setInterval(new_constraint.invalidate, 1000/options.fps);
		current_animation_end_timeout = root.setTimeout(function() {
			current_animation_end_timeout = null;
			current_animation = null;
			root.clearInterval(invalidation_interval);
			invalidation_interval = null;
			new_constraint.invalidate();
		}, current_animation.speed);
		old_val = orig_animate_to;
	});

	return new_constraint;
});
}(cjs, this));
