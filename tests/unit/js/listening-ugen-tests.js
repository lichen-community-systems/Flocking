/*!
* Flocking Listening Unit Generator Unit Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-15, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    var environment = flock.silentEnviro(),
        sampleRate = environment.audioSystem.model.rates.audio;

    QUnit.module("flock.ugen.amplitude() tests");

    var ampConstSignalDef = {
        ugen: "flock.ugen.amplitude",
        rate: flock.rates.AUDIO,
        inputs: {
            source: {
                ugen: "flock.test.ugen.mock",
                options: {
                    buffer: flock.generateBufferWithValue(64, 1.0)
                }
            },
            attack: 0.00001
        }
    };

    var generateAndTestContinuousSamples = function (ugen, numSamps) {
        ugen.inputs.source.gen(64);
        ugen.gen(numSamps);
        flock.test.arrayNotNaN(ugen.output, "The unit generator's output should not contain NaN.");
        flock.test.arrayNotSilent(ugen.output,
            "The unit generator's output should not be silent.");
        flock.test.continuousArray(ugen.output, 0.1,
            "The unit generator's output should not have any major value jumps in it.");
    };

    QUnit.test("Constant value source input.", function () {
        var tracker = flock.parse.ugenForDef(ampConstSignalDef);
        generateAndTestContinuousSamples(tracker, 64);
        // TODO: Why does an attack time of 0.00001 result in a ramp-up time of three samples, instead of just less than half a sample?
        QUnit.deepEqual(flock.copyBuffer(tracker.output, 3, 64), flock.generateBufferWithValue(61, 1.0),
            "With a negligible attack time and a constant input value of 1.0, the amplitude ugen should ramp up quickly to, and remain at, 1.0.");
    });

    var ampDescendingLine = {
        ugen: "flock.ugen.amplitude",
        rate: flock.rates.AUDIO,
        inputs: {
            source: {
                ugen: "flock.ugen.line",
                rate: flock.rates.AUDIO,
                start: 1,
                duration: 1.0,
                end: 10
            }
        },
        attack: 0.00001
    };

    QUnit.test("Changing value source input.", function () {
        var tracker = flock.parse.ugenForDef(ampDescendingLine);

        var controlPeriods = Math.round(sampleRate / 64),
            i;

        for (i = 0; i < controlPeriods; i++) {
            generateAndTestContinuousSamples(tracker, 64);
            flock.test.rampingArray(tracker.output, true,
                "The amplitude tracker should follow the contour of its source.");
        }
    });

    environment.destroy();
}());
