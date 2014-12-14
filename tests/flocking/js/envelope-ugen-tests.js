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

    flock.test.envGen.test = function (testSpec, synth) {
        var envUGen = synth.get("env"),
            i,
            expectation,
            change;

        for (i = 0; i < testSpec.numBlocksToGen; i++) {
            synth.gen();
            expectation = testSpec.expected[i];
            deepEqual(envUGen.output, expectation.buffer, expectation.msg);
            change = testSpec.changes ? testSpec.changes[i] : undefined;
            if (change) {
                synth.set(change);
            }
        }
    };

    flock.test.envGen.runTests = function (synthDef, testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            var synth = flock.test.envGen.makeSynth(synthDef, testSpec.synthDef);

            test(testSpec.name, function () {
                flock.test.envGen.test(testSpec.test, synth);
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

    flock.test.envGen.segmentExpectations = {
        silent: {
            msg: "The output should be silent.",
            buffer: flock.test.envGen.silentBlock
        },

        noSustain: [],

        sustain: [
            {
                msg: "The first part of the sustain stage should hold the sustain value.",
                buffer: flock.test.valueBuffer(64, 0.5)
            },
            {
                msg: "The second part of the sustain stage should continue to hold the sustain value.",
                buffer: flock.test.valueBuffer(64, 0.5)
            }
        ],

        linear: {
            attack: {
                msg: "The attack portion should sound.",
                buffer: flock.test.lineBuffer(64, 0, 1)
            },

            decay: [
                {
                    msg: "The first part of the decay stage should sound.",
                    buffer: flock.test.envGen.twoBlockLinearDecay.subarray(0, 64)
                },
                {
                    msg: "The second part of the decay stage should sound.",
                    buffer: flock.test.envGen.twoBlockLinearDecay.subarray(64)
                }
            ],

            release: [
                {
                    msg: "The release stage should sound for the expected duration.",
                    buffer: flock.test.lineBuffer(64, 0.5, 0)
                },
                {
                    msg: "After the envelope has decayed, it should output silence.",
                    buffer: flock.test.envGen.silentBlock
                }
            ],

            releaseFromDecayMidpoint: {
                msg: "Midway through the decay stage, when the gate closes, we should immediately start decaying.",
                buffer: flock.test.lineBuffer(64, 0.75, 0)
            }
        }
    };


    flock.test.envGen.testSpecs = [
        {
            name: "Gate closed",
            test: {
                numBlocksToGen: 5,

                // Gate is always closed, so output should be silent.
                expected: [
                    flock.test.envGen.segmentExpectations.silent,
                    flock.test.envGen.segmentExpectations.silent,
                    flock.test.envGen.segmentExpectations.silent,
                    flock.test.envGen.segmentExpectations.silent,
                    flock.test.envGen.segmentExpectations.silent
                ],
                // No changes; gate stays closed throughout.
                changes: {}
            }
        },
        {
            name: "Full envelope, no sustain point, gate open",
            synthDef: {
                gate: 1.0
            },
            test: {
                numBlocksToGen: 5,
                expected: flock.test.concat(
                    flock.test.envGen.segmentExpectations.linear.attack,
                    flock.test.envGen.segmentExpectations.linear.decay,
                    flock.test.envGen.segmentExpectations.noSustain,
                    flock.test.envGen.segmentExpectations.linear.release
                )
            }
        },
        {
            name: "Full envelope, sustain for two blocks, gate open",
            synthDef: {
                gate: 1.0,
                envelope: {
                    sustainPoint: 2
                }
            },
            test: {
                numBlocksToGen: 7,
                expected: flock.test.concat(
                    flock.test.envGen.segmentExpectations.linear.attack,
                    flock.test.envGen.segmentExpectations.linear.decay,
                    flock.test.envGen.segmentExpectations.sustain,
                    flock.test.envGen.segmentExpectations.linear.release
                ),
                changes: {
                    4: {
                        "env.gate": 0.0
                    }
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
            test: {
                numBlocksToGen: 10,
                expected: flock.test.concat(
                    flock.test.envGen.segmentExpectations.silent,
                    flock.test.envGen.segmentExpectations.silent,
                    flock.test.envGen.segmentExpectations.linear.attack,
                    flock.test.envGen.segmentExpectations.linear.decay,
                    flock.test.envGen.segmentExpectations.sustain,
                    flock.test.envGen.segmentExpectations.linear.release,
                    flock.test.envGen.segmentExpectations.silent
                ),
                changes: {
                    1: {
                        "env.gate": 1.0
                    },
                    6: {
                        "env.gate": 0.0
                    }

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
            test: {
                numBlocksToGen: 4,
                expected: flock.test.concat(
                    flock.test.envGen.segmentExpectations.linear.attack, // Attack stage
                    flock.test.envGen.segmentExpectations.linear.decay[0], // First half of decay stage.
                    flock.test.envGen.segmentExpectations.linear.releaseFromDecayMidpoint,
                    flock.test.envGen.segmentExpectations.silent
                ),
                changes: {
                    1: {
                        "env.gate": 0.0
                    }
                }
            }
        }
    ];

    flock.test.envGen.runTests(flock.test.envGen.synthDef, flock.test.envGen.testSpecs);

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
