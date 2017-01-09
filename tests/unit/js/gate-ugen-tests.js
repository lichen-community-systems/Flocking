/*!
* Flocking Gate Unit Generator Tests
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

    var QUnit = fluid.registerNamespace("QUnit");

    var environment = flock.silentEnviro(),
        sampleRate = environment.audioSystem.model.rates.audio;

    QUnit.module("flock.ugen.gate() tests");

    fluid.defaults("flock.test.gateSynth", {
        gradeNames: ["flock.synth"],
        synthDef: {
            id: "gate",
            ugen: "flock.ugen.gate",
            source: {
                ugen: "flock.test.ugen.mock",
                options: {
                    buffer: flock.test.ascendingBuffer(64, 1)
                }
            },
            threshold: 32
        }
    });

    var testGate = function (expectedOutput, synthOptions) {
        var gateSynth = flock.test.gateSynth(synthOptions),
            gateUGen = gateSynth.get("gate");

        flock.evaluate.synth(gateSynth);
        QUnit.deepEqual(gateUGen.output, expectedOutput,
            "The gate should open and remain open when the source signal hits the threshold.");
    };

    var runGateTests = function (testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            QUnit.test(testSpec.name, function () {
                testGate(testSpec.expectedOutput, testSpec.synthOptions);
            });
        });
    };

    var gateTestSpecs = [
        {
            name: "without a separate sideChain input",
            expectedOutput: flock.generateBuffer(64, function (i) {
                return i > 30 ? i + 1 : 0;
            })
        },
        {
            name: "with a separate sideChain input",
            expectedOutput: flock.generateBuffer(64, function (i) {
                return i > 9 ? i + 1 : 0;
            }),
            synthOptions:{
                synthDef: {
                    threshold: 0.5,
                    sideChain: {
                        ugen: "flock.test.ugen.mock",
                        options: {
                            buffer: flock.test.ascendingBuffer(64, 0, 0.05)
                        }
                    }
                }
            }
        },
        {
            name: "with holdLastValue enabled",
            expectedOutput: flock.generateBuffer(64, function (i) {
                return i % 2 ? i + 1 : i;
            }),
            synthOptions: {
                synthDef: {
                    threshold: 1,
                    sideChain: {
                        ugen: "flock.test.ugen.mock",
                        options: {
                            buffer: flock.generateBuffer(64, function (i) {
                                return i % 2 ? 1.0 : 0.0;
                            })
                        }
                    },
                    options: {
                        holdLastValue: true
                    }
                }
            }
        }
    ];

    runGateTests(gateTestSpecs);


    QUnit.module("flock.ugen.latch");

    var testLatch = function (latchSynth, trigger, expectedOutput, expectedRate, msg) {
        if (trigger !== undefined) {
            latchSynth.set("latcher.trigger", trigger);
        }

        flock.evaluate.synth(latchSynth);
        var latch = latchSynth.get("latcher");
        QUnit.equal(latch.gen, expectedRate === "audio" ? latch.arGen : latch.krGen,
            "The unit generator should be generating samples at " + expectedRate + " rate.");
        QUnit.deepEqual(latch.output, expectedOutput, msg);
    };

    var runLatchTests = function (testSpec) {
        var latchSynth = flock.synth({
            synthDef: testSpec.synthDef
        });

        fluid.each(testSpec.tests, function (test) {
            testLatch(latchSynth, test.trigger, test.expected, test.rate, test.msg);
        });
    };


    QUnit.test("Trigger running at control rate", function () {
        var oneBuffer = flock.generateBufferWithValue(64, 1);
        var twoBuffer = flock.generateBufferWithValue(64, 2);

        var testSpec = {
            synthDef: {
                id: "latcher",
                ugen: "flock.ugen.latch",
                source: {
                    ugen: "flock.ugen.sequence",
                    loop: 1.0,
                    rate: "control",
                    values: [1, 2, 3, 4],
                    freq: sampleRate / 64
                },
                trigger: 0.0
            },

            tests: [
                {
                    expected: oneBuffer, // Source is 1, latch is 1.
                    rate: "control",
                    msg: "When the trigger is closed, latch should output the first value."
                },
                {
                    trigger: 1.0,
                    expected: twoBuffer, // Source is 2, latch is 2.
                    rate: "control",
                    msg: "When the trigger opens at control rate, the latch should output the next value."
                },
                {
                    expected: twoBuffer, // Source is 3, latch is 2.
                    rate: "control",
                    msg: "With the trigger still open, the latch's output should not change until the trigger crosses zero into the positive again."
                },
                {
                    trigger: 0.0, // Source is 4, latch is 2.
                    expected: twoBuffer,
                    rate: "control",
                    msg: "With the trigger closed again, the latch's output still shouldn't have changed."
                },
                {
                    trigger: 0.01, // Source is 1, latch is 1.
                    expected: oneBuffer,
                    rate: "control",
                    msg: "Once the trigger has crossed zero again, the latch's output should sample and hold the source's output again."
                }
            ]
        };

        runLatchTests(testSpec);
    });

    QUnit.test("Trigger running at audio rate", function () {
        var outputBuffer =  flock.generateBuffer(64, function (i) {
            return i + 1;
        });

        var secondTrig = flock.generateBufferWithValue(64, 0.0);
        secondTrig[1] = 1.0;

        var secondExpected = flock.generateBufferWithValue(64, 2);
        secondExpected[0] = 1;

        var thirdTrig = flock.generateBufferWithValue(64, 0.0);
        thirdTrig[2] = 1.0;
        thirdTrig[3] = 0.0;
        thirdTrig[4] = 0.001;

        var thirdExpected = flock.generateBufferWithValue(64, 5);
        thirdExpected[0] = 2; // Hold value is at 2
        thirdExpected[1] = 2;
        thirdExpected[2] = 3; // Two samples have gone by, value will be 3.
        thirdExpected[3] = 3; // Hold value is 3.

        var testSpec = {
            synthDef: {
                id: "latcher",
                ugen: "flock.ugen.latch",
                rate: "audio",
                source: {
                    ugen: "flock.ugen.sequence",
                    loop: 1.0,
                    rate: "audio",
                    values: outputBuffer,
                    freq: sampleRate
                },
                trigger: {
                    ugen: "flock.test.ugen.mock",
                    rate: "audio",
                    options: {
                        buffer: flock.generateBufferWithValue(64, 0.0)
                    }
                }
            },

            tests: [
                {
                    expected: flock.generateBufferWithValue(64, 1), // First value from the source; trigger is closed.
                    rate: "audio",
                    msg: "When the trigger is closed for an entire control period, latch should output only the first value."
                },
                {
                    trigger: {
                        ugen: "flock.test.ugen.mock",
                        rate: "audio",
                        options: {
                            buffer: secondTrig
                        }
                    },
                    expected: secondExpected,
                    rate: "audio",
                    msg: "When the trigger opens for one sample the latch should output only the next value."
                },
                {
                    trigger: {
                        ugen: "flock.test.ugen.mock",
                        rate: "audio",
                        options: {
                            buffer: thirdTrig
                        }
                    },
                    expected: thirdExpected,
                    rate: "audio",
                    msg: "When the trigger opens, then closes, then opens again, the next two samples should be output."
                }
            ]
        };

        runLatchTests(testSpec);
    });

    environment.destroy();
}());
