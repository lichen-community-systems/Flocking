/*
 * Flocking Synth Note Target Tests
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2017, Colin Clark
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit"),
        $ = fluid.registerNamespace("jQuery");

    QUnit.module("Synth note target tests");
    fluid.registerNamespace("flock.test.synth");

    flock.test.synth.testNoteEvents = function (testSpec) {
        var baseOpts = {
            synthDef: {
                id: "carrier",
                ugen: "flock.ugen.sinOsc",
                freq: 440,
                mul: {
                    id: "env",
                    ugen: "flock.ugen.asr",
                    gate: 0.0
                }
            }
        };

        var opts = testSpec.synthOptions ?
            $.extend({}, baseOpts, testSpec.synthOptions) : baseOpts;

        var s = flock.synth(opts);

        flock.test.synth.testNoteEvents.assertSynthState("Initially",
            testSpec.initialState.expected, s);

        s.noteOn(testSpec.noteOn.change);

        flock.test.synth.testNoteEvents.assertSynthState(
            "After receiving a note on event",
            testSpec.noteOn.expected, s);

        s.noteOff(testSpec.noteOff.change);

        flock.test.synth.testNoteEvents.assertSynthState(
            "After receiving a note off event",
            testSpec.noteOff.expected, s);
    };

    flock.test.synth.testNoteEvents.assertSynthState = function (msgPrefix, expected, s) {
        fluid.each(expected, function (value, path) {
            QUnit.equal(s.get(path), value,
                msgPrefix + ", " + path + " should be " + value + ".");
        });
    };

    var noteTestSpecs = [
        {
            initialState: {
                expected: {
                    "env.gate": 0.0
                }
            },

            noteOn: {
                expected: {
                    "env.gate": 1.0
                }
            },

            noteOff: {
                expected: {
                    "env.gate": 0.0
                }
            }
        },
        {
            initialState: {
                expected: {
                    "carrier.freq": 440,
                    "env.gate": 0.0
                }
            },

            noteOn: {
                change: {
                    "carrier.freq": 220
                },
                expected: {
                    "carrier.freq": 220,
                    "env.gate": 1.0
                }
            },

            noteOff: {
                change: {
                    "carrier.freq": 0
                },
                expected: {
                    "carrier.freq": 0,
                    "env.gate": 0.0
                }
            }
        },
        {
            synthOptions: {
                noteChanges: {
                    on: {
                        "env.sustain": 0.5
                    },

                    off: {
                        "env.release": 10
                    }
                }
            },

            initialState: {
                expected: {
                    "carrier.freq": 440,
                    "env.gate": 0.0,
                    "env.sustain": 1.0,
                    "env.release": 1.0
                }
            },

            noteOn: {
                change: {
                    "carrier.freq": 220
                },
                expected: {
                    "carrier.freq": 220,
                    "env.gate": 1.0,
                    "env.sustain": 0.5,
                    "env.release": 1.0
                }
            },

            noteOff: {
                change: {
                    "carrier.freq": 0
                },
                expected: {
                    "carrier.freq": 0,
                    "env.gate": 0.0,
                    "env.sustain": 0.5,
                    "env.release": 10
                }
            }
        }
    ];

    QUnit.test("synth.noteOn()/noteOff()", function () {
        fluid.each(noteTestSpecs, flock.test.synth.testNoteEvents);
    });
}());
