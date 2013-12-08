	var FSMConstraint = function(options) {
		FSMConstraint.superclass.constructor.call(this, this._getter, extend({context: this}, options));
		this.$getter = cjs.constraint(undefined, {literal: true});
	};
	(function(my) {
		proto_extend(my, Constraint);
		var proto = my.prototype;

		proto._getter = function() {
			var getter = this.$getter.get();
			return isFunction(getter) ? getter.call(this) : cjs.get(getter);
		};
		proto.inFSM = function(fsm, values) {
			each(values, function(v, k) {
				fsm.on(k, function() {
					this.$getter.set(v);
				}, this);
				if(fsm.is(k)) {
					this.$getter.set(v);
				}
			}, this);
			return this;
		};
	}(FSMConstraint));

	cjs.inFSM = function() {
		var constraint = new FSMConstraint();
		return constraint.inFSM.apply(constraint, arguments);
	};
	cjs.FSMConstraint = FSMConstraint;
