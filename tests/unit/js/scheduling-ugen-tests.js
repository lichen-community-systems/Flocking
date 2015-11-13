/*!
* Flocking Scheduling Unit Generator Tests
*
* Copyright 2014-2015, Colin Clark,
* Copyright 2015, OCAD University
*
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, QUnit*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    flock.init();

    QUnit.module("flock.ugen.change");

    var changeDef = {
        id: "changer",
        ugen: "flock.ugen.change",
        initial: 1.0,
        target: 2.0,
        time: 1/750
    };

    var makeUGen = function (def) {
        return flock.parse.ugenForDef(fluid.copy(def), {
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
        QUnit.deepEqual(changer.output, flock.generate(64, 1),
            "For the first sample block, the output should be the initial input's output.");

        flock.test.evaluateUGen(changer);
        QUnit.deepEqual(changer.output, flock.generate(64, 2),
            "For the second sample block, the output should be the target input's output.");
    });

    QUnit.test("Crossfade", function () {
        QUnit.expect(3);

        var crossFadeDef = $.extend({}, changeDef, {
            crossfade: 1/750
        });

        var changer = makeUGen(crossFadeDef),
            crossfadeBuffer = flock.generate(64, function (i) {
                var targetLevel = i / 64,
                    initialLevel = 1 - targetLevel;
                return (1 * initialLevel) + (2 * targetLevel);
            });

        flock.test.evaluateUGen(changer);
        QUnit.deepEqual(changer.output, flock.generate(64, 1),
            "For the first sample block, the output should be the initial input's output.");

        flock.test.evaluateUGen(changer);
        QUnit.deepEqual(changer.output, crossfadeBuffer,
            "For the second sample block, the output should crossfade from the initial to the target input.");

        flock.test.evaluateUGen(changer);
        QUnit.deepEqual(changer.output, flock.generate(64, 2),
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
}());
