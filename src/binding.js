var make_node = function(item) { // Check if the argument is a DOM node or create a new textual node with its contents
		if(isAnyElement(item)) {
			return item;
		} else {
			var node = doc.createTextNode(item);
			return node;
		}
	},
	insert_at = function(child_node, parent_node, index) {
		// Utility function to insert child_node as the index-th child of parent_node
		var children = parent_node.childNodes;
		if(children.length <= index) {
			parent_node.appendChild(child_node);
		} else {
			var before_child = children[index];
			parent_node.insertBefore(child_node, before_child);
		}
	},
	remove_index = function(parent_node, index) {
		// Utility to remove a child DOM node by index
		var children = parent_node.childNodes, child_node;
		if(children.length > index) {
			child_node = children[index];
			parent_node.removeChild(child_node);
			return child_node;
		}
	},
	move_child = function(parent_node, to_index, from_index) {
		// Utility to move a child DOM node by indices
		var children = parent_node.childNodes;
		if(children.length > from_index) {
			var child_node = children[from_index];
			if(parent_node) {
				if(from_index < to_index) { //If it's less than the index we're inserting at...
					to_index++; //Increase the index by 1, to make up for the fact that we're removing me at the beginning
				}
				insert_at(child_node, parent_node, to_index);
			}
			return child_node;
		}
	},
	// Check if jQuery is available
	is_jquery_obj = function(x) {
		return has(root, "jQuery") ? (x instanceof root.jQuery) : false;
	},
	nList = root.NodeList || false,
	// a node list is what is returned when you call getElementsByTagName, etc.
	isNList = nList ? function(x) { return x instanceof nList; } : function() { return false; },

	// Convert an object that can be passed into a binding into an array of dom elements
	get_dom_array = function(obj) {
		if(isArray(obj)) { // already an array
			return obj;
		} else if (is_constraint(obj)) { // regular constraint
			return get_dom_array(obj.get());
		} else if(is_array(obj)) { // array constraint
			return obj.toArray();
		} else if(is_map(obj)) { // map constraint
			return obj.values();
		} else if(is_jquery_obj(obj)) { // jQuery object
			return root.jQuery.makeArray(obj);
		} else if(isNList(obj)) { // node list
			return toArray(obj);
		} else { // hopefully just an element; return its value as an array
			return [obj];
		}
	};

/**
 * A binding calls some arbitrary functions passed into options. It is responsible for keeping some aspect of a
 * DOM node in line with a constraint value. For example, it might keep an element's class name in sync with a
 * class_name constraint
 *
 * @private
 * @class cjs.Binding
 * @param {object} options
 * @classdesc Bind a DOM node property to a constraint value
 */
var Binding = function(options) {
	this.options = options;
	this.targets = options.targets; // the DOM nodes
	var setter = options.setter, // a function that sets the attribute value
		getter = options.getter, // a function that gets the attribute value
		init_val = options.init_val, // the value of the attribute before the binding was set
		curr_value, // used in live fn
		last_value, // used in live fn
		old_targets = [], // used in live fn
		do_update = function() {
			this._timeout_id = false; // Make it clear that I don't have a timeout set
			var new_targets = filter(get_dom_array(this.targets), isAnyElement); // update the list of targets

			if(has(options, "onChange")) {
				options.onChange.call(this, curr_value, last_value);
			}

			// For every target, update the attribute
			each(new_targets, function(target) {
				setter.call(this, target, curr_value, last_value);
			}, this);

			// track the last value so that next time we call diff
			last_value = curr_value;
		};
	this._throttle_delay = false; // Optional throttling to improve performance
	this._timeout_id = false; // tracks the timeout that helps throttle

	if(isFunction(init_val)) { // If init_val is a getter, call it on the first element
		last_value = init_val(get_dom_array(this.targets[0]));
	} else { // Otherwise, just take it as is
		last_value = init_val;
	}

	this.$live_fn = cjs.liven(function() {
		curr_value = getter(); // get the value once and inside of live fn to make sure a dependency is added

		if(this._throttle_delay) { // We shouldn't update values right away
			if(!this._timeout_id) { // If there isn't any timeout set yet, then set a timeout to delay the call to do update
				this._timeout_id = sTO(bind(do_update, this), this._throttle_delay);
			}
		} else { // we can update the value right away if no throttle delay is set
			do_update.call(this);
		}
	}, {
		context: this
	});
};

