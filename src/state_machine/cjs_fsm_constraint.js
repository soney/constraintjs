	// A constraint whose value depends on an fsm's value
	var FSMConstraint = function(fsm, values, options) {
		// call the Constraint constructor
		FSMConstraint.superclass.constructor.call(this, undefined, options);
		this.inFSM(fsm, values);
	};
	(function(my) {
		proto_extend(my, Constraint);
		var proto = my.prototype;
		proto.inFSM = function(fsm, values) {
			each(values, function(v, k) {
				// add listeners to the fsm for that state that will set my getter's value
				fsm.on(k, function() {
					this.set(v);
				}, this);

				if(fsm.is(k)) {
					this.set(v);
				}
			}, this);
			return this;
		};
	}(FSMConstraint));

	extend(cjs, {
		inFSM: function(fsm, values, options) {
			return new FSMConstraint(fsm, values, options);
		},
		FSMConstraint: FSMConstraint
	});
