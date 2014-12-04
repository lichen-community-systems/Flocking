/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2014, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, test, deepEqual*/

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
            times: [1/750, 1/375, 1/750]
        },
        gate: 0.0
    };

    flock.test.envGen.silentBlock = new Float32Array(64);
    flock.test.envGen.expectedDecayBuffer = flock.test.lineBuffer(128, 1, 0.5);

    flock.test.envGen.attackDecayExpectations = [
        {
            msg: "The attack portion should sound.",
            buffer: flock.test.lineBuffer(64, 0, 1)
        },
        {
            msg: "The first part of the decay stage should sound.",
            buffer: flock.test.envGen.expectedDecayBuffer.subarray(0, 64)
        },
        {
            msg: "The second part of the decay stage should sound.",
            buffer: flock.test.envGen.expectedDecayBuffer.subarray(64)
        }
    ];

    flock.test.envGen.noSustainPointExpectations = [];

    flock.test.envGen.sustainPointExpectations = [
        {
            msg: "The first part of the sustain stage should hold the sustain value.",
            buffer: flock.test.valueBuffer(64, 0.5)
        },
        {
            msg: "The second part of the sustain stage should continue to hold the sustain value.",
            buffer: flock.test.valueBuffer(64, 0.5)
        }
    ];

    flock.test.envGen.releaseExpectations = [
        {
            msg: "The release stage should sound for the expected duration.",
            buffer: flock.test.lineBuffer(64, 0.5, 0)
        },
        {
            msg: "After the envelope has decayed, it should output silence.",
            buffer: flock.test.envGen.silentBlock
        }
    ];

    flock.test.envGen.releaseFromDecayMidpointExpectations = {
        msg: "Midway through the decay stage, when the gate closes, we should immediately start decaying.",
        buffer: flock.test.lineBuffer(64, 0.75, 0)
    };

    flock.test.envGen.silentExpectation = {
        msg: "The output should be silent.",
        buffer: flock.test.envGen.silentBlock
    };

    flock.test.envGen.testSpecs = [
        {
            name: "Gate closed",
            test: {
                numBlocksToGen: 5,

                // Gate is always closed, so output should be silent.
                expected: [
                    flock.test.envGen.silentExpectation,
                    flock.test.envGen.silentExpectation,
                    flock.test.envGen.silentExpectation,
                    flock.test.envGen.silentExpectation,
                    flock.test.envGen.silentExpectation
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
                    flock.test.envGen.attackDecayExpectations,
                    flock.test.envGen.noSustainPointExpectations,
                    flock.test.envGen.releaseExpectations
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
                    flock.test.envGen.attackDecayExpectations,
                    flock.test.envGen.sustainPointExpectations,
                    flock.test.envGen.releaseExpectations
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
                    flock.test.envGen.silentExpectation,
                    flock.test.envGen.silentExpectation,
                    flock.test.envGen.attackDecayExpectations,
                    flock.test.envGen.sustainPointExpectations,
                    flock.test.envGen.releaseExpectations,
                    flock.test.envGen.silentExpectation
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
                    flock.test.envGen.attackDecayExpectations[0], // Attack stage
                    flock.test.envGen.attackDecayExpectations[1], // First half of decay stage.
                    flock.test.envGen.releaseFromDecayMidpointExpectations,
                    flock.test.envGen.silentExpectation
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
}());
