	//
	// ============== LIVEN ============== 
	//

	cjs.liven = function (func, options) {
		options = extend({
			context: this,
			run_on_create: true,
			pause_while_running: false
		}, options);

		var node = constraint_solver.add({
			cjs_getter: function () {
				func.call(options.context);
			},
			auto_add_outgoing_dependencies: false,
			cache_value: false
		});

		var do_get;
		var destroy = function () {
			constraint_solver.off_nullify(node, do_get);
			if(options.on_destroy) {
				options.on_destroy.call(options.context);
			}
			constraint_solver.removeObject(node);
		};
		var pause = function () {
			constraint_solver.off_nullify(node, do_get);
			return this;
		};
		var resume = function () {
			constraint_solver.on_nullify(node, do_get);
			return this;
		};
		var run = function () {
			do_get();
			return this;
		};

		do_get = function () {
			if (options.pause_while_running) {
				pause();
			}
			constraint_solver.getNodeValue(node);
			if (options.pause_while_running) {
				resume();
			}
		};

		constraint_solver.on_nullify(node, do_get);
		if (options.run_on_create !== false) {
			do_get.__in_cjs_call_stack__ = true;
			constraint_solver.nullified_call_stack.push(do_get);

			if (constraint_solver.semaphore >= 0 && constraint_solver.nullified_call_stack.length > 0) {
				constraint_solver.run_nullified_listeners();
			}
		}

		var rv = {
			destroy: destroy,
			pause: pause,
			resume: resume,
			run: run
		};
		rv[SECRET_NODE_NAME] = node;
		return rv;
	};
