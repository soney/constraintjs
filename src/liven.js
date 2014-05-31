// Liven
// -----

// Will automatically call the provided function when it becomes invalid
extend(cjs, {
	/**
	 * Memoize a function to avoid unnecessary re-evaluation. Its options are:
	 *
	 * - `context`: The context in which `func` should be evaluated
	 * - `run_on_create`: Whether to run `func` immediately after creating the live function. (default: `true`)
	 * - `pause_while_running`: Whether to explicitly prevent this live function from being called recursively (default: `false`)
	 * - `on_destroy`: A function to call when `destroy` is called (default: `false`)
	 *
	 * The return value of this method also has two functions:
	 * - `pause`: Pause evaluation of the live function
	 * - `resume`: Resume evaluation of the live function
	 * - `run`: Run `func` if it's invalid
	 *
	 * @method cjs.liven
	 * @param {function} func - The function to make live
	 * @param {object} [options] - A set of options to control how liven works
	 * @return {object} An object with properties `destroy`, `pause`, `resume`, and `run`
	 *
	 * @example
	 *     var x_val = cjs(0);
	 *     var api_update = cjs.liven(function() {
	 *         console.log('updating other x');
	 *         other_api.setX(x_val);
	 *     }); // 'updating other x'
	 *     x_val.set(2); // 'updating other x'
	 *		
	 */
	liven:	function (func, options) {
				options = extend({
					context: root, // what to equate `this` to
					run_on_create: true, // whether it should run immediately
					pause_while_running: false, // whether to allow the function to be called recursively (indirectly)
					on_destroy: false // a function to call when this liven function is destroyed
				}, options);

				//Make constraint-aware values just by calling func in a constraint
				var node = new Constraint(func, {
					context: options.context,
					cache_value: false,
					auto_add_outgoing_dependencies: false,
					run_on_add_listener: !!options.run_on_create
				});

				// check if running
				var paused = false;
				var do_get;

				var invalidate = function() {
					node.invalidate();
				};

				// Destroy the node and make sure no memory is allocated
				var destroy = function (silent) {
					if(options.on_destroy) {
						options.on_destroy.call(options.context, silent);
					}
					node.destroy(silent);
				};

				// Stop changing and remove it from the event queue if necessary
				var pause = function () {
					if(paused === false) {
						paused = true;
						node.offChange(do_get);
						return true; // successfully paused
					}
					return false;
				};

				// Re-add to the event queue
				var resume = function () {
					if(paused === true) {
						paused = false;
						node.onChange(do_get);
						return true; // successfully resumed
					}
					return false;
				};

				// The actual getter, will call the constraint's getter
				do_get = function () {
					if (options.pause_while_running) {
						pause();
					}
					node.get();
					if (options.pause_while_running) {
						resume();
					}
				};

				// When the value changes, call do_get
				node.onChange(do_get);

				var rv = {
					destroy: destroy,
					pause: pause,
					resume: resume,
					run: function(arg0) {
						do_get(arg0);
						return this;
					},
					invalidate: invalidate,
					_constraint: node // for debugging purposes
				};
				return rv;
			}
});
