(function(cjs, root) {
	var _ = cjs._;

	var Binding = function(options) {
		this.activated = false;
		this.activate();
		_.extend(this, options);
	};
	(function(my) {
		var proto = my.prototype;
		proto.activate = function() {
			if(!this.activated) {
				this.activated = true;
			}
		};
		proto.deactivate = function() {
			if(this.activated) {
				this.activated = false;
			}
		};
		proto.destroy = function() {
			this.deactivate();
	   	};
		proto.update = function() { };
	}(Binding));

	var create_binding = function(options) {
		return new Binding(options);
	};
	cjs.define("binding", create_binding);
}(cjs, this));
//Binding: constraint -> DOM element
