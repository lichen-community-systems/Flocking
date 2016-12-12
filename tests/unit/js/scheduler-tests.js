/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    var environment;
    QUnit.testStart(function () {
        environment = flock.silentEnviro();
    });

    QUnit.testDone(function () {
        environment.destroy();
    });

    QUnit.module("Time Converters");

    QUnit.test("flock.convert.seconds", function () {
        var converter = flock.convert.seconds();

        QUnit.equal(converter.value(1.5), 1500, "1.5 seconds should convert to 1500 ms.");
        QUnit.equal(converter.value(0), 0, "0 seconds should convert to 0 ms.");
    });

    QUnit.test("flock.convert.beats", function () {
        var bpm = 60,
            oneBeatMin = 1 / bpm,
            oneBeatSec = oneBeatMin * 60,
            oneBeatMs = oneBeatSec * 1000,
            converter = flock.convert.beats({
                bpm: bpm
            }),
            expected;

        expected = 4 * oneBeatMs;
        QUnit.equal(converter.value(4), expected,
            "4 beats at 60 bpm seconds should convert to " + expected + " ms.");
        QUnit.equal(converter.value(0), 0, "0 beats at 60 bpm should convert to 0 ms.");

        converter = flock.convert.beats({
            bpm: 0
        });
        QUnit.equal(converter.value(100), 0,
            "100 beats at 0 bpm should convert to 0 ms.");
    });


    var sked;

    QUnit.module("Asynchronous Scheduler tests", {
        teardown: function () {
            sked.end();
        }
    });

    QUnit.asyncTest("flock.scheduler.async.repeat() multiple listeners", function () {
        var interval = 100,
            numRuns = 10,
            runs = 0,
            fired = {},
            both = true,
            makeRecordingListener,
            testingListenerImpl,
            listener1,
            listener2,
            testingListener;

        sked = flock.scheduler.async({
            components: {
                timeConverter: {
                    type: "flock.convert.ms"
                }
            }
        });

        makeRecordingListener = function (record, prop) {
            return function () {
                record[prop] = true;
            };
        };

        testingListenerImpl = function () {
            if (runs >= numRuns) {
                if (both) {
                    sked.repeatScheduler.clear(interval, listener1);
                    both = false;
                    runs = 0;
                } else {
                    sked.repeatScheduler.clear(interval, listener2);
                    sked.repeatScheduler.clear(interval, testingListener);
                    QUnit.expect(numRuns * 2);
                    QUnit.start();
                }
                fluid.clear(fired);
                return;
            }

            if (both) {
                QUnit.deepEqual(fired, {
                    listener1: true,
                    listener2: true
                }, "Both listeners should fire.");
            } else {
                QUnit.deepEqual(fired, {
                    listener2: true
                }, "After the first listener has been removed, only the second should fire.");
            }
            fluid.clear(fired);
            runs++;
        };

        listener1 = sked.repeat(interval, makeRecordingListener(fired, "listener1"));
        listener2 = sked.repeat(interval, makeRecordingListener(fired, "listener2"));
        testingListener = sked.repeat(interval, testingListenerImpl);
    });


    var testClearScheduler = function (name, clearFnName) {
        QUnit.asyncTest(name, function () {
            var interval = 100,
                numRuns = 10,
                runs = 0,
                fired = {},
                runNextTestStage,
                makeRecordingListener,
                stages;

            sked = flock.scheduler.async({
                components: {
                    timeConverter: {
                        type: "flock.convert.ms"
                    }
                }
            });

            runNextTestStage = function () {
                var stage = stages.shift();
                sked.repeatScheduler[clearFnName](interval);

                if (stage) {
                    runs = 0;
                    sked.repeat(interval, stage);
                } else {
                    QUnit.start();
                }
            };

            makeRecordingListener = function (record, prop) {
                return function () {
                    record[prop] = true;

                    if (runs >= numRuns) {
                        flock.test.containsSoleProperty(record, prop);
                        fluid.clear(record);
                        runNextTestStage();
                        return;
                    }

                    runs++;
                };
            };

            stages = [
                makeRecordingListener(fired, "listener1"),
                makeRecordingListener(fired, "listener2")
            ];

            QUnit.expect(stages.length * 2);
            runNextTestStage();
        });
    };

    testClearScheduler("flock.scheduler.repeat.clearInterval()", "clearInterval");
    testClearScheduler("flock.scheduler.async.clearAll()", "clearAll");

    QUnit.module("Declarative scheduling");

    fluid.defaults("flock.scheduler.tests.targetingSynth", {
        gradeNames: ["fluid.component"],

        components: {
            synthy: {
                type: "flock.synth",
                options: {
                    synthDef: {
                        id: "sin",
                        ugen: "flock.ugen.sin",
                        freq: 440,
                        mul: 0.0
                    }
                }
            },

            sked: {
                type: "flock.scheduler.async",
                options: {
                    components: {
                        synthContext: "{targetingSynth}"
                    },

                    score: [
                        {
                            interval: "once",
                            time: 0.001,
                            change: {
                                synth: "synthy",
                                values: {
                                    "sin.freq": 110
                                }
                            }
                        }
                    ]
                }
            }
        }
    });

    QUnit.asyncTest("Targeting changes at synth using the scheduler's synthContext", function () {
        var testComponent = flock.scheduler.tests.targetingSynth();
        QUnit.equal(440, testComponent.synthy.get("sin.freq"),
            "The target synth's initial frequency should be as configured.");

        setTimeout(function () {
            QUnit.equal(110, testComponent.synthy.get("sin.freq"),
                "The target synth's frequency input should have been updated correctly.");
            testComponent.sked.end();
            QUnit.start();
        }, 200);
    });
}());
