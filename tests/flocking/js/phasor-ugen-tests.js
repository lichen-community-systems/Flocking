/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2014, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global module, test, deepEqual, Float32Array, fluid, flock*/

(function () {

    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    flock.init();
    var sampleRate = flock.enviro.shared.audioSettings.rates.audio;

    module("flock.ugen.phasor");

    var phasorDef = {
        ugen: "flock.ugen.phasor",
        start: 1.0,
        end: 66,
        reset: 2.0,
        step: 1.0
    };

    var testTriggeredSignals = function (synth, ugen, tests) {
        for (var i = 0; i < tests.length; i++) {
            var test = tests[i];
            if (test.trigger !== undefined) {
                ugen.input("trigger", test.trigger);
            }
            synth.gen();
            deepEqual(ugen.output, test.expected, test.msg);
        }
    };

    var testPhasorUGen = function (testSpecs) {
        $.each(testSpecs, function (i, testSpec) {
            var def = $.extend(true, {rate: testSpec.rate, id: "looper"}, testSpec.def);
            var synth = flock.synth({
                synthDef: def,
                addToEnvironment: false
            });
            var loop = synth.namedNodes.looper;

            test(testSpec.name, function () {
                testTriggeredSignals(synth, loop, testSpec.tests);
            });
        });
    };

    var phasorTestSpecs = [
        {
            name: "audio rate",
            rate: "audio",
            def: phasorDef,
            tests: [
                {
                    expected: flock.test.ascendingBuffer(64, 1),
                    msg: "The phasor unit generator should output a signal increasing from 1 to 64"
                },
                {
                    expected: flock.generate(64, function (i) {
                        return i === 0 ? 65 : i;
                    }),
                    msg: "Then it should complete the cycle and loop back to the start point."
                },
                {
                    expected: flock.generate(64, function (i) {
                        return i + 2 % 66;
                    }),
                    trigger: 1.0,
                    msg: "When it receives a trigger signal, the loop ugen should move back to the reset point."
                }
            ]
        },
        {
            name: "control rate",
            rate: "control",
            def: phasorDef,
            tests: [
                {
                    expected: new Float32Array([1.0]),
                    msg: "The loop unit generator should output a control rate signal containing the first value."
                },
                {
                    expected: new Float32Array([2.0]),
                    msg: "At the next control point, it should have increased by one step value."
                },
                {
                    expected: new Float32Array([3.0]),
                    msg: "At the next control point, it should have continued to increase by one step value."
                },
                {
                    expected: new Float32Array([2.0]),
                    trigger: 1.0,
                    msg: "When it receives a trigger signal, the loop ugen should move back to the reset point."
                }
            ]
        },
        {
            name: "control rate, wraparound",
            rate: "control",
            def: {
                ugen: "flock.ugen.phasor",
                start: 0.0,
                end: 2.0,
                step: 1.0
            },
            tests: [
                {
                    expected: new Float32Array([0.0]),
                    msg: "The loop unit generator should output a control rate signal containing the first value."
                },
                {
                    expected: new Float32Array([1.0]),
                    msg: "At the next control point, it should increase by one step value."
                },
                {
                    expected: new Float32Array([0.0]),
                    msg: "At the next control point, it should have looped back to the start."
                },
                {
                    expected: new Float32Array([1.0]),
                    msg: "At the next control point, it should increase by one step value."
                }
            ]
        },
        {
            name: "control rate, step value is the duration of a sample in seconds.",
            rate: "control",
            def: {
                ugen: "flock.ugen.phasor",
                start: 0,
                end: 1.0,
                step: 1.0 / sampleRate
            },
            tests: [
                {
                    expected: new Float32Array([0]),
                    msg: "The value at the first control period should be start value."
                },
                {
                    expected: flock.generate(1, 1.0 / sampleRate),
                    msg: "At the second control point, the value should be the duration of 64 samples."
                }
            ]
        }
    ];

    testPhasorUGen(phasorTestSpecs);

}());
