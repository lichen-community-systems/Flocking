/*
* Flocking Synth Benchmark Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global sheep*/

var flock = flock || {};

(function () {
    "use strict";

    flock.init();

    flock.test = flock.test || {};

    var makeSynthDefTestSpec = function (synthDef, rate, numSampleBlocks) {
        return {
            setup: function () {
                var synth = flock.synth({
                    synthDef: synthDef
                });

                var i,
                    ugen;

                // Change the rate of each unit generator to the specified rate.
                for (i = 0; i < synth.nodes.length; i++) {
                    ugen = synth.nodes[i];
                    if (ugen.id !== "audio-only") { // TODO: Craziness.
                        ugen.rate = rate;
                    }
                }

                // And then whip through again and poke everyone to update their input assumptions.
                for (i = 0; i < synth.nodes.length; i++) {
                    ugen = synth.nodes[i];
                    ugen.onInputChanged();
                }

                return synth;
            },

            test: function (synth) {
                for (var i = 0; i < numSampleBlocks; i++) {
                    synth.gen();
                }
            }
        };
    };

    flock.test.timeSynthDefs = function (name, synthDefs, rates, numSampleBlocks) {
        var testSpecs = [],
            testSpec,
            i,
            rate,
            j;

        if (!flock.isIterable(synthDefs)) {
            synthDefs = [synthDefs];
        }

        if (!flock.isIterable(rates)) {
            rates = [rates];
        }

        for (i = 0; i < rates.length; i++) {
            rate = rates[i];

            for (j = 0; j < synthDefs.length; j++) {
                testSpec = makeSynthDefTestSpec(synthDefs[j], rate, numSampleBlocks);
                testSpec.name = name + " " + rate + " rate.";
                testSpecs.push(testSpec);
                testSpec.numReps = 200;
            }
        }

        sheep.test(testSpecs, true);
    };

}());