(function(my) {
	/** @lends cjs.Binding.prototype */
	var proto = my.prototype;
	/**
	 * Pause binding (no updates to the attribute until resume is called)
	 *
	 * @method pause
	 * @return {Binding} `this`
	 * @see resume
	 * @see throttle
	 */
	proto.pause = function() { this.$live_fn.pause(); return this; };

	/**
	 * Resume binding (after pause)
	 *
	 * @method resume
	 * @return {Binding} `this`
	 * @see pause
	 * @see throttle
	 */
	proto.resume = function() { this.$live_fn.resume(); return this; };


	/**
	 * Require at least `min_delay` milliseconds between setting the attribute
	 *
	 * @method throttle
	 * @param {number} min_delay - The minimum number of milliseconds between updates
	 * @return {Binding} `this`
	 * @see pause
	 * @see resume
	 */
	proto.throttle = function(min_delay) {
		this._throttle_delay = min_delay > 0 ? min_delay : false; // Make sure it's positive
		if(this._timeout_id && !this._throttle_delay) { // If it was specified that there should be no delay and we are waiting for a re-eval
			cTO(this._timeout_id); // then prevent that re-eval
			this._timeout_id = false;
		}
		// regardless, run the live fn again
		this.$live_fn.run();
		return this;
	};

	/**
	 * Stop updating the binding and try to clean up any memory
	 *
	 * @method destroy
	 * @return {undefined}
	 * @see pause
	 * @see resume
	 * @see throttle
	 */
	proto.destroy = function() {
		this.$live_fn.destroy();
		if(this.options.onDestroy) {
			this.options.onDestroy();
		}
		if(this.options.coreDestroy) {
			this.options.coreDestroy();
		}
	};
}(Binding));
/** @lends */

// Creates a type of binding that accepts any number of arguments and then sets an attribute's value to depend on
// every element that was passed in
var create_list_binding = function(list_binding_getter, list_binding_setter, list_binding_init_value) {
		return function(elements) { // The first argument is a list of elements
			var args = slice.call(arguments, 1), // and the rest are values
				val = cjs(function() { // Create a constraint so that the binding knows of any changes
					return list_binding_getter(args);
				});

			var binding = new Binding({
				targets: elements,
				getter: bind(val.get, val), // use the constraint's value as the getter
				setter: list_binding_setter,
				init_val: list_binding_init_value,
				coreDestroy: function() {
					val.destroy(); // Clean up the constraint when we are done
				}
			});
			return binding;
		};
	},
	create_textual_binding = function(setter) { // the text value of a node is set to the concatenation of every argument
		return create_list_binding(function(args) {
			return map(args, cjs.get).join("");
		}, function(element, value) {
			setter(element, value);
		});
	},
	// a binding that accepts either a key and a value or an object with any number of keys and values
	create_obj_binding = function(obj_binding_setter) {
		return function(elements) {
			var vals,
				args = slice.call(arguments, 1);
			if(args.length === 0) { // need at least one argument
				return;
			} else if(args.length === 1) { // an object with keys and values was passed in
				vals = args[0];
			} else if(args.length > 1) { // the first argument was the key, the second was a value
				vals = {};
				vals[args[0]] = args[1];
			}

			var binding = new Binding({
				targets: elements,
				setter: function(element, value) {
					each(value, function(v, k) {
						obj_binding_setter(element, k, v);
					});
				},
				getter: function() {
					if(is_map(vals)) {
						return vals.toObject();
					} else {
						var rv = {};
						each(vals, function(v, k) {
							rv[k] = cjs.get(v);
						});
						return rv;
					}
				}
			});

			return binding;
		};
	};

	/**
	 * Constrain a DOM node's text content
	 *
	 * @method cjs.bindText
	 * @param {dom} element - The DOM element
	 * @param {*} ...values - The desired text value
	 * @return {Binding} - A binding object
	 * @example If `my_elem` is a dom element
	 *
	 *     var message = cjs('hello');
	 *     cjs.bindText(my_elem, message);
	 */
