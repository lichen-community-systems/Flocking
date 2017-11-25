/*!
* Flocking MIDI Unit Generator Unit Tests
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

    var environment = flock.silentEnviro();

    var testPort = {
        manufacturer: "KORG INC.",
        name: "SLIDER/KNOB"
    };

    var testMatch = function (name, matcherType, matchSpec, port, matchExpected) {
        QUnit.test(name, function () {
            var matcher = fluid.invokeGlobalFunction(matcherType, [matchSpec]);
            var didMatch = matcher(port);

            var msg = matchExpected ? "The match specification should have matched the port." :
                "The match specification should not have matched the port.";

            QUnit.equal(didMatch, matchExpected, msg);
        });
    };

    var runMatchTests = function (testSpecsByType) {
        for (var matcherType in testSpecsByType) {
            var testSpecs = testSpecsByType[matcherType];
            QUnit.module("Port Matcher: " + matcherType);
            for (var i = 0; i < testSpecs.length; i++) {
                var spec = testSpecs[i];
                testMatch(spec.name, matcherType, spec.matchSpec, spec.port, spec.shouldMatch);
            }
        }
    };

    var matchTestSpecs = {
        "flock.midi.findPorts.lowerCaseContainsMatcher": [
            {
                name: "Single-property complete match",
                matchSpec: {
                    manufacturer: "KORG INC."
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Single property mismatch",
                matchSpec: {
                    manufacturer: "AKAI"
                },
                port: testPort,
                shouldMatch: false
            },
            {
                name: "Multiple property complete match",
                matchSpec: {
                    manufacturer: "KORG INC.",
                    name: "SLIDER/KNOB"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Multiple property mismatch",
                matchSpec: {
                    manufacturer: "AKAI",
                    name: "SLIDER/KNOB"
                },
                port: testPort,
                shouldMatch: false
            },
            {
                name: "Single property partial match",
                matchSpec: {
                    manufacturer: "KORG"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Multiple property partial match",
                matchSpec: {
                    manufacturer: "KORG",
                    name: "SLIDER"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Single property wildcard match",
                matchSpec: {
                    name: "*"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Multiple property wildcard match",
                matchSpec: {
                    manufacturer: "KORG INC.",
                    name: "*"
                },
                port: testPort,
                shouldMatch: true
            }
        ]
    };

    runMatchTests(matchTestSpecs);


    QUnit.module("flock.ugen.midiFreq tests");

    var testNoteControl = function (ugen, midiNote, expected, msg) {
        if (midiNote) {
            ugen.set("note", midiNote);
        }

        if (ugen.get("note").gen) {
            ugen.get("note").gen(1);
        }
        ugen.gen(1);
        flock.test.equalRounded(2, ugen.output[0], expected, msg);
    };

    var testNotesControl = function (ugen, testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            testNoteControl(ugen, testSpec.midiNote, testSpec.expectedFreq, testSpec.msg);
        });
    };

    QUnit.test("12TET/A440, constant rate input", function () {
        var midiFreq = flock.parse.ugenDef({
            ugen: "flock.ugen.midiFreq",
            note: 60
        });

        testNotesControl(midiFreq, [
            {
                midiNote: 60,
                expectedFreq: 261.63,
                msg: "C4 (MIDI 60) should be converted to 261.64 Hz."
            },
            {
                midiNote: 21,
                expectedFreq: 27.50,
                msg: "A0 (MIDI 21) should be converted to 27.5 Hz."
            },
            {
                midiNote: 108,
                expectedFreq: 4186.01,
                msg: "C8 (MIDI 108) should be converted to 4186 Hz."
            }
        ]);
    });

    QUnit.test("12TET/A440, control rate input", function () {
        var midiFreq = flock.parse.ugenDef({
            ugen: "flock.ugen.midiFreq",
            note: {
                ugen: "flock.ugen.sequence",
                rate: "control",
                values: [21, 22, 23],
                freq: 10000
            }
        });

        testNotesControl(midiFreq, [
            {
                expectedFreq: 27.50,
                msg: "The frequency value of the first item in the sequence should be returned (MIDI 21)."
            },
            {
                expectedFreq: 29.14,
                msg: "The frequency value of the next item in the sequence should be returned (MIDI 22)."
            },
            {
                expectedFreq: 30.87,
                msg: "The frequency value of the last item in the sequence should be returned (MIDI 23)."
            }
        ]);
    });

    environment.destroy();
}());
