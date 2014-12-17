/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2014, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, expect, test, ok, deepEqual*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");
    fluid.registerNamespace("flock.test.envGen");

    flock.init();

    module("flock.ugen.envGen");

    flock.test.envGen.customADSREnvelopeSynth = {
        id: "env",
        ugen: "flock.ugen.envGen",
        envelope: {
            levels: [0, 1, 0.5, 0],
            times: [1/750, 1/375, 1/750] // One block, two blocks, one block.
        },
        gate: {
            ugen: "flock.ugen.value",
            rate: "audio",
            value: 0.0
        }
    };

    flock.test.envGen.makeSynth = function () {
        var extendArgs = [true, {}];
        fluid.each(arguments, function (arg) {
            extendArgs.push(arg);
        });

        var def = $.extend.apply(null, extendArgs);
        return flock.synth({
            audioSettings: {
                rates: {
                    audio: 48000
                }
            },
            synthDef: def
        });
    };

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
            var synth = flock.test.envGen.makeSynth(flock.test.envGen.customADSREnvelopeSynth, {
                envelope: {
                    curve: curveName,
                },
                gate: {
                    ugen: "flock.ugen.value",
                    rate: "audio",
                    value: 1.0
                }
            });

            flock.test.envGen.testNormalOutput(synth, 4);
        });
    });

    module("Envelope Curves");

    flock.test.envGen.silentBlock = new Float32Array(64);

    flock.test.envGen.splitBufferIntoBlocks = function (numBlocks, buffer) {
        var blocks = [],
            blockSize = 64,
            start = 0,
            end = blockSize;

        for (var i = 0; i < numBlocks; i++) {
            blocks.push(buffer.subarray(start, end));
            start = end;
            end += blockSize;
        }

        return blocks;
    };

    flock.test.envGen.resolvePath = function (path, curveSpec, stage, spec, segmentSpecs, expanded) {
        var expStart = path.indexOf("{"),
            expEnd = path.lastIndexOf("}"),
            stageRef = path.substring(expStart + 1, expEnd),
            tail = path.substring(expEnd + 2);

        if (!expanded[stageRef]) {
            expanded[stageRef] = flock.test.envGen.expandSegmentSpec(curveSpec, stageRef, segmentSpecs, expanded);
        }

        return fluid.get(expanded[stageRef], tail);
    };

    flock.test.envGen.resolvePaths = function (curveSpec, stage, spec, segmentSpecs, expanded) {
        for (var key in spec) {
            var value = spec[key];
            if (typeof value === "string") {
                spec[key] = flock.test.envGen.resolvePath(value, curveSpec, stage, spec, segmentSpecs, expanded);
            }
        }
    };

    flock.test.envGen.expandSegmentSpec = function (curveSpec, stage, segmentSpecs, expanded) {
        var spec = segmentSpecs[stage],
            numSamps;

        spec.numBlocks = spec.numBlocks === undefined ? 1 : spec.numBlocks;
        numSamps = 64 * spec.numBlocks;
        flock.test.envGen.resolvePaths(curveSpec, stage, spec, segmentSpecs, expanded);

        if (!spec.buffer) {
            // TODO: This is a bit ugly and brittle.
            var genFn = flock.test.line[curveSpec.name];
            spec.buffer = curveSpec.name === "curve" ?
                genFn(numSamps, curveSpec.value, spec.start, spec.end) :
                genFn(numSamps, spec.start, spec.end);
        }

        return flock.test.envGen.splitBufferIntoBlocks(spec.numBlocks, spec.buffer);
    };

    flock.test.envGen.expandSegmentSpecs = function (curveSpec, segmentSpecs) {
        var expanded = {};

        for (var stage in segmentSpecs) {
            if (expanded[stage]) {
                continue;
            }

            var blockBuffers = flock.test.envGen.expandSegmentSpec(curveSpec, stage, segmentSpecs, expanded);
            expanded[stage] = blockBuffers;
        }

        return expanded;
    };

    flock.test.envGen.makeSynthForCurveSpec = function (synthDef, synthDefOverrides, curveSpec) {
        return flock.test.envGen.makeSynth(synthDef, synthDefOverrides, {
            envelope: {
                curve: curveSpec.value === undefined ? curveSpec.name : curveSpec.value
            }
        });
    };

    flock.test.envGen.runEnvelopeCurveTest = function (synthDef, curveSpec, expectedSegments, testSpec) {
        var testName = curveSpec.name + (curveSpec.value ? " value " + curveSpec.value : "") + ", " + testSpec.name;

        test(testName, function () {
            var synth = flock.test.envGen.makeSynthForCurveSpec(synthDef, testSpec.synthDef, curveSpec),
                envUGen = synth.get("env");

            for (var i = 0; i < testSpec.numBlocksToGen; i++) {
                var expectedPath = testSpec.expectations[i];
                var expectedBuffer = fluid.get(expectedSegments, expectedPath);
                synth.gen();

                if (curveSpec.round && curveSpec.round[expectedPath]) {
                    flock.test.arrayEqualBothRounded(curveSpec.round[expectedPath], envUGen.output, expectedBuffer, test.name + expectedPath);
                } else {
                    deepEqual(envUGen.output, expectedBuffer, test.name + expectedPath);
                }

                var change = testSpec.changes ? testSpec.changes[i] : undefined;
                if (change) {
                    synth.set(change);
                }
            }
        });
    };

    flock.test.envGen.runEnvelopeCurveTests = function (synthDef, curveSpec, expectedSegments, tests) {
        fluid.each(tests, function (testSpec) {
            flock.test.envGen.runEnvelopeCurveTest(synthDef, curveSpec, expectedSegments, testSpec);
        });
    };

    flock.test.envGen.expandCurveSpec = function (curveSpec) {
        return typeof curveSpec === "string" ? {name: curveSpec} : curveSpec;
    };

    flock.test.envGen.testEnvelopeCurve = function (curveSpec, testSpec) {
        curveSpec = flock.test.envGen.expandCurveSpec(curveSpec);

        var segmentSpecs = fluid.copy(testSpec.segmentSpecs),
            expectedSegments = flock.test.envGen.expandSegmentSpecs(curveSpec, segmentSpecs);

        flock.test.envGen.runEnvelopeCurveTests(testSpec.synthDef, curveSpec, expectedSegments, testSpec.tests);
    };

    flock.test.envGen.testEnvelopeCurves = function (testSpec) {
        fluid.each(testSpec.curves, function (curveSpec) {
            flock.test.envGen.testEnvelopeCurve(curveSpec, testSpec);
        });
    };

    flock.test.envGen.customADSREnvelopeTestSpec = {
        synthDef: flock.test.envGen.customADSREnvelopeSynth,

        curves: [
            "step",
            "linear",
            {
                name: "squared",
                round: {
                    "releaseFromDecayMidpoint.0": 6
                }
            },
            {
                name: "cubed",
                round: {
                    "releaseFromDecayMidpoint.0": 6
                }
            },
            {
                name: "exponential",
                round: {
                    "attack.0": 15
                }
            },
            {
                name: "sin",
                round: {
                    "postRelease.0": 14,
                    "silent.0": 14
                }
            },
            {
                name: "welsh",
                round: {
                    "postRelease.0": 13,
                    "releaseFromDecayMidpoint.0": 5,
                    "silent.0": 13
                }
            },
            {
                name: "curve",
                value: 7,
                round: {
                    "postRelease.0": 14,
                    "releaseFromDecayMidpoint.0": 6,
                    "silent.0": 14
                }
            },
            {
                name: "curve",
                value: -7,
                round: {
                    "postRelease.0": 14,
                    "releaseFromDecayMidpoint.0": 6,
                    "silent.0": 14
                }
            }
        ],

        segmentSpecs: {
            silent: {
                buffer: flock.test.envGen.silentBlock,
                start: 0.0,
                end: 0.0
            },

            attack: {
                start: 0.0,
                end: 1.0
            },

            decay: {
                start: 1.0,
                end: 0.5,
                numBlocks: 2
            },

            sustain: {
                start: 0.5,
                end: 0.5,
                numBlocks: 2
            },

            release: {
                start: 0.5,
                end: 0.0
            },

            postRelease: {
                buffer: flock.test.envGen.silentBlock,
                start: 0.0,
                end: 0.0
            },

            releaseFromDecayMidpoint: {
                start: "{decay}.1.0",
                end: 0.0
            }
        },

        tests: [
            {
                name: "Gate closed",
                numBlocksToGen: 5,
                changes: {}, // No changes; gate stays closed throughout.
                expectations: [
                    "silent.0",
                    "silent.0",
                    "silent.0",
                    "silent.0",
                    "silent.0"
                ]
            },
            {
                name: "Full envelope, no sustain point, gate open running at control rate",
                synthDef: {
                    gate: 1.0
                },
                numBlocksToGen: 5,
                changes: {}, // No changes; gate stays open throughout.
                expectations: [
                    "attack.0",
                    "decay.0",
                    "decay.1",
                    "release.0",
                    "postRelease.0"
                ]
            },
            {
                name: "Full envelope, no sustain point, gate open running at audio rate",
                synthDef: {
                    gate: {
                        ugen: "flock.ugen.value",
                        rate: "audio",
                        value: 1.0
                    }
                },
                numBlocksToGen: 5,
                changes: {}, // No changes; gate stays open throughout.
                expectations: [
                    "attack.0",
                    "decay.0",
                    "decay.1",
                    "release.0",
                    "postRelease.0"
                ]
            },
            {
                name: "Full envelope, sustain for two blocks, gate open at audio rate",
                synthDef: {
                    gate: {
                        ugen: "flock.ugen.value",
                        rate: "audio",
                        value: 1.0
                    },
                    envelope: {
                        sustainPoint: 2
                    }
                },
                numBlocksToGen: 7,
                changes: {
                    4: {
                        "env.gate": {
                            ugen: "flock.ugen.value",
                            rate: "audio",
                            value: 0.0
                        }
                    }
                },
                expectations: [
                    "attack.0",
                    "decay.0",
                    "decay.1",
                    "sustain.0",
                    "sustain.1",
                    "release.0",
                    "postRelease.0"
                ]
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
                },
                expectations: [
                    "silent.0",
                    "silent.0",
                    "attack.0",
                    "decay.0",
                    "decay.1",
                    "sustain.0",
                    "sustain.1",
                    "release.0",
                    "postRelease.0",
                    "silent.0"
                ]
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
                },
                expectations: [
                    "attack.0",
                    "decay.0",
                    "releaseFromDecayMidpoint.0",
                    "silent.0"
                ]
            }
        ]
    };

    flock.test.envGen.testEnvelopeCurves(flock.test.envGen.customADSREnvelopeTestSpec);


    module("Envelope curve start and end values");

    flock.test.envGen.checkStartAndEnd = function (stages, stageSpecs, allSamples) {
        var startIdx = 0,
            endIdx = 0;

        for (var i = 0; i < stages.length; i++) {
            var stage = stages[i],
                stageSpec = stageSpecs[stage],
                numBlocks = stageSpec.numBlocks === undefined ? 1 : stageSpec.numBlocks;

            startIdx = endIdx;
            endIdx += 64 * numBlocks;

            flock.test.equalRounded(13, allSamples[startIdx], stageSpec.start,
                "The " + stage + " stage should start at " + stageSpec.start);
            flock.test.equalRounded(13, allSamples[endIdx], stageSpec.end,
                "The " + stage + " stage should end at " + stageSpec.end);
        }
    };

    flock.test.envGen.collectBlock = function (block, allSamples, idx) {
        for (var i = 0; i < block.length; i++, idx++) {
            allSamples[idx] = block[i];
        }

        return idx;
    };

    flock.test.envGen.generateBlock = function (synth, allSamples, idx) {
        synth.gen();
        return flock.test.envGen.collectBlock(synth.get("env").output, allSamples, idx);
    };

    flock.test.envGen.generateStage = function (stage, stageSpecs, synth, allSamples, idx) {
        var stageSpec = stageSpecs[stage],
            numBlocks = stageSpec.numBlocks === undefined ? 1 : stageSpec.numBlocks;

        for (var j = 0; j < numBlocks; j++) {
            idx = flock.test.envGen.generateBlock(synth, allSamples, idx);
        }

        return idx;
    };

    flock.test.envGen.testEnvelopeCurveStartAndEndPoints = function (testSpec, stages) {
        fluid.each(testSpec.curves, function (curveSpec) {
            curveSpec = flock.test.envGen.expandCurveSpec(curveSpec);
            var testName = curveSpec.name + (curveSpec.value ? " value " + curveSpec.value : "");

            test(testName, function () {
                expect(2 * stages.length);

                var synth = flock.test.envGen.makeSynthForCurveSpec(testSpec.synthDef, {gate: 1.0}, curveSpec),
                    stageSpecs = testSpec.segmentSpecs,
                    allSamples = [],
                    idx = 0;

                for (var i = 0; i < stages.length; i++) {
                    idx = flock.test.envGen.generateStage(stages[i], stageSpecs, synth, allSamples, idx);
                }

                // Generate an extra block for the end.
                idx = flock.test.envGen.generateBlock(synth, allSamples, idx);

                flock.test.envGen.checkStartAndEnd(stages, stageSpecs, allSamples);
            });
        });
    };

    flock.test.envGen.adsrStages = [
        "attack",
        "decay",
        "release",
        "postRelease"
    ];

    flock.test.envGen.testEnvelopeCurveStartAndEndPoints(
        flock.test.envGen.customADSREnvelopeTestSpec,
        flock.test.envGen.adsrStages
    );
}());
