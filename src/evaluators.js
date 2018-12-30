/*
 * Flocking Synth Evaluator
 * https://github.com/colinbdclark/flocking
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
            flock.evaluate.ugens(synth.nodeList.nodes);
        },

        synthValue: function (synth) {
            flock.evaluate.synth(synth);

            // Update the synth's model.
            if (synth.out) {
                synth.value = synth.out.model.value;
            }

            return synth.value;
        },

        synthModel: function (synth) {
            var value = flock.evaluate.synthValue(synth);
            synth.applier.change("value", value);
        },

        synths: function (synths) {
            for (var i = 0; i < synths.length; i++) {
                var synth = synths[i];
                synth.generatorFunc(synth);
            }
        },

        synthGroup: function (group) {
            flock.evaluate.synths(group.nodeList.nodes);
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