var text_binding = create_textual_binding(function(element, value) { // set the escaped text of a node
		setTextContent(element, value);
	}),

	/**
	 * Constrain a DOM node's HTML content
	 *
	 * @method cjs.bindHTML
	 * @param {dom} element - The DOM element
	 * @param {*} ...values - The desired html content
	 * @return {Binding} - A binding object
	 * @example If `my_elem` is a dom element
	 *
	 *     var message = cjs('<b>hello</b>');
	 *     cjs.bindHTML(my_elem, message);
	 */
	html_binding = create_textual_binding(function(element, value) { // set the non-escaped inner HTML of a node
		element.innerHTML = value;
	}),

	/**
	 * Constrain a DOM node's value
	 *
	 * @method cjs.bindValue
	 * @param {dom} element - The DOM element
	 * @param {*} ...values - The value the element should have
	 * @return {Binding} - A binding object
	 * @example If `my_elem` is a text input element
	 *
	 *     var value = cjs('hello');
	 *     cjs.bindValue(my_elem, message);
	 */
	val_binding = create_textual_binding(function(element, value) { // set the value of a node
		element.val = value;
	}),

	/**
	 * Constrain a DOM node's class names
	 *
	 * @method cjs.bindClass
	 * @param {dom} element - The DOM element
	 * @param {*} ...values - The list of classes the element should have. The binding automatically flattens them.
	 * @return {Binding} - A binding object
	 * @example If `my_elem` is a dom element
	 *
	 *     var classes = cjs('class1 class2');
	 *     cjs.bindClass(my_elem, classes);
	 */
	class_binding = create_list_binding(function(args) { // set the class of a node
		return flatten(map(args, cjs.get), true);
	}, function(element, value, old_value) {
		// Compute difference so that old class values remain
		var ad = get_array_diff(old_value, value),
			curr_class_name = " " + element.className + " "; // add spaces so that the replace regex doesn't need extra logic

		// take out all of the removed classes
		each(ad.removed, function(removed_info) { curr_class_name = curr_class_name.replace(" " + removed_info.from_item + " ", " "); });
		// and add all of the added classes
		curr_class_name += map(ad.added, function(x) { return x.item; }).join(" ");

		curr_class_name = trim(curr_class_name); // and trim to remove extra spaces

		element.className = curr_class_name; // finally, do the work of setting the class
	}, []), // say that we don't have any classes to start with

	/**
	 * Constrain a DOM node's children
	 *
	 * @method cjs.bindChildren
	 * @param {dom} element - The DOM element
	 * @param {*} ...elements - The elements to use as the constraint. The binding automatically flattens them.
	 * @return {Binding} - A binding object
	 * @example If `my_elem`, `child1`, and `child2` are dom elements
	 *
	 *     var nodes = cjs(child1, child2);
	 *     cjs.bindChildren(my_elem, nodes);
	 */
	children_binding = create_list_binding(function(args) {
		var arg_val_arr = map(args, cjs.get);
		return map(flatten(arg_val_arr, true), make_node);
	}, function(element, value, old_value) {
		var ad = get_array_diff(old_value, value);
		each(ad.removed, function(removed_info) {
			var child_node = remove_index(element, removed_info.from);
			if(this.options.onRemove) {
				this.options.onRemove.call(this, child_node, removed_info.from);
			}
		}, this);
		each(ad.added, function(added_info) {
			var child_node = added_info.item;
			insert_at(child_node, element, added_info.to);
			if(this.options.onAdd) {
				this.options.onAdd.call(this, child_node, added_info.to);
			}
		}, this);
		each(ad.moved, function(moved_info) {
			var child_node = move_child(element, moved_info.to_index, moved_info.from_index);
			if(this.options.onMove) {
				this.options.onMove.call(this, child_node, moved_info.to_index, moved_info.from_index);
			}
		}, this);

		if(this.options.onIndexChange) {
			each(ad.index_changed, function(ic_info) {
				this.options.onIndexChange.call(this, ic_info.item, ic_info.to, ic_info.from);
			}, this);
		}
	}, function(element) {
		return toArray(element.childNodes);
	}),

	/**
	 * Constrain a DOM node's CSS style
	 *
	 * @method cjs.bindCSS
	 * @param {dom} element - The DOM element
	 * @param {object} values - An object whose key-value pairs are the CSS property names and values respectively
	 * @return {Binding} - A binding object representing the link from constraints to CSS styles
	 *
	 * @example If `my_elem` is a dom element
	 *
	 *     var color = cjs('red'),
	 *     left = cjs(0);
	 *     cjs.bindCSS(my_elem, {
	 *         "background-color": color,
	 *         left: left.add('px')
	 *     });
	 */
	/**
	 * Constrain a DOM node's CSS style
	 *
	 * @method cjs.bindCSS^2
	 * @param {string} key - The name of the CSS attribute to constraint
	 * @param {cjs.Constraint|string} value - The value of this CSS attribute
	 * @return {Binding} - A binding object representing the link from constraints to elements
	 *
	 * @example If `my_elem` is a dom element
	 *
	 *     var color = cjs('red');
	 *     cjs.bindCSS(my_elem, ''background-color', color);
	 */
	css_binding = create_obj_binding(function(element, key, value) {
		element.style[camel_case(key)] = value;
	}),

	/**
	 * Constrain a DOM node's attribute values
	 *
	 * @method cjs.bindAttr
	 * @param {dom} element - The DOM element
	 * @param {object} values - An object whose key-value pairs are the attribute names and values respectively
	 * @return {Binding} - A binding object representing the link from constraints to elements
	 *
	 * @example If `my_elem` is an input element
	 *
	 *     var default_txt = cjs('enter name');
	 *     cjs.bindAttr(my_elem, 'placeholder', default_txt);
	 */
	/**
	 * Constrain a DOM node's attribute value
	 *
	 * @method cjs.bindAttr^2
	 * @param {string} key - The name of the attribute to constraint
	 * @param {cjs.Constraint|string} value - The value of this attribute
	 * @return {Binding} - A binding object representing the link from constraints to elements
	 *
	 * @example If `my_elem` is an input element
	 *
	 *     var default_txt = cjs('enter name'),
	 *         name = cjs('my_name');
	 *     cjs.bindAttr(my_elem, {
	 *         placeholder: default_txt,
	 *         name: name
	 *     });
	 */
	attr_binding = create_obj_binding(function(element, key, value) {
		if(fillAttrs[key] && !value) { // attributes like disabled that should be there or not
			element.removeAttribute(key);
		} else {
			element.setAttribute(key, value);
		}
	});

