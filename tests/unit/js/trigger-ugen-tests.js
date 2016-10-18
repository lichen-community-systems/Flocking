/*!
* Flocking Trigger Unit Generator Unit Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-15, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, Float32Array*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    var $ = fluid.registerNamespace("jQuery"),
        environment = flock.silentEnviro(),
        sampleRate = environment.audioSystem.model.rates.audio;

    QUnit.module("flock.ugen.t2a");

    QUnit.test("t2a Tests", function () {
        var silence = new Float32Array(64);
        var synthDef = {
            id: "converter",
            ugen: "flock.ugen.t2a",
            source: {
                ugen: "flock.ugen.impulse",
                rate: "control",
                freq: sampleRate,
                phase: 1.0
            }
        };
        var synth = flock.synth({
            synthDef: synthDef
        });

        var t2a = synth.get("converter");
        QUnit.ok(t2a.rate === flock.rates.AUDIO,
            "The unit generator should be running at audio rate.");

        flock.evaluate.synth(synth);
        var expected = new Float32Array(64);
        expected[0] = 1.0;
        QUnit.deepEqual(t2a.output, expected,
            "The control rate trigger value should output at the first index in audio rate output stream.");

        synth.set("converter.offset", 27);
        flock.evaluate.synth(synth);
        QUnit.deepEqual(t2a.output, silence,
            "If the trigger hasn't reset and fired again, the output should be silent.");

        synth.set("converter.source", {
            ugen: "flock.ugen.sequence",
            values: new Float32Array(64),
            freq: sampleRate
        });
        flock.evaluate.synth(synth);
        QUnit.deepEqual(t2a.output, silence,
            "If the trigger has reset but hasn't fired again, the output should be silent.");

        synth.set("converter.source", synthDef.source);
        flock.evaluate.synth(synth);
        expected = new Float32Array(64);
        expected[27] = 1.0;
        QUnit.deepEqual(t2a.output, expected,
            "The control rate trigger value should have been shifted to index 27 in the audio rate output stream.");
    });


    QUnit.module("flock.ugen.triggerCallback");

    flock.test.CallbackCounter = function () {
        this.callbackRecords = [];
    };

    flock.test.CallbackCounter.prototype.callback = function () {
        this.callbackRecords.push(arguments);
    };

    flock.test.CallbackCounter.prototype.clear = function () {
        this.callbackRecords = [];
    };

    var makeCallbackCounter = function () {
        var counter = new flock.test.CallbackCounter();
        counter.boundCallback = counter.callback.bind(counter);
        flock.test.CallbackCounter.singleton = counter;
        return counter;
    };

    fluid.defaults("flock.test.triggerCallbackSynth", {
        gradeNames: ["flock.synth"],
        synthDef: {
            ugen: "flock.ugen.triggerCallback",
            source: {
                ugen: "flock.test.ugen.mock",
                options: {
                    buffer: flock.generateBuffer(64, function (i) {
                        return i;
                    })
                }
            },
            trigger: {
                ugen: "flock.test.ugen.mock",
                options: {
                    buffer: flock.generateBuffer(64, function (i) {
                        return i === 31 ? 1.0 : 0.0;
                    })
                }
            },
            options: {}
        }
    });

    var testTriggerCallback = function (testSpec) {
        var counter = makeCallbackCounter();
        var synthDefSpec = {
            options: {
                callback: {}
            }
        };

        if (testSpec.type === "func" || testSpec.type === "funcName") {
            synthDefSpec.options.callback[testSpec.type] = counter.boundCallback;
        }

        var mergedSynthDef = $.extend(true, synthDefSpec, testSpec.synthDefOverrides);
        var synth = flock.test.triggerCallbackSynth({
            synthDef: mergedSynthDef
        });
        flock.evaluate.synth(synth);

        var expectedNumCalls = testSpec.expectedCallbackArgs.length;
        QUnit.equal(counter.callbackRecords.length, expectedNumCalls, "The callback should have been invoked " +
            expectedNumCalls + " times.");

        for (var i = 0; i < expectedNumCalls; i++) {
            var expectedCallbackRecord = fluid.makeArray(testSpec.expectedCallbackArgs[i]);
            var actualCallbackRecord = counter.callbackRecords[i];
            QUnit.equal(actualCallbackRecord.length, expectedCallbackRecord.length,
                expectedCallbackRecord.length + " arguments should have been passed to the callback.");
            for (var j = 0; j < expectedCallbackRecord.length; j++) {
                QUnit.equal(actualCallbackRecord[j], expectedCallbackRecord[j],
                    "The expected argument at position " + j + " should have been passed to the callback.");
            }
        }
    };

    var runTriggerCallbackTests = function (testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            QUnit.test(testSpec.name, function () {
                testTriggerCallback(testSpec);
            });
        });
    };

    var triggerCallbackTestSpecs = [
        {
            name: "Raw function",
            type: "func",
            expectedCallbackArgs: [
                [31]
            ]
        },
        {
            name: "Raw function, multiple triggers",
            type: "func",
            synthDefOverrides: {
                trigger: {
                    options: {
                        buffer: flock.generateBuffer(64, function (i) {
                            return (i === 31 || i === 62) ? 1.0 : 0.0;
                        })
                    }
                }
            },

            expectedCallbackArgs: [
                [31],
                [62]
            ]
        },
        {
            name: "Raw function with arguments",
            type: "func",
            synthDefOverrides: {
                options: {
                    callback: {
                        args: ["cat"]
                    }
                }
            },
            expectedCallbackArgs: [
                ["cat", 31]
            ]
        },
        {
            name: "Function EL path",
            type: "funcName",
            synthDefOverrides: {
                options: {
                    callback: {
                        funcName: "flock.test.CallbackCounter.singleton.boundCallback"
                    }
                }
            },
            expectedCallbackArgs: [
                [31]
            ]
        },
        {
            name: "this/method pair",
            synthDefOverrides: {
                options: {
                    callback: {
                        "this": "flock.test.CallbackCounter.singleton",
                        method: "callback"
                    }
                }
            },
            expectedCallbackArgs: [
                [31]
            ]
        }
    ];

    runTriggerCallbackTests(triggerCallbackTestSpecs);

    environment.destroy();
}());
