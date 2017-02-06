/*!
* Flocking Multichannel Unit Generator Unit Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2015, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    fluid.registerNamespace("flock.tests");

    QUnit.module("Multichannel tests");

    var testMultichannelUGen = function (ugen, expectedNumOutputs, expectedBlockSize) {
        QUnit.expect(2 + (2 * expectedNumOutputs));
        QUnit.equal(ugen.options.numOutputs, expectedNumOutputs,
            "The unit generator should declare that it has two output channels");
        QUnit.equal(ugen.output.length, expectedNumOutputs,
            "The unit generator should actually have two output channels.");

        for (var i = 0; i < expectedNumOutputs; i++) {
            QUnit.ok(ugen.output[i] instanceof Float32Array, "Channel #" + i + " should be a Float32Array");
            QUnit.equal(ugen.output[i].length, expectedBlockSize, "Channel #" + i + " should be block sized.");
        }
    };

    var genericUGenCreatorFn = function (inputs, outputs, options) {
        var that = flock.ugen(inputs, outputs, options);
        that.onInputChanged();
        return that;
    };

    flock.tests.mockStereoUGen = genericUGenCreatorFn;

    flock.ugenDefaults("flock.tests.mockStereoUGen", {
        ugenOptions: {
            numOutputs: 2,
            tags: ["flock.ugen.multiChannelOutput"]
        }
    });

    QUnit.test("Multichannel unit generator creation", function () {
        var synth = flock.synth({
            synthDef: {
                id: "actual",
                ugen: "flock.tests.mockStereoUGen"
            }
        });

        testMultichannelUGen(synth.get("actual"), 2, synth.audioSettings.blockSize);
    });

    flock.tests.mockMultiInputUGen = genericUGenCreatorFn;

    flock.ugenDefaults("flock.tests.mockMultiInputUGen", {
        ugenOptions: {
            multiInputNames: ["cats"]
        }
    });

    var testMultInputUGen = function (synth, ugenName, multiInputName, expectedProxyUGens) {
        var ugen = synth.get(ugenName);
        QUnit.equal(Object.keys(ugen.multiInputs).length, 1,
            "The unit generator should have one multiInput configured for it.");
        QUnit.deepEqual(ugen.multiInputs[multiInputName], expectedProxyUGens,
            "The multinput should have the correct proxy ugens with appropriate rates and buffers configured.");
    };

    QUnit.test("Multichannel input creation: multiple ugens connected to one input.", function () {
        var s = flock.synth({
            synthDef: {
                id: "multiIn",
                ugen: "flock.tests.mockMultiInputUGen",
                cats: [
                    {
                        ugen: "flock.test.ugen.mock",
                        rate: "audio"
                    },
                    {
                        ugen: "flock.test.ugen.mock",
                        rate: "control"
                    },
                    {
                        ugen: "flock.test.ugen.mock",
                        rate: "audio"
                    }
                ]
            }
        });

        testMultInputUGen(s, "multiIn", "cats", [
            {
                rate: "audio",
                output: new Float32Array(64)
            },
            {
                rate: "control",
                output: new Float32Array(1)
            },
            {
                rate: "audio",
                output: new Float32Array(64)
            }
        ]);
    });

    QUnit.test("Multichannel input creation: a single multichannel ugen connected to one input.", function () {
        var s = flock.synth({
            synthDef: {
                id: "multiIn",
                ugen: "flock.tests.mockMultiInputUGen",
                cats: {
                    id: "stereo",
                    ugen: "flock.tests.mockStereoUGen",
                    rate: "audio"
                }
            }
        });

        var stereo = s.get("multiIn.cats");

        testMultInputUGen(s, "multiIn", "cats", [
            {
                rate: "audio",
                output: stereo.output[0]
            },
            {
                rate: "audio",
                output: stereo.output[1]
            }
        ]);
    });

    QUnit.test("Multichannel input creation: a single unichannel ugen connected to a multi-input.", function () {
        var s = flock.synth({
            synthDef: {
                id: "multiIn",
                ugen: "flock.tests.mockMultiInputUGen",
                cats: {
                    id: "mono",
                    ugen: "flock.test.ugen.mock",
                    rate: "audio"
                }
            }
        });

        var mono = s.get("multiIn.cats");

        testMultInputUGen(s, "multiIn", "cats", [
            {
                rate: "audio",
                output: mono.output
            }
        ]);
    });

    QUnit.test("Multichannel input creation: no ugen connected to a multi-input.", function () {
        var s = flock.synth({
            synthDef: {
                id: "multiIn",
                ugen: "flock.tests.mockMultiInputUGen"
            }
        });

        testMultInputUGen(s, "multiIn", "cats", []);
    });


    QUnit.module("flock.ugen.pan2");

    var makePannerSynth = function (panVal) {
        var ones = flock.generateBufferWithValue(64, 1);
        var panSynthDef = {
            id: "panner",
            ugen: "flock.ugen.pan2",
            pan: panVal,
            source: {
                id: "mock",
                ugen: "flock.test.ugen.mock",
                options: {
                    buffer: ones
                }
            }
        };

        return flock.synth({
            synthDef: panSynthDef
        });
    };

    var testPanner = function (panTestSpec) {
        var synth = makePannerSynth(panTestSpec.pan),
            panner = synth.get("panner"),
            assertionMap = {
                "equal": QUnit.deepEqual,
                "silent": flock.test.arraySilent,
                "extremelyQuiet": flock.test.arrayExtremelyQuiet
            },
            i,
            channelAssertion,
            fn;

        flock.evaluate.synth(synth);

        for (i = 0; i < panTestSpec.channelAssertions.length; i++) {
            channelAssertion = panTestSpec.channelAssertions[i];
            fn = assertionMap[channelAssertion.assertion];

            if (channelAssertion.expected) {
                fn(panner.output[i], channelAssertion.expected, channelAssertion.msg);
            } else {
                fn(panner.output[i], channelAssertion.msg);
            }
        }
    };

    QUnit.test("Audio rate pan2 tests", function () {
        var fullPower = flock.generateBufferWithValue(64, 1),
            equalPower = flock.generateBufferWithValue(64, Math.sqrt(0.5));

        var pannerTestSpecs = [
            {
                pan: -1,
                channelAssertions: [
                    {
                        assertion: "equal",
                        expected: fullPower,
                        msg: "When the panner is hard left, the signal should be present at full amplitude " +
                            "in the first output buffer."
                    },
                    {
                        assertion: "silent",
                        msg: "When the panner is hard left, the second output buffer should be silent."
                    }
                ]
            },
            {
                pan: 1,
                channelAssertions: [
                    {
                        assertion: "extremelyQuiet",
                        msg: "When the panner is hard right, the first output buffer should be silent."
                    },
                    {
                        assertion: "equal",
                        expected: fullPower,
                        msg: "When the panner is hard right, the signal should be present at full amplitude " +
                            "in the second output buffer."
                    }
                ]

            },
            {
                pan: 0,
                channelAssertions: [
                    {
                        assertion: "equal",
                        expected: equalPower,
                        msg: "When the panner is centred, the signal should be present at 0.707 " +
                            "in the first output buffer."
                    },
                    {
                        assertion: "equal",
                        expected: equalPower,
                        msg: "When the panner is centred, the signal should be present at 0.707 " +
                            "in the second output buffer."
                    }
                ]
            }
        ];

        for (var i = 0; i < pannerTestSpecs.length; i++) {
            testPanner(pannerTestSpecs[i]);
        }
    });
}());
