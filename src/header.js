//     ConstraintJS (CJS) <%= version %>
//     ConstraintJS may be freely distributed under the MIT License
//     http://cjs.from.so/

/* jslint nomen: true, vars: true */
/* jshint -W093 */
/* global document */
/** @expose cjs */
(function(root, factory) {
    "use strict";

    /* CommonJS */
    if (typeof exports == 'object') module.exports = factory(root);

    /* AMD module */
    else if (typeof define == 'function' && define.amd)
        define(function() {
            // wrap the factory to pass root
            return factory(root);
        });

    /* Browser global */
    else root.cjs = factory(root);

}(this, function(root) {
"use strict";
