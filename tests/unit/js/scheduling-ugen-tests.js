/*!
* Flocking Scheduling Unit Generator Tests
*
* Copyright 2014-2015, Colin Clark,
* Copyright 2015, OCAD University
*
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit"),
        $ = fluid.registerNamespace("jQuery"),
        environment = flock.silentEnviro(),
        sampleRate = environment.audioSystem.model.rates.audio;

    QUnit.module("flock.ugen.change");

    var changeDef = {
        id: "changer",
        ugen: "flock.ugen.change",
        initial: 1.0,
        target: 2.0,
        time: 1/750
    };

    var makeUGen = function (def) {
        return flock.parse.ugenForDef(fluid.copy(def), undefined, {
            audioSettings: {
                rates: {
                    audio: 48000
                }
            }
        });
    };

    QUnit.test("Change at specified time", function () {
        QUnit.expect(2);

        var changer = makeUGen(changeDef);

        flock.test.evaluateUGen(changer);
        QUnit.deepEqual(changer.output, flock.generateBufferWithValue(64, 1),
            "For the first sample block, the output should be the initial input's output.");

        flock.test.evaluateUGen(changer);
        QUnit.deepEqual(changer.output, flock.generateBufferWithValue(64, 2),
            "For the second sample block, the output should be the target input's output.");
    });

    QUnit.test("Crossfade", function () {
        QUnit.expect(3);

        var crossFadeDef = $.extend({}, changeDef, {
            crossfade: 1/750
        });

        var changer = makeUGen(crossFadeDef),
            crossfadeBuffer = flock.generateBuffer(64, function (i) {
                var targetLevel = i / 64,
                    initialLevel = 1 - targetLevel;
                return (1 * initialLevel) + (2 * targetLevel);
            });

        flock.test.evaluateUGen(changer);
        QUnit.deepEqual(changer.output, flock.generateBufferWithValue(64, 1),
            "For the first sample block, the output should be the initial input's output.");

        flock.test.evaluateUGen(changer);
        QUnit.deepEqual(changer.output, crossfadeBuffer,
            "For the second sample block, the output should crossfade from the initial to the target input.");

        flock.test.evaluateUGen(changer);
        QUnit.deepEqual(changer.output, flock.generateBufferWithValue(64, 2),
            "For the third sample block, the output should be the target input's output.");
    });

    QUnit.module("flock.ugen.sequencer");

    fluid.registerNamespace("flock.test.sequencer");

    flock.test.sequencer.synthDef = {
        id: "sequencer",
        ugen: "flock.ugen.sequencer",
        durations: [2, 3],
        values: [0, 1]
    };

    flock.test.sequencer.testSequencerValues = function (s, expectedDurations, expectedValues) {
        QUnit.expect(2);

        var actualDurations = s.get("sequencer.durations"),
            actualValues = s.get("sequencer.values");

        QUnit.deepEqual(actualDurations, expectedDurations,
            "The durations input should have been correctly updated.");
        QUnit.deepEqual(actualValues, expectedValues,
            "The values input should have been correctly updated.");
    };

    flock.failHard = true;

    QUnit.test("gh-136: sequencer shouldn't fail when setting durations and values together.", function () {
        var s = flock.synth({
            synthDef: flock.test.sequencer.synthDef
        });

        var change = {
            "sequencer.durations": [5, 6],
            "sequencer.values": [2, 2]
        };

        s.set(change);
        flock.test.sequencer.testSequencerValues(s,
            change["sequencer.durations"], change["sequencer.values"]);
    });

    QUnit.test("gh-136: sequencer shouldn't fail when creating model synth", function () {
        var s = flock.modelSynth({
            synthDef: flock.test.sequencer.synthDef,
            model: {
                inputs: {
                    sequencer: {
                        durations: [5, 6, 7],
                        values: [2, 2, 3]
                    }
                }
            }
        });

        flock.test.sequencer.testSequencerValues(s,
            s.model.inputs.sequencer.durations, s.model.inputs.sequencer.values);
    });

    flock.test.sequencer.generateAndCatchError = function (s) {
        var errorRaised = false;
        try {
            s.genFn(s.nodeList.nodes);
            errorRaised = false;
        } catch (error) {
            errorRaised = error.message.indexOf(
                "Mismatched durations and values array lengths") > -1;
        }

        return errorRaised;
    };

    QUnit.test("Duration and value validation", function () {
        QUnit.expect(3);

        var s = flock.synth({
            synthDef: flock.test.sequencer.synthDef
        });
        s.set("sequencer.durations", [5, 6, 7]);

        var wasErrorRaised = flock.test.sequencer.generateAndCatchError(s);
        QUnit.ok(wasErrorRaised,
            "An error should be raised the first time a sequencer signal is " +
            "generated with mismatched duration and value array lengths.");

        wasErrorRaised = flock.test.sequencer.generateAndCatchError(s);
        QUnit.ok(!wasErrorRaised,
            "The second time the signal is generator, an error " +
            "should not be raised again.");

        s.set("sequencer.values", [1]);
        wasErrorRaised = flock.test.sequencer.generateAndCatchError(s);
        QUnit.ok(wasErrorRaised,
            "After an input is updated again and they still are mismatched, " +
            "an error should be raised again.");
    });

    QUnit.test("gh-137: Update to shorter sequence", function () {
        var sampleDur = 1.0 / flock.environment.audioSystem.model.rates.audio,
            durations = [sampleDur * 10, sampleDur * 10],
            values = [1, 2];

        var expectedFirstBlock = flock.generateBuffer(64, function (i) {
            return i < 10 ? 1 : i < 20 ? 2 : 0;
        });

        var s = flock.synth({
            synthDef: {
                id: "seq",
                ugen: "flock.ugen.sequencer",
                rate: "audio",
                durations: durations,
                values: values
            }
        });

        var sequencer = s.get("seq");
        sequencer.gen(64);
        QUnit.deepEqual(sequencer.output, expectedFirstBlock,
            "The first block of the sequencer's signal should have been correctly generated.");

        var expectedSecondBlock = flock.generateBufferWithValue(64, 3);
        s.set({
            "seq.durations": [sampleDur * 64],
            "seq.values": [3]
        });
        sequencer.gen(64);
        QUnit.deepEqual(sequencer.output, expectedSecondBlock,
            "The second block should be correctly generated when the value and duration inputs " +
            "have been changed to a smaller array.");
    });


    QUnit.module("flock.ugen.sequence tests");

    var testSequenceDemand = function (ugen, expectedSequence) {
        for (var i = 0; i < expectedSequence.length; i++) {
            ugen.gen(1);
            QUnit.equal(ugen.output[0], expectedSequence[i]);
        }
    };

    var testSequenceAudio = function (ugen, expectedSequence) {
        ugen.gen(64);
        QUnit.deepEqual(ugen.output, expectedSequence);
    };

    var testSequences = function (testSpec) {
        var ugen = testSpec.ugen;
        var fn = ugen.rate === "audio" ? testSequenceAudio : testSequenceDemand;

        fluid.each(testSpec.tests, function (test) {
            if (test.inputs) {
                ugen.set(test.inputs);
            }

            fn(ugen, test.expectedSequence);
        });
    };

    var seqUGenDef = {
        ugen: "flock.ugen.sequence",
        inputs: {
            freq: (sampleRate / 64) * 4,
            start: 0.0,
            loop: 0.0,
            values: [12, 24, 48]
        }
    };

    QUnit.test("Demand rate", function () {
        seqUGenDef.rate = "demand";
        var seq = flock.parse.ugenDef(seqUGenDef);

        testSequences({
            ugen: seq,
            tests: [
                {
                    expectedSequence: new Float32Array([12, 24, 48, 48, 48])
                },
                {
                    inputs: {
                        loop: 1.0
                    },
                    expectedSequence: new Float32Array([12, 24, 48, 12, 24, 48, 12])
                },
                {
                    inputs: {
                        start: 1,
                        end: 2
                    },
                    expectedSequence: new Float32Array([24, 24, 24, 24])
                },
                {
                    inputs: {
                        start: 0,
                        end: null
                    },
                    expectedSequence: new Float32Array([48, 12, 24, 48])
                }
            ]
        });
    });

    QUnit.test("Audio rate", function () {
        flock.init();

        seqUGenDef.rate = "audio";
        var seq = flock.parse.ugenDef(seqUGenDef);

        testSequences({
            ugen: seq,
            tests: [
                {
                    expectedSequence: new Float32Array([
                        12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
                        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48
                    ])
                },

                // Looping.
                {
                    inputs: {
                        "loop": 0.5
                    },
                    expectedSequence: new Float32Array([
                        12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
                        12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12
                    ])
                },

                // With start/end boundaries.
                {
                    inputs: {
                        start: 1,
                        end: 2
                    },
                    expectedSequence: new Float32Array([
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24
                    ])
                },

                // Back to no boundaries.
                {
                    inputs: {
                        start: 0,
                        end: null
                    },
                    expectedSequence: new Float32Array([
                        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
                        12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48
                    ])
                }
            ]
        });
    });

    environment.destroy();
}());
