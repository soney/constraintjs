/*
   Edge from A -> B means A sends data to B
   ---

   Constraint Solver: Implements constraint solving, as described in:
   Brad Vander Zanden, Brad A. Myers, Dario A. Giuse, and Pedro Szekely. 1994. Integrating pointer variables into one-way constraint models. ACM Trans. Comput.-Hum. Interact. 1, 2 (June 1994), 161-213. DOI=10.1145/180171.180174 http://doi.acm.org/10.1145/180171.180174

   Depends on:
	core.js
	quick_dict.js
	notifications.js
	object_oriented_utils.js
*/
(function(cjs) {
var _ = cjs._;
var Node = cjs.type("node");
var Edge = cjs.type("edge");
//CONSTRAINT SOLVER

var id = 0;
var ConstraintNode = function(obj, options) {
	Node.call(this);
	this.obj = obj;
	this.ood = true;
	this.value = null;

	this.options = _.extend({
						auto_add_outgoing_dependencies: true,
						auto_add_incoming_dependencies: true},
						options);
	
	this.timestamp = 0;
	
	this.obj.__constraint_solver_node__ = this;
	this.cs_node_id = id++;
};

_.proto_extend(ConstraintNode, Node);

ConstraintNode.prototype.cs_eval = function() {
	return this.obj.cs_eval();
};
ConstraintNode.prototype.nullify = function(reasonChain) {
	this.ood = true;
	if(cjs._debug) {
		this.reason_chain = _.clone(reasonChain);
	}
};

var ConstraintEdge = function(fromNode, toNode) {
	Edge.call(this, fromNode, toNode);
	
	this.timestamp = 0;
};
_.proto_extend(ConstraintEdge, Edge);

var ConstraintSolver = function() {
	this.graph = cjs.create("graph");
	this.stack = [];
	this.listeners = [];
};

ConstraintSolver.prototype.getNode = function(obj) {
	var node = obj.__constraint_solver_node__ || null;
	return node;
};

ConstraintSolver.prototype.hasNode = function(obj) {
	return this.getNode(obj)!==null;
};

ConstraintSolver.prototype.addObject = function(obj, options) {
	var node = this.getNode(obj);
	
	if(node===null) {
		node = new ConstraintNode(obj, options);
				
		this.graph.addNode(node);
		if(cjs._debug_constraint_solver) {
			this.objToNode.set(obj, node);
		}
	}
	return node;
};

ConstraintSolver.prototype.removeObject = function(obj) {
	var node = this.getNode(obj);
	
	if(node!==null) {
		this.graph.removeNode(node);
		delete obj.__constraint_solver_node__;

		this.notify({
			type: "node_removed",
			node: node,
			obj: obj
		});
	}
	if(cjs._debug_constraint_solver) {
		this.objToNode.unset(obj);
	}
};

ConstraintSolver.prototype.addDependency = function(fromObj, toObj) {
	var fromNode = this.getNode(fromObj);
	var toNode = this.getNode(toObj);
	
	return this.addNodeDependency(fromNode, toNode);
};

ConstraintSolver.prototype.addNodeDependency = function(fromNode, toNode) {
	var edge = new ConstraintEdge(fromNode, toNode);
	this.graph.addEdge(edge);

	this.notify({
		type: "dependency_added",
		node: toNode,
		from: fromNode.obj,
		to: toNode.obj
	});

	return edge;
};

ConstraintSolver.prototype.getNodeDependency = function(fromNode, toNode) {
	return this.graph.getEdge(fromNode, toNode);
};

ConstraintSolver.prototype.removeDependency = function(fromObj, toObj) {
	var fromNode = this.getNode(fromObj);
	var toNode = this.getNode(toObj);
	
	this.removeNodeDependency(fromNode, toNode);
};

ConstraintSolver.prototype.removeNodeDependency = function(fromNode, toNode) {
	this.graph.removeEdge(fromNode, toNode);
};

ConstraintSolver.prototype.immediatelyDependentOn = function(obj) {
	return this.get_outgoing(obj, false);
};

ConstraintSolver.prototype.dependsOn = function(obj) {
	return this.get_incoming(obj, false);
};

ConstraintSolver.prototype.isOOD = function(obj) {
	var node = this.getNode(obj);
	return node !== null && node.ood;
};

ConstraintSolver.prototype.nullify = function(obj) {
	var rv = this.doNullify(obj);

	return rv;
};

ConstraintSolver.prototype.doNullify = function(obj) {
	var node = this.getNode(obj);
	var rv = this.nullifyNode(node);

	this.notify({
		type: "root_nullify",
		node: node
	});

	return rv;
};

ConstraintSolver.prototype.nullifyAndEval = function(obj) {
	var rv = this.doNullify(obj);

	return rv;
};

ConstraintSolver.prototype.doNullifyAndEval = function(obj) {
	var node = this.getNode(obj);
	var rv = this.nullifyAndEvalNode(node);

	this.notify({
		type: "root_nullify",
		node: node
	});

	return rv;
};


ConstraintSolver.prototype.get_outgoing = function(obj, recursive) {
	return this.get_node_outgoing(this.getNode(obj), recursive).map(function(x) {
		return x.obj;
	});
};
ConstraintSolver.prototype.get_node_outgoing = function(node, recursive) {
	if(recursive) {
		return node.recursivePointsAt();
	}
	else {
		return node.pointsAt();
	}
};

ConstraintSolver.prototype.get_incoming = function(obj, recursive) {
	return this.get_node_incoming(this.getNode(obj), recursive).map(function(x) {
		return x.obj;
	});
};
ConstraintSolver.prototype.get_node_incoming = function(node, recursive) {
	if(recursive) {
		return node.recursivePointsAtMe();
	}
	else {
		return node.pointsAtMe();
	}
};

ConstraintSolver.prototype.nullifyNode = function(node, reasonChain) {
	var i, outgoingEdges;
	if(reasonChain === undefined) { reasonChain = []; }

	node.nullify(reasonChain);

	this.notify({
		type: "nullify",
		node: node,
		reason: reasonChain
	});

	outgoingEdges = node.getOutgoing();
	for(i = 0; i<outgoingEdges.length; i++) {
		var outgoingEdge = outgoingEdges[i];
		var dependentNode = outgoingEdge.toNode;

		if(outgoingEdge.timestamp < dependentNode.timestamp) {
			var toNode = outgoingEdge.toNode;
			var fromNode = node;
			if(fromNode.options.auto_add_outgoing_dependencies && toNode.options.auto_add_incoming_dependencies) {
				this.removeNodeDependency(node, dependentNode);
				i--;
			}
			else {
				this.nullifyNode(dependentNode, reasonChain.concat(node.obj));
			}
		}
		else if(!dependentNode.ood) {
			this.nullifyNode(dependentNode, reasonChain.concat(node.obj));
		}
	}
};

ConstraintSolver.prototype.nullifyAndEvalNode = function(node, reasonChain) {
	var i, outgoingEdges;
	if(reasonChain === undefined) { reasonChain = []; }

	node.nullify(reasonChain);

	this.notify({
		type: "nullify",
		node: node,
		reason: reasonChain
	});

	outgoingEdges = node.getOutgoing();
	for(i = 0; i<outgoingEdges.length; i++) {
		var outgoingEdge = outgoingEdges[i];
		var dependentNode = outgoingEdge.toNode;

		if(outgoingEdge.timestamp < dependentNode.timestamp) {
			var toNode = outgoingEdge.toNode;
			var fromNode = node;
			if(fromNode.options.auto_add_outgoing_dependencies && toNode.options.auto_add_incoming_dependencies) {
				this.removeNodeDependency(node, dependentNode);
				i--;
			}
			else {
				this.nullifyAndEvalNode(dependentNode, reasonChain.concat(node.obj));
			}
		}
		else if(!dependentNode.ood) {
			this.nullifyAndEvalNode(dependentNode, reasonChain.concat(node.obj));
		}
	}
	this.getNodeValue(node);
};

ConstraintSolver.prototype.getValue = function(obj) {
	return this.getNodeValue(this.getNode(obj));
};

ConstraintSolver.prototype.getNodeValue = function(node) {
	var demanding_var = _.last(this.stack);

	if(demanding_var) {
		var dependency_edge = this.getNodeDependency(node, demanding_var);
		if(!dependency_edge) {
			if(node.options.auto_add_outgoing_dependencies && demanding_var.options.auto_add_incoming_dependencies) {
				dependency_edge = this.addNodeDependency(node, demanding_var);
			}
		}
		if(dependency_edge!==null) {
			dependency_edge.timestamp = demanding_var.timestamp+1;
		}
	}

	if(node.ood) {
		this.stack.push(node);
		this.doEvalNode(node);
		this.stack.pop();
	}

	return node.value;
};

ConstraintSolver.prototype.doEvalNode = function(node) {
	node.ood = false;
	node.value = node.cs_eval();
	node.timestamp++;
};

ConstraintSolver.prototype.doEval = function(obj) {
	return this.doEvalNode(this.getNode(obj));
};

ConstraintSolver.prototype.dependency_paths = function(from) {
	var node = this.getNode(from);
	var paths = node.outgoingPaths();

	var rv = paths.map(function(nodes_path) {
		var objs_path = nodes_path.map(function(node) {
			return node.obj;
		});

		return objs_path;
	});

	return rv;
};

ConstraintSolver.prototype.notify = function(message) {
	_(this.listeners)	.chain()
						.filter(function(listener) {
							return listener.filter(message);
						})
						.map(function(listener) {
							listener.notify(message);
						});
};

var listener_id = 0;
ConstraintSolver.prototype.add_listener = function(arg0, arg1) {
	var self = this;
	var interested_in_type = function() {
		return true;
	};
	var interested_in_node = function() {
		return true;
	};

	var filter = function(notification) {
		return interested_in_type(notification.type) &&
				interested_in_node(notification.node);
	};

	var notify = _.last(arguments);

	var filter_types = null;
	var filter_objs = null;

	if(arguments.length >= 2) {
		filter_types = arg0;
	}
	if(arguments.length >= 3) {
		filter_objs = arg1;
	}

	if(filter_types!==null) {
		if(_.isFunction(filter_types)) {
			if(arguments.length === 2) {
				filter = arg0;
			}
			else if(arguments.length >= 3) {
				interested_in_type = arg0;
			}
		}
		else if(_.isString(filter_types)) {
			if(filter_types === "*") {
				interested_in_type = function() {
					return true;
				};
			}
			else {
				var interesting_types = filter_types.split(" ");
				interested_in_type = function(type) {
					return _.contains(interesting_types, type);
				};
			}
		}
	}
	if(filter_objs!==null) {
		var interested_in_objs = [];
		if(_.isArray(filter_objs)) {
			interested_in_objs = filter_objs;
		}
		else {
			interested_in_objs = [filter_objs];
		}

		var interested = function(node, obj) {
			if(_.isNumber(obj)) {
				return node.cs_node_id === obj;
			} else if(obj instanceof Node) {
				return node === obj;
			} else {
				var n = self.getNode(obj);
				return node === n;
			}
		};

		interested_in_node = function(node) {
			var i;
			for(i = 0; i<interested_in_objs.length; i++) {
				var obj = interested_in_objs[i];
				if(interested(node, obj)) {
					return true;
				}
			}
			return false;
		};
	}

	var listener = {
		filter: filter,
		id: listener_id,
		notify: notify
	};
	if(cjs._debug) {
		listener.interested_in_type = interested_in_type;
		listener.interested_in_node = interested_in_node;
	}
	this.listeners.push(listener);
	listener_id++;
	return listener_id;
};

ConstraintSolver.prototype.remove_listener = function(listener_id) {
	this.listeners = _.reject(this.listeners, function(listener) {
		return listener.id === listener_id;
	});
};


cjs._constraint_solver = new ConstraintSolver();
}(cjs));
