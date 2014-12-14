/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2014, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, test, ok, deepEqual*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");
    fluid.registerNamespace("flock.test.envGen");

    module("flock.ugen.envGen");

    flock.test.envGen.makeSynth = function (baseDef, overrides) {
        var def = $.extend(true, {}, baseDef, overrides);
        return flock.synth({
            audioSettings: {
                rates: {
                    audio: 48000
                }
            },
            synthDef: def
        });
    };

    flock.test.envGen.test = function (curveName, testSpec, expectations, synth) {
        var envUGen = synth.get("env"),
            i,
            expectedPath,
            expected,
            change;

        for (i = 0; i < testSpec.numBlocksToGen; i++) {
            expectedPath = expectations[i];
            expected = fluid.get(flock.test.envGen.segmentExpectations[curveName], expectedPath);
            synth.gen();
            deepEqual(envUGen.output, expected.buffer, expected.msg);
            change = testSpec.changes ? testSpec.changes[i] : undefined;
            if (change) {
                synth.set(change);
            }
        }
    };

    flock.test.envGen.testSegments = function (curveName, baseSynthDef, expectations, testSpec) {
        baseSynthDef.envelope.curve = curveName;

        var synth = flock.test.envGen.makeSynth(baseSynthDef, testSpec.synthDef);

        test(curveName + ": " + testSpec.name, function () {
            flock.test.envGen.test(curveName, testSpec, expectations, synth);
        });
    };

    flock.test.envGen.runTests = function (baseSynthDef, expectations, testSpec) {
        fluid.each(testSpec.curves, function (curveName) {
            fluid.each(testSpec.tests, function (test, i) {
                flock.test.envGen.testSegments(curveName, baseSynthDef, expectations[i], test);
            });
        });
    };

    flock.test.envGen.synthDef = {
        id: "env",
        ugen: "flock.ugen.envGen",
        envelope: {
            levels: [0, 1, 0.5, 0],
            times: [1/750, 1/375, 1/750] // One block, two blocks, one block.
        },
        gate: 0.0
    };

    flock.test.envGen.silentBlock = new Float32Array(64);
    flock.test.envGen.twoBlockLinearDecay = flock.test.lineBuffer(128, 1, 0.5);
    flock.test.envGen.twoBlockStepDecay = flock.generate(128, function (i) { return i > 0 ? 0.5 : 1.0;});

    flock.test.envGen.silentExpectation = {
        msg: "The output should be silent.",
        buffer: flock.test.envGen.silentBlock
    };

    flock.test.envGen.sustainExpectation = [
        {
            msg: "The first part of the sustain stage should hold the sustain value.",
            buffer: flock.test.valueBuffer(64, 0.5)
        },
        {
            msg: "The second part of the sustain stage should continue to hold the sustain value.",
            buffer: flock.test.valueBuffer(64, 0.5)
        }
    ];

    flock.test.envGen.segmentExpectations = {
        step: {
            silent: flock.test.envGen.silentExpectation,

            sustain: flock.test.envGen.sustainExpectation,

            attack: {
                msg: "The attack stage should consist of an immediate step to the target value.",
                buffer: flock.generate(64, function (i) { return i > 0 ? 1.0 : 0.0; })
            },

            decay: [
                {
                    msg: "The first half of the decay stage should immediately step down to 0.5.",
                    buffer: flock.test.envGen.twoBlockStepDecay.subarray(0, 64)
                },
                {
                    msg: "The second half of the decay stage should immediately step down to 0.5.",
                    buffer: flock.test.envGen.twoBlockStepDecay.subarray(64)
                }
            ],

            release: [
                {
                    msg: "The release stage should immediately step down to 0.",
                    buffer: flock.generate(64, function (i) { return i > 0 ? 0.0 : 0.5; })
                },
                {
                    msg: "After the envelope has released, it should output silence.",
                    buffer: flock.test.envGen.silentBlock
                }
            ],

            releaseFromDecayMidpoint: {
                msg: "Midway through the decay stage, when the gate closes, we should immediately release.",
                buffer: flock.generate(64, function (i) { return i > 0 ? 0.0 : 0.5; })
            }
        },

        linear: {
            silent: flock.test.envGen.silentExpectation,

            sustain: flock.test.envGen.sustainExpectation,

            attack: {
                msg: "The attack portion should sound.",
                buffer: flock.test.lineBuffer(64, 0, 1)
            },

            decay: [
                {
                    msg: "The first part of the decay stage should ramp down to the target.",
                    buffer: flock.test.envGen.twoBlockLinearDecay.subarray(0, 64)
                },
                {
                    msg: "The second part of the decay stage should continue to ramp down to 0.5.",
                    buffer: flock.test.envGen.twoBlockLinearDecay.subarray(64)
                }
            ],

            release: [
                {
                    msg: "The release stage should ramp down for the expected duration.",
                    buffer: flock.test.lineBuffer(64, 0.5, 0)
                },
                {
                    msg: "After the envelope has released, it should output silence.",
                    buffer: flock.test.envGen.silentBlock
                }
            ],

            releaseFromDecayMidpoint: {
                msg: "Midway through the decay stage, when the gate closes, we should immediately start releasing.",
                buffer: flock.test.lineBuffer(64, 0.75, 0)
            }
        }
    };

    flock.test.envGen.expectations = [
        [
            "silent",
            "silent",
            "silent",
            "silent",
            "silent"
        ],
        [
            "attack",
            "decay.0",
            "decay.1",
            "release.0",
            "release.1",
        ],
        [
            "attack",
            "decay.0",
            "decay.1",
            "sustain.0",
            "sustain.1",
            "release.0",
            "release.1",
        ],
        [
            "silent",
            "silent",
            "attack",
            "decay.0",
            "decay.1",
            "sustain.0",
            "sustain.1",
            "release.0",
            "release.1",
            "silent"
        ],
        [
            "attack",
            "decay.0",
            "releaseFromDecayMidpoint",
            "silent"
        ]
    ];

    flock.test.envGen.segmentTestSpec = {
        curves: ["step", "linear"],
        tests: [
            {
                name: "Gate closed",
                numBlocksToGen: 5,
                changes: {} // No changes; gate stays closed throughout.

            },
            {
                name: "Full envelope, no sustain point, gate open",
                synthDef: {
                    gate: 1.0
                },
                numBlocksToGen: 5,
                changes: {} // No changes; gate stays open throughout.
            },
            {
                name: "Full envelope, sustain for two blocks, gate open",
                synthDef: {
                    gate: 1.0,
                    envelope: {
                        sustainPoint: 2
                    }
                },
                numBlocksToGen: 7,
                changes: {
                    4: {
                        "env.gate": 0.0
                    }
                }
            },
            {
                name: "Full envelope, sustain for two blocks; gate closed for two blocks then open.",
                synthDef: {
                    gate: 0.0,
                    envelope: {
                        sustainPoint: 2
                    }
                },
                numBlocksToGen: 10,
                changes: {
                    1: {
                        "env.gate": 1.0
                    },
                    6: {
                        "env.gate": 0.0
                    }

                }
            },
            {
                name: "Gate closes halfway through release stage.",
                synthDef: {
                    gate: 1.0,
                    envelope: {
                        sustainPoint: 2
                    }
                },
                numBlocksToGen: 4,
                changes: {
                    1: {
                        "env.gate": 0.0
                    }
                }
            }
        ]
    };

    flock.test.envGen.runTests(
        flock.test.envGen.synthDef,
        flock.test.envGen.expectations,
        flock.test.envGen.segmentTestSpec
    );

    flock.test.envGen.envelopeCreatorsToTest = fluid.transform(flock.envelope.creatorSpecs, function (spec, name) {
        return {
            name: name,
            creator: flock.envelope[name]
        };
    });

    flock.test.envGen.testEnvelopeValidity = function (name, envSpec) {
        // Create an envGen ugen instance and verify that it's valid.
        try {
            flock.parse.ugenDef({
                ugen: "flock.ugen.envGen",
                envelope: envSpec
            });

            ok(true, "The " + name + " envelope is valid.");
        } catch (e){
            ok(false, "A validation error occurred while instantiating an envGen instance " +
                "with a " + name + " envelope. " + envSpec);
        }
    };

    test("Validity of built-in envelope defaults", function () {
        fluid.each(flock.test.envGen.envelopeCreatorsToTest, function (spec) {
            flock.test.envGen.testEnvelopeValidity(spec.name, spec.creator());
        });
    });

    test("Validity of customized envelopes", function () {
        // This test only tests that the envelope creator functions return
        // valid envSpecs when the user provides options. It doesn't test
        // that the envSpecs produce the requested envelope shape.
        fluid.each(flock.test.envGen.envelopeCreatorsToTest, function (spec) {
            var defaults = flock.envelope[spec.name].defaults,
                options = fluid.copy(defaults),
                envSpec;

            fluid.each(options, function (value, prop) {
                options[prop] = Math.random() * 10;
            });

            envSpec = spec.creator(options);

            flock.test.envGen.testEnvelopeValidity(spec.name, envSpec);
        });
    });

    flock.test.envGen.curveNames = [];
    fluid.each(flock.lineGen, function (lineGenerator, name) {
        if (name === "curve") {
            flock.test.envGen.curveNames.push(-2);
            flock.test.envGen.curveNames.push(2);
        } else if (typeof lineGenerator === "object") {
            flock.test.envGen.curveNames.push(name);
        }
    });

    flock.test.envGen.testNormalOutput = function (synth, numBlocks) {
        for (var i = 0; i < numBlocks; i++) {
            synth.gen();
            var actual = synth.get("env").output;
            flock.test.arrayNotNaN(actual,
                "The segment generator should never output NaN.");
            flock.test.arrayWithinRange(actual, 0.0, 1.0,
                "The segment generator should produce output values ranging between 0 and 1");
        }
    };

    fluid.each(flock.test.envGen.curveNames, function (curveName){
        test("A " + curveName + " segment produces normal output", function () {
            var synth = flock.test.envGen.makeSynth(flock.test.envGen.synthDef, {
                envelope: {
                    curve: curveName,
                },
                gate: 1.0
            });

            flock.test.envGen.testNormalOutput(synth, 4);
        });
    });

}());
