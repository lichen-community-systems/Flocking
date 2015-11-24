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

    flock.evaluate = {
        synth: function (synth) {
            synth.genFn(synth.nodeList.nodes);

            // Update the synth's model.
            if (synth.out) {
                synth.model.value = synth.out.model.value;
            }
        },

        synthValue: function (synth) {
            flock.evaluate.synth(synth);
            return synth.model.value;
        },

        synths: function (synths) {
            for (var i = 0; i < synths.length; i++) {
                flock.evaluate.synth(synths[i]);
            }
        },

        // TODO: Move this elsewhere?
        clearBuses: function (buses, numBuses, busLen) {
            for (var i = 0; i < numBuses; i++) {
                var bus = buses[i];
                for (var j = 0; j < busLen; j++) {
                    bus[j] = 0;
                }
            }
        },

        ugens: function (ugens) {
            var ugen;

            for (var i = 0; i < ugens.length; i++) {
                ugen = ugens[i];
                if (ugen.gen !== undefined) {
                    ugen.gen(ugen.model.blockSize);
                }
            }
        }
    };

}());
