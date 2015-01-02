/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, test, asyncTest, start, expect, ok, equal, deepEqual*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    flock.init();

    module("Time Converters");

    test("flock.convert.seconds", function () {
        var converter = flock.convert.seconds();

        equal(converter.value(1.5), 1500, "1.5 seconds should convert to 1500 ms.");
        equal(converter.value(0), 0, "0 seconds should convert to 0 ms.");
    });

    test("flock.convert.beats", function () {
        var bpm = 60,
            oneBeatMin = 1 / bpm,
            oneBeatSec = oneBeatMin * 60,
            oneBeatMs = oneBeatSec * 1000,
            converter = flock.convert.beats({
                bpm: bpm
            }),
            expected;

        expected = 4 * oneBeatMs;
        equal(converter.value(4), expected,
            "4 beats at 60 bpm seconds should convert to " + expected + " ms.");
        equal(converter.value(0), 0, "0 beats at 60 bpm should convert to 0 ms.");

        converter = flock.convert.beats({
            bpm: 0
        });
        equal(converter.value(100), 0,
            "100 beats at 0 bpm should convert to 0 ms.");
    });


    var sked;

    module("Asynchronous Scheduler tests", {
        teardown: function () {
            sked.end();
        }
    });


    var checkScheduledCallback = function (expectedInterval, reportedInterval, scheduledAt, receivedAt, maxOutlier) {
        var duration = receivedAt - scheduledAt,
            minDur = expectedInterval - maxOutlier,
            maxDur = expectedInterval + maxOutlier;

        equal(reportedInterval, expectedInterval,
            "The callback should return the correct scheduled time.");
        ok(duration >= minDur && duration <= maxDur,
            "The callback should be fired at the scheduled time, within a tolerance of " +
            maxOutlier + "ms. Actual interval was: " + duration);

        return Math.abs(duration - expectedInterval);
    };

    var testOnceSchedule = function (testSpec) {
        var numRunsComplete = 0,
            schedulerType = testSpec.scheduler.type,
            schedulerOpts = testSpec.scheduler.options,
            scheduler = fluid.invokeGlobalFunction(schedulerType, [schedulerOpts]),
            actualAverageDrift = 0,
            scheduledAt,
            scheduleFn,
            scheduledAction;

        scheduleFn = function () {
            scheduler[testSpec.interval](testSpec.time, scheduledAction);
            return Date.now();
        };

        scheduledAction = function (scheduledTime) {
            numRunsComplete++;
            actualAverageDrift += checkScheduledCallback(
                testSpec.time, scheduledTime, scheduledAt, Date.now(), testSpec.maxOutlier);
            if (numRunsComplete < testSpec.runs) {
                scheduledAt = scheduleFn();
            } else {
                actualAverageDrift = actualAverageDrift / numRunsComplete;
                equal(numRunsComplete, testSpec.runs,
                    "The scheduled callback should be invoked only once.");
                ok(actualAverageDrift <= testSpec.averageDrift,
                    "The average drift of the scheduler should be no more than " +
                    testSpec.averageDrift + "ms. Actual was: " + actualAverageDrift + "ms.");
                start();
            }
        };

        scheduledAt = scheduleFn();

        return scheduler;
    };

    asyncTest("Scheduling raw functions with once().", function () {
        expect(22);

        sked = testOnceSchedule({
            runs: 10,
            interval: "once",
            time: 100,
            maxOutlier: 65,
            averageDrift: 10,
            scheduler: {
                type: "flock.scheduler.async",
                options: {
                    components: {
                        timeConverter: {
                            type: "flock.convert.ms"
                        }
                    }
                }
            }
        });
    });

    asyncTest("flock.scheduler.once() multiple listeners, different intervals", function () {
        // TODO: Cut and pastage and inconsistencies everywhere!
        var scheduledDelays = [100, 200],
            tolerance = 25, // TODO: Insanely high.
            fired = {},
            makeRecordingListener,
            testingListenerImpl,
            listener1,
            listener2,
            testingListener,
            scheduledAt;

        sked = flock.scheduler.async({
            components: {
                timeConverter: {
                    type: "flock.convert.ms"
                }
            }
        });

        makeRecordingListener = function (record, prop) {
            return function () {
                record[prop] = Date.now() - scheduledAt;
            };
        };

        testingListenerImpl = function () {
            ok(fired.listener1 >= scheduledDelays[0] - tolerance &&
                fired.listener1 <= scheduledDelays[0] + tolerance,
                "The first callback should be scheduled at the expected time, within a tolerance of " + tolerance + "ms." +
                " Actual: " + fired.listener1);
            ok(fired.listener2 >= scheduledDelays[1] - tolerance &&
                fired.listener2 <= scheduledDelays[1] + tolerance,
                "The second callback should be scheduled at the expected time, within a tolerance of " + tolerance + "ms." +
                " Actual: " + fired.listener2);
            start();
        };

        listener1 = sked.once(100, makeRecordingListener(fired, "listener1"));
        listener2 = sked.once(200, makeRecordingListener(fired, "listener2"));
        testingListener = sked.once(300, testingListenerImpl);
        scheduledAt = Date.now();
    });

    asyncTest("flock.scheduler.async.repeat()", function () {
        var expectedInterval = 100,
            numRuns = 100,
            runs = 0,
            lastFired = 0,
            mistimingTolerance = 60, // TODO: This value is excessively high.
            callback;

        expect(2 * numRuns);

        sked = flock.scheduler.async({
            components: {
                timeConverter: {
                    type: "flock.convert.ms"
                }
            }
        });

        callback = function () {
            var now = Date.now(),
                actualInterval = now - lastFired;

            if (runs >= numRuns) {
                sked.clearRepeat(expectedInterval);
                start();
                return;
            }

            ok(actualInterval >= expectedInterval - mistimingTolerance,
                "The scheduled callback should be fired no earlier than " + mistimingTolerance + " ms.");
            ok(actualInterval <= expectedInterval + mistimingTolerance,
                "The scheduled callback should be fired no later than " + mistimingTolerance + " ms.");

            runs++;
            lastFired = Date.now();
        };

        sked.repeat(expectedInterval, callback);
        lastFired = Date.now();
    });

    asyncTest("flock.scheduler.async.repeat() multiple listeners", function () {
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
                    sked.clear(listener1);
                    both = false;
                    runs = 0;
                } else {
                    sked.clear(listener2);
                    sked.clear(testingListener);
                    expect(numRuns * 2);
                    start();
                }
                fluid.clear(fired);
                return;
            }

            if (both) {
                deepEqual(fired, {
                    listener1: true,
                    listener2: true
                }, "Both listeners should fire.");
            } else {
                deepEqual(fired, {
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
        asyncTest(name, function () {
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
                sked[clearFnName](interval);

                if (stage) {
                    runs = 0;
                    sked.repeat(interval, stage);
                } else {
                    start();
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

            expect(stages.length * 2);
            runNextTestStage();
        });
    };

    testClearScheduler("flock.scheduler.async.clearRepeat()", "clearRepeat");
    testClearScheduler("flock.scheduler.async.clearAll()", "clearAll");

}());
