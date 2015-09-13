/*
 * Flocking Synth Evaluator
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.registerNamespace("flock.synthEvaluator");

    flock.synthEvaluator.gen = function (nodes) {
        var i,
            node;

        // Now evaluate each node.
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            node.genFn(node);
        }
    };

    // TODO: Move this to the Bus Manager or somewhere more appropriate.
    flock.synthEvaluator.clearBuses = function (buses, numBuses, busLen) {
        for (var i = 0; i < numBuses; i++) {
            var bus = buses[i];
            for (var j = 0; j < busLen; j++) {
                bus[j] = 0;
            }
        }
    };
}());
