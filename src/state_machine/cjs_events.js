	var CJSEvent = function() {
	};
	(function(my) {
		var proto = my.prototype;
		proto.guard = function(filter) {
			return new CJSEvent();
		};
	}(CJSEvent));
	cjs.on = function(event_type, target) {
		if(event_type === "timeout") {
		} else if(event_type === "interval") {
		} else if(event_type === "frame") {
		} else {
		}

		var context = this;

		var rv = function(do_something) {
			target.addEventListener(event_type, do_something);
		};

		rv.guard = function(guard_func) {
			return function(do_something) {
				target.addEventListener(event_type, function() {
					var args = _.toArray(arguments);
					if(guard_func.apply(context, args)) {
						do_something.apply(context, args);
					}
				});
			};
		};

		return rv;
	};
