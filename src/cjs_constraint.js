(function(cjs) {
	var _ = cjs._;
	var constraint_solver = cjs._constraint_solver;

	var Constraint = function() {
		constraint_solver.addObject(this);
		this.literal = false;
		this.set.apply(this, arguments);
	};

	(function(my) {
		var proto = my.prototype;
		proto.nullify = function() {
			constraint_solver.nullify(this);
		};
		proto.cs_eval = function() {
			if(this.hasOwnProperty("value")) {
				if(this.literal) {
					return this.value;
				} else {
					return this.value();
				}
			} else {
				return undefined;
			}
		};
		proto.set = function(value, literal) {
			var was_literal = this.literal;
			var old_value = this.value;

			if(arguments.length < 2) {
				this.literal = !_.isFunction(value);
			} else {
				this.literal = literal === true;
			}
			this.value = value;

			
			if(was_literal !== this.literal || old_value !== this.value) {
				this.nullify();
			}
		};
		proto.get = function() {
			return constraint_solver.getValue(this);
		};
	}(Constraint));

	var create_constraint = function(getter, literal) {
		if(arguments.length === 1) {
			return new Constraint(getter);
		} else {
			return new Constraint(getter, literal);
		}
	};

	cjs.define("basic_constraint", create_constraint);


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
}(cjs));
