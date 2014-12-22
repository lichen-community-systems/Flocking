/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2014, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, expect, test, ok, equal, deepEqual*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");
    flock.init();

    var sampleRate = flock.enviro.shared.audioSettings.rates.audio;


    /*****************************
     * Line Unit Generator Tests *
     *****************************/

    module("flock.ugen.line");

    var lineDef = {
        ugen: "flock.ugen.line",
        rate: flock.rates.AUDIO,
        inputs: {
            duration: 64 / sampleRate, // 64 samples.
            start: 0,
            end: 64
        }
    };

    test("Generate a full line.", function () {
        var line = flock.parse.ugenForDef(lineDef);

        line.gen(64);
        var expected = flock.test.fillBuffer(0, 63);
        deepEqual(line.output, expected, "Line should generate all samples for its duration but one.");

        line.gen(64);
        expected = flock.generate(64, 64);
        deepEqual(line.output, expected, "After the line's duration is finished, it should constantly output the end value.");
    });

    test("Generate a partial line.", function () {
        var line = flock.parse.ugenForDef(lineDef);

        line.gen(32);

        // It's a 64 sample buffer, so split it in half to test it.
        deepEqual(flock.copyBuffer(line.output, 0, 32), flock.test.fillBuffer(0, 31),
            "The first half of the line's values should but generated.");
        deepEqual(flock.copyBuffer(line.output, 32), flock.generate(32, 0),
            "The last 32 samples of the buffer should be empty.");

        line.gen(32);
        deepEqual(flock.copyBuffer(line.output, 0, 32), flock.test.fillBuffer(32, 63),
            "The second half of the line's values should be generated.");
        deepEqual(flock.copyBuffer(line.output, 32), flock.generate(32, 0),
            "The last 32 samples of the buffer should be empty.");

        line.gen(32);
        deepEqual(flock.copyBuffer(line.output, 0, 32), flock.generate(32, 64),
            "After the line's duration is finished, it should constantly output the end value.");
    });


    /******************
     * ASR UGen Tests *
     ******************/

    module("flock.ugen.asr");

    var asrDef = {
        ugen: "flock.ugen.asr",
        rate: flock.rates.AUDIO,
        inputs: {
            start: 0.0,
            attack: 1 / (sampleRate / 63), // 64 Samples, in seconds
            sustain: 1.0,
            release: 1 / (sampleRate / 63) // 128 Samples
        }
    };

    var testEnvelopeStage = function (buffer, numSamps, expectedStart, expectedEnd, stageName) {
        equal(buffer[0], expectedStart,
            "During the " + stageName + " stage, the starting level should be " + expectedStart + ".");
        equal(buffer[numSamps - 1], expectedEnd,
            "At the end of the " + stageName + " stage, the expected end level should have been reached.");
        flock.test.arrayUnbroken(buffer, "The output should not contain any dropouts.");
        flock.test.arrayWithinRange(buffer, 0.0, 1.0,
            "The output should always remain within the range between " + expectedStart + " and " + expectedEnd + ".");
        flock.test.continuousArray(buffer, 0.02, "The buffer should move continuously within its range.");

        var isClimbing = expectedStart < expectedEnd;
        var directionText = isClimbing ? "climb" : "fall";
        flock.test.rampingArray(buffer, isClimbing,
            "The buffer should " + directionText + " steadily from " + expectedStart + " to " + expectedEnd + ".");
    };

    test("Constant values for all inputs", function () {
        var asr = flock.parse.ugenForDef(asrDef);

        // Until the gate is closed, the ugen should just output silence.
        asr.gen(64);
        deepEqual(asr.output, flock.generate(64, 0.0),
            "When the gate is open at the beginning, the envelope's output should be 0.0.");

        // Trigger the attack stage.
        asr.input("gate", 1.0);
        asr.gen(64);
        testEnvelopeStage(asr.output, 64, 0.0, 1.0, "attack");

        // Output a full control period of the sustain value.
        asr.gen(64);
        deepEqual(asr.output, flock.generate(64, 1.0),
            "While the gate is open, the envelope should hold at the sustain level.");

        // Release the gate and test the release stage.
        asr.input("gate", 0.0);
        asr.gen(64);
        testEnvelopeStage(asr.output, 64, 1.0, 0.0, "release");

        // Test a full control period of the end value.
        asr.gen(64);
        deepEqual(asr.output, flock.generate(64, 0.0),
            "When the gate is closed and the release stage has completed, the envelope's output should be 0.0.");

        // Trigger the attack stage again.
        asr.input("gate", 1.0);
        asr.gen(64);
        testEnvelopeStage(asr.output, 64, 0.0, 1.0, "second attack");

        // And the release stage again.
        asr.input("gate", 0.0);
        asr.gen(64);
        testEnvelopeStage(asr.output, 64, 1.0, 0.0, "second release");
    });

    test("Release midway through attack", function () {
        var asr = flock.parse.ugenForDef(asrDef);
        asr.input("gate", 1.0);
        asr.gen(32);
        testEnvelopeStage(asr.output.subarray(0, 32), 32, 0.0, 0.4920634925365448, "halfway through the attack");

        // If the gate closes during the attack stage, the remaining portion of the attack stage should be output before the release stage starts.
        asr.input("gate", 0.0);
        asr.gen(32);
        testEnvelopeStage(asr.output.subarray(0, 32), 32, 0.5079365372657776, 1.0, "rest of the attack");

        // After the attack stage has hit 1.0, it should immediately start the release phase.
        asr.gen(64);
        testEnvelopeStage(asr.output, 64, 1.0, 0.0, "release");
    });

    test("Attack midway through release", function () {
        var asr = flock.parse.ugenForDef(asrDef);

        // Trigger the attack stage, then the release stage immediately.
        asr.input("gate", 1.0);
        asr.gen(64);
        testEnvelopeStage(asr.output, 64, 0.0, 1.0, "attack");
        asr.input("gate", 0.0);
        asr.gen(32);
        testEnvelopeStage(flock.copyBuffer(asr.output, 0, 32), 32, 1.0, 0.5079365372657776, "halfway release");

        // Then trigger a new attack halfway through the release stage.
        // The envelope should immediately pick up the attack phase from the current level
        // TODO: Note that there will be a one-increment lag before turning direction to the attack phase in this case. Is this a noteworthy bug?
        asr.input("gate", 1.0);
        asr.gen(32);
        testEnvelopeStage(flock.copyBuffer(asr.output, 0, 32), 32, 0.4920634925365448, 0.7420005202293396, "attack after halfway release");

        // Generate another control period of samples, which should be at the sustain level.
        asr.gen(64);
        testEnvelopeStage(flock.copyBuffer(asr.output, 0, 32), 32, 0.7500630021095276, 1.0, "second half of the attack after halfway release second half.");
        deepEqual(flock.copyBuffer(asr.output, 32), flock.generate(32, 1.0),
            "While the gate remains open after a mid-release attack, the envelope should hold at the sustain level.");
    });


    /****************
     * EnvGen Tests *
     ****************/

    fluid.registerNamespace("flock.test.envGen");

    module("Envelope validity");

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

    flock.test.envGen.testUGenEnvelopeValidity = function (name, envelope) {
        // Create an envGen ugen instance and verify that it's valid.
        try {
            flock.parse.ugenDef({
                ugen: "flock.ugen.envGen",
                envelope: envelope
            });

            ok(true, "The " + name + " envelope is valid.");
        } catch (e){
            ok(false, "A validation error occurred while instantiating an envGen instance " +
                "with a " + name + " envelope. " + envelope);
        }
    };

    flock.test.envGen.testEnvelopeInvalidity = function (testSpec) {
        test("Invalid envelope " + testSpec.name, function () {
            try {
                flock.envelope.validate(testSpec.envelope);
                ok(false, "An envelope " + testSpec.name + " passed validation.");
            } catch (e) {
                ok(true, "The envelope " + testSpec.name + " correctly failed validation.");
            }
        });
    };

    test("Validity of built-in envelope defaults", function () {
        fluid.each(flock.test.envGen.envelopeCreatorsToTest, function (spec) {
            flock.test.envGen.testUGenEnvelopeValidity(spec.name, spec.creator());
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

            flock.test.envGen.testUGenEnvelopeValidity(spec.name, envSpec);
        });
    });

    var invalidEnvs = [
        {
            name: "without any levels",
            envelope: {
                levels: undefined,
                times: [1, 2, 3]
            }
        },
        {
            name: "with an empty levels array",
            envelope: {
                levels: [],
                times: [1, 2, 3]
            }
        },
        {
            name: "with NaN levels",
            envelope: {
                levels: [0, NaN, 1, 0],
                times: [1, 2, 3]
            }
        },
        {
            name: "with no times",
            envelope: {
                levels: [0, 1, 0.5, 0],
                times: undefined
            }
        },
        {
            name: "with an empty times array",
            envelope: {
                levels: [0, 1, 0.5, 0],
                times: []
            }
        },
        {
            name: "with NaN times",
            envelope: {
                levels: [0, 1, NaN, 0],
                times: [1, 2, 3]
            }
        },
        {
            name: "with negative times",
            envelope: {
                levels: [0, 1, 0.5, 0],
                times: [2, -1, 2]
            }
        },
        {
            name: "with too many times",
            envelope: {
                levels: [0, 1, 0.5, 0],
                times: [2, 1, 2, 2]
            }
        },
        {
            name: "with too few times",
            envelope: {
                levels: [0, 1, 0.5, 0],
                times: [2, 1]
            }
        },
        {
            name: "too many curves",
            envelope: {
                levels: [0, 1, 0.5, 0],
                times: [2, 1, 2],
                curve: ["linear", "cubic", "exponential", "welsh"]
            }
        },
        {
            name: "too few curves",
            envelope: {
                levels: [0, 1, 0.5, 0],
                times: [2, 1, 2],
                curve: ["linear"]
            }
        },
        {
            name: "invalid curve name",
            envelope: {
                levels: [0, 1, 0.5, 0],
                times: [2, 1, 2],
                curve: ["squiggly"]
            }
        },
        {
            name: "sustainPoint out of range",
            envelope: {
                levels: [0, 1, 0.5, 0],
                times: [2, 1, 2],
                curve: ["linear", "cubic", "exponential"],
                sustainPoint: 10
            }
        }
    ];
    fluid.each(invalidEnvs, flock.test.envGen.testEnvelopeInvalidity);


    module("flock.ugen.envGen normal output");

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

    module("flock.ugen.envGen envelope stages");

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


    module("flock.ugen.envGen segment start and end values");

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


    module("Line generators");

    flock.test.envGen.lineGeneratorTests = [
        {
            type: "step",
            start: 1,
            end: 10,
            numSamps: 10,
            expected: new Float32Array([1, 10, 10, 10, 10, 10, 10, 10, 10, 10])
        },
        {
            type: "constant",
            start: 1,
            end: 10,
            numSamps: 10,
            // Constant continuously outputs whatever the current model value is
            // (i.e. the start value).
            expected: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
        },
        {
            type: "linear",
            start: 1,
            end: 10,
            numSamps: 10,
            expected: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        },
        {
            type: "squared",
            start: 1, // Square root of 1 is 1.
            end: 10,  // Square root of 10 is 3.1622776601683795.
            numSamps: 10,

            // y1 starts at 1
            // Step increment is (3.1622776601683795 - 1) / 9 = 0.24025307335204216
            expected: new Float32Array([
                1,
                1.5382276859591864, // y1 = 1.24025307335204216
                2.1918984504285763, // y1 = 1.4805061467040845
                2.96101229340817,   // y1 = 1.7207592200561268
                3.8455692148979668, // y1 = 1.961012293408169
                4.845569214897968,  // y1 = 2.2012653667602113
                5.961012293408172,  // y1 = 2.4415184401122536
                7.19189845042858,   // y1 = 2.681771513464296
                8.53822768595919,   // y1 = 2.922024586816338
                10
            ])
        },
        {
            type: "cubed",
            start: 1,
            end: 10,  // 2.154434690031884.
            numSamps: 10,

            // y1 starts at 1
            // Step increment is (2.154434690031884 - 1) / 9 = 0.12827052111465376
            expected: new Float32Array([
                1,
                1.436282019880423,  // y1 = 1.128270521114653766
                1.9839468599353185, // y1 = 1.2565410422293075
                2.6556573808170105, // y1 = 1.3848115633439613
                3.464076443177822,  // y1 = 1.513082084458615
                4.421866907670077,  // y1 = 1.6413526055732688
                5.5416916349460985, // y1 = 1.7696231266879225
                6.836213485658211,  // y1 = 1.8978936478025763
                8.318095320458738,  // y1 = 2.02616416891723
                10
            ])
        },
        {
            type: "exponential",
            start: 1,
            end: 10,
            numSamps: 10,

            // Step size is 1.2589254117941673.
            expected: new Float32Array([
                1,
                1.2915496650148839,
                1.6681005372000588,
                2.1544347946583002,
                2.7825594283858663,
                3.593813703264459,
                4.641588889066043,
                5.994842656512711,
                7.7426369660533965,
                10
            ])
        },
        {
            type: 3,
            start: 1,
            end: 10,
            numSamps: 10,

            // a2 is 0.5284387315786965
            // b1 starts at -0.4715612684213036
            // stepSize is 1.3956124250860895
            expected: new Float32Array([
                1,
                1.1865554969768244, // b1 is -0.6581167653981279
                1.4469146665257908, // b1 is -0.9184759349470943
                1.8102751585334242, // b1 is -1.2818364269547278
                2.317385575964672, // b1 is -1.7889468443859757
                3.0251151754223153, // b1 is -2.4966764438436186
                4.012831398026603, // b1 is -3.484392666447907
                5.391300430752246, // b1 is -4.862861699173549
                7.315108940420555, // b1 is -6.7866702088418585
                10
            ])
        }
    ];

    flock.test.envGen.testLineGenerator = function (testSpec) {
        test(testSpec.type + " line generator.", function () {
            var actual = flock.line.fill(testSpec.type, new Float32Array(testSpec.numSamps), 1, 10);
            flock.test.arrayEqualBothRounded(6, actual, testSpec.expected,
                "The " + testSpec.type + " line generator should produce the correct output.");
        });
    };

    fluid.each(flock.test.envGen.lineGeneratorTests, flock.test.envGen.testLineGenerator);

}());
