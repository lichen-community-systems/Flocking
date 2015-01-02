/*
* Flocking Unit Generator Benchmark Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global sheep*/

var flock = flock || {};

(function () {
    "use strict";

    flock.init({
        numBuses: 10
    });

    flock.test = flock.test || {};

    var makeRandomizedInputUGenTestSpec = function (ugenDef, inputs, rate, numSampsToGen) {
        numSampsToGen = numSampsToGen || 64;

        return {
            setup: function () {
                var ug = flock.parse.ugenForDef(ugenDef),
                    i,
                    input,
                    inputName,
                    randomized;

                for (i = 0; i < inputs.length; i++) {
                    input = inputs[i];
                    inputName = typeof (input) === "string" ? input : input.name;
                    randomized = flock.test.ugen.mock.makeRandomInputGenerator(input, input.scale, input.round);
                    ug.inputs[inputName] = flock.test.ugen.mock.make(randomized, rate);
                }

                ug.onInputChanged();

                return ug;
            },

            test: function (ug) {
                ug.gen(numSampsToGen);
            }
        };
    };

    flock.test.timeIsolatedUGens = function (ugens, inputs, rates, interpolations, numSamps) {
        rates = rates || [flock.rates.AUDIO];

        var ugenDefs = [],
            testSpecs = [],
            i,
            j,
            k,
            ugenDef,
            rate,
            testSpec,
            l,
            input,
            inputName,
            randomizer;

        for (i = 0; i < ugens.length; i++) {
            for (j = 0; j < rates.length; j++) {
                for (k = 0; k < interpolations.length; k++) {
                    ugenDef = {};
                    rate = rates[j];
                    ugenDef.ugen = ugens[i];
                    ugenDef.options = {
                        interpolation: interpolations[k]
                    };

                    for (l = 0; l < inputs.length; l++) {
                        input = inputs[l];
                        inputName = (typeof (input) === "string") ? input : input.name;
                        randomizer = flock.test.ugen.mock.makeRandomInputGenerator(input);
                        ugenDef[inputName] = randomizer();
                    }
                    ugenDefs.push(ugenDef);
                    testSpec = makeRandomizedInputUGenTestSpec(ugenDef, inputs, rate, numSamps);
                    testSpec.name = ugenDef.ugen + " " + rate + ", interpolation: " + ugenDef.options.interpolation;
                    testSpecs.push(testSpec);
                }
            }
        }

        sheep.test(testSpecs, true);
    };


    /*************
     * The Tests *
     *************/

    flock.test.standaloneUGenBenchmarks = function () {
        var freqSpec = {
            name: "freq",
            scale: 1200
        },

        phaseSpec = {
            name: "phase",
            scale: flock.TWOPI
        },

        audioAndControl = [
            flock.rates.AUDIO,
            flock.rates.CONTROL
        ],

        allInterpolations = [
            "none",
            "linear",
            "cubic"
        ];

        // Non-interpolating basic oscillators.
        flock.test.timeIsolatedUGens([
            "flock.ugen.sin",
            "flock.ugen.lfSaw"
        ], [
            freqSpec,
            phaseSpec,
            "mul",
            "add"
        ], audioAndControl, ["none"]);

        flock.test.timeIsolatedUGens([
            "flock.ugen.lfPulse"
        ], [
            freqSpec,
            phaseSpec,
            "width",
            "mul",
            "add"
        ], audioAndControl, ["none"]);


        // Interpolating basic oscillators.
        flock.test.timeIsolatedUGens([
            "flock.ugen.sinOsc",
            "flock.ugen.triOsc",
            "flock.ugen.sawOsc",
            "flock.ugen.squareOsc"
        ], [
            freqSpec,
            phaseSpec,
            "mul",
            "add"
        ], audioAndControl, allInterpolations);


        // Noise.
        flock.test.timeIsolatedUGens([
            "flock.ugen.lfNoise",
        ], [
            freqSpec,
            "mul",
            "add"
        ], audioAndControl, ["none", "linear"]);

        flock.test.timeIsolatedUGens([
            "flock.ugen.dust"
        ], [
            "density",
            "mul",
            "add"
        ], audioAndControl, ["none"]);

        // Envelopes.
        flock.test.timeIsolatedUGens([
            "flock.ugen.envGen"
        ], [
            "gate",
            "timescale",
            "mul",
            "add"
        ], audioAndControl, ["none"]);

        flock.test.timeIsolatedUGens([
            "flock.ugen.change"
        ], [
            "initial",
            "target",
            "time",
            "crossfade"
        ], audioAndControl, ["none"]);

        // Other UGens.
        flock.test.timeIsolatedUGens([
            "flock.ugen.line",
            "flock.ugen.xLine"
        ], [
            "start",
            "end",
            "duration"
        ], audioAndControl, ["none"]);

        flock.test.timeIsolatedUGens([
            "flock.ugen.amplitude",
        ], [
            "source",
            "attack",
            "release"
        ], audioAndControl, ["none"]);

        flock.test.timeIsolatedUGens([
            "flock.ugen.out",
        ], [
            "sources",
            {
                name: "bus",
                scale: 9,
                round: true
            }
        ], audioAndControl, ["none"]);
    };

}());