var inp_change_events = ["keyup", "input", "paste", "propertychange", "change"],
	/**
	 * Take an input element and create a constraint whose value is constrained to the value of that input element
	 *
	 * @method cjs.inputValue
	 * @param {dom} inp - The input element
	 * @return {cjs.Constraint} - A constraint whose value is the input's value
	 *
	 * @example If `name_input` is an input element
	 *
	 *     var name = cjs.inputValue(name_input),
	 */
	getInputValueConstraint = function(inps) {
		var arr_inp; // tracks if the input is a list of items
		if(isElement(inps)) {
			inps = [inps];
			arr_inp = false;
		} else {
			arr_inp = true;
		}
		// the constraint should just return the value of the input element
		var constraint = cjs(function() {
				if(arr_inp) {
					return map(inps, function(inp) { return inp.value; }); // if it's an array, return every value
				} else {
					return inps[0].value; // otherwise, just return the first value
				}
			}),
			len = inps.length,
			on_change = bind(constraint.invalidate, constraint), // when any input event happens, invalidate the constraint
			activate = function() { // add all the event listeners for every input and event type
				each(inp_change_events, function(event_type) {
					each(inps, function(inp) {
						aEL(inp, event_type, on_change);
					});
				});
			},
			deactivate = function() { // clear all the event listeners for every input and event type
				each(inp_change_events, function(event_type) {
					each(inps, function(inp) {
						rEL(inp, event_type, on_change);
					});
				});
			},
			oldDestroy = constraint.destroy;

		// when the constraint is destroyed, remove the event listeners
		constraint.destroy = function() {
			deactivate();
			oldDestroy.call(constraint);
		};

		activate();
		return constraint;
	};

extend(cjs, {
	/** @expose cjs.bindText */
	bindText: text_binding,
	/** @expose cjs.bindHTML */
	bindHTML: html_binding,
	/** @expose cjs.bindValue */
	bindValue: val_binding,
	/** @expose cjs.bindChildren */
	bindChildren: children_binding,
	/** @expose cjs.bindAttr */
	bindAttr: attr_binding,
	/** @expose cjs.bindCSS */
	bindCSS: css_binding,
	/** @expose cjs.bindClass */
	bindClass: class_binding,
	/** @expose cjs.inputValue */
	inputValue: getInputValueConstraint,
	/** @expose cjs.Binding */
	Binding: Binding
});
