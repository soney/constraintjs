(function (cjs, root) {
var _ = cjs._;
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
	, timing: "ease-in-out"
};
var get_time = function() {
	return (new Date()).getTime();
};

var Animation = function(options, unfiltered_from, unfiltered_to) {
	this.options = options;

	this.unfiltered_from = unfiltered_from;
	this.unfiltered_to = unfiltered_to;

	this.from = options.in_filter(this.unfiltered_from);
	this.to = options.in_filter(this.unfiltered_to);

	this.current = this.start;
	this.timing = _.isString(options.timing) ? (timings[options.timing] || timings._default) : options.timing;
	this.speed = _.isString(options.speed) ? (speeds[options.speed] || speeds._default) : options.speed;

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

		if(_.isArray(this.from) && _.isArray(this.to) &&  _.size(this.from) === _.size(this.to)) {
			current_value = _.map(this.from, function(from, index) {
				var to = this.to[index];
				return to * percentage + from * (1 - percentage);
			});
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

cjs.constraint.raw_mixin("anim", function(based_on, options) {
	options = _.extend({}, defaults, options);
	var current_animation = null;
	var current_animation_end_timeout = null;

	based_on.onChange(function(new_val, old_val) {
		if(current_animation_end_timeout !== null) {
			root.clearTimeout(current_animation_end_timeout);
		}

		current_animation = new Animation(_.clone(options), old_val, new_val);
		current_animation.start();

		current_animation_end_timeout = root.setTimeout(function() {
			current_animation_end_timeout = null;
			current_animation = null;
		}, current_animation.speed);
	});

	var new_constraint = cjs.create("constraint", function() {
		if(current_animation === null) {
			return cjs.get(based_on);
		} else {
			var rv = current_animation.get();
			_.defer(function() {
				new_constraint.nullify();
			});
			return rv;
		}
	});
	return new_constraint;
});
}(cjs, this));
