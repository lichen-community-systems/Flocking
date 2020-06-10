/*!
* Flocking Math Unit Generator Unit Tests
* https://github.com/continuing-creativity/flocking
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

    fluid.defaults("flock.test.midi.midiFreqUGenTests", {
        gradeNames: "flock.test.module.runOnCreate",

        name: "flock.ugen.midiFreq tests",

        invokers: {
            run: {
                funcName: "flock.test.midi.midiFreqUGenTests.run"
            }
        }
    });

    flock.test.midi.midiFreqUGenTests.testNoteControl = function (ugen, midiNote, bytes, msg) {
        if (midiNote) {
            ugen.set("note", midiNote);
        }

        if (ugen.get("note").gen) {
            ugen.get("note").gen(1);
        }
        ugen.gen(1);
        flock.test.equalRounded(2, ugen.output[0], bytes, msg);
    };

    flock.test.midi.midiFreqUGenTests.testNotesControl = function (ugen, testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            flock.test.midi.midiFreqUGenTests.testNoteControl(ugen, testSpec.midiNote, testSpec.bytesFreq, testSpec.msg);
        });
    };

    flock.test.midi.midiFreqUGenTests.run = function () {
        jqUnit.test("12TET/A440, constant rate messageSpec", function () {
            var midiFreq = flock.parse.ugenDef({
                ugen: "flock.ugen.midiFreq",
                note: 60
            });

            flock.test.midi.midiFreqUGenTests.testNotesControl(midiFreq, [
                {
                    midiNote: 60,
                    bytesFreq: 261.63,
                    msg: "C4 (MIDI 60) should be converted to 261.64 Hz."
                },
                {
                    midiNote: 21,
                    bytesFreq: 27.50,
                    msg: "A0 (MIDI 21) should be converted to 27.5 Hz."
                },
                {
                    midiNote: 108,
                    bytesFreq: 4186.01,
                    msg: "C8 (MIDI 108) should be converted to 4186 Hz."
                }
            ]);
        });

        jqUnit.test("12TET/A440, control rate messageSpec", function () {
            var midiFreq = flock.parse.ugenDef({
                ugen: "flock.ugen.midiFreq",
                note: {
                    ugen: "flock.ugen.sequence",
                    rate: "control",
                    values: [21, 22, 23],
                    freq: 10000
                }
            });

            flock.test.midi.midiFreqUGenTests.testNotesControl(midiFreq, [
                {
                    bytesFreq: 27.50,
                    msg: "The frequency value of the first item in the sequence should be returned (MIDI 21)."
                },
                {
                    bytesFreq: 29.14,
                    msg: "The frequency value of the next item in the sequence should be returned (MIDI 22)."
                },
                {
                    bytesFreq: 30.87,
                    msg: "The frequency value of the last item in the sequence should be returned (MIDI 23)."
                }
            ]);
        });
    };

    flock.test.midi.midiFreqUGenTests();
}());
