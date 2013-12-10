	// extend the standard constraint constructor so that any constraint can have its values depend on an fsm
	Constraint.prototype.inFSM = function(fsm, values) {
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

	extend(cjs, {
		inFSM: function(fsm, values) {
			return (new Constraint()).inFSM(fsm, values);
		}
	});
