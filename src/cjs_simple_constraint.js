(function(cjs) {
	var _ = cjs._;
	var constraint_solver = cjs._constraint_solver;

	cjs.fn = {};

	var Constraint = function() {
		constraint_solver.addObject(this);
		this.literal = false;
		this.set.apply(this, arguments);
	};

	(function(my) {
		my.prototype = cjs.fn;

		var proto = my.prototype;
		proto.nullify = function() {
			constraint_solver.nullify(this);
		};
		proto.nullifyAndEval = function() {
			constraint_solver.nullifyAndEval(this);
		};
		proto.cs_eval = function() {
			if(this.hasOwnProperty("value")) {
				if(this.literal) {
					return this.value;
				} else if(_.isFunction(this.value)){
					return this.value();
				} else {
					return cjs.get(this.value);
				}
			} else {
				return undefined;
			}
		};
		proto.set = function(value, literal, update_fn) {
			var was_literal = this.literal;
			var old_value = this.value;

			if(arguments.length < 2) {
				this.literal = !_.isFunction(value) && !cjs.is_constraint(value);
			} else {
				this.literal = literal === true;
			}

			this.value = value;

			
			if(was_literal !== this.literal || old_value !== this.value) {
				this.nullify();
			}

			if(_.isFunction(update_fn)) {
				this.update(update_fn);
			}
		};
		proto.get = function() {
			return constraint_solver.getValue(this);
		};
		proto.update = function(arg0) {
			if(arguments.length === 0) {
				this.nullify();
			} else {
				var self = this;
				var do_nullify = function() {
					self.nulllify();
				};
				if(_.isFunction(arg0)) {
					arg0(do_nullify);
				}
			}
			return this;
		};
	}(Constraint));

	var create_constraint = function(arg0, arg1, arg2, arg3) {
		var constraint;
		if(arguments.length === 0) {
			constraint = new Constraint(undefined);
		} else if(arguments.length === 1) {
			constraint = new Constraint(arg0);
		} else {
			if(arguments.length === 2 && _.isBoolean(arg1)) {
				constraint = new Constraint(arg0, arg1);
			} else {
				constraint = new Constraint(arg0, arg1, arg2, arg3);
			}
		}

		return constraint;
	};

	cjs.define("simple_constraint", create_constraint);


	var is_constraint = function(obj) {
		return obj instanceof Constraint;
	};
	cjs.is_constraint = is_constraint;
	cjs.get = function(obj) {
		if(is_constraint(obj)) {
			return obj.get();
		} else {
			return obj;
		}
	};
	cjs.type("simple_constraint", Constraint);
}(cjs));
