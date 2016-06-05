/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Scheduler Timing Tests
*
* Copyright 2016-2016, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, asyncTest, start, expect, ok, equal*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var checkScheduledCallback = function (expectedInterval, reportedInterval, scheduledAt, receivedAt, maxOutlier) {
        var duration = receivedAt - scheduledAt,
            minDur = expectedInterval - maxOutlier,
            maxDur = expectedInterval + maxOutlier;

        equal(reportedInterval, expectedInterval,
            "The callback should return the correct scheduled time.");
        ok(duration >= minDur && duration <= maxDur,
            "The callback should be fired at the scheduled time, within a tolerance of " +
            maxOutlier + "ms. Actual interval was: " + (duration - expectedInterval) + "ms.");

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

        testOnceSchedule({
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

    asyncTest("flock.scheduler.async.repeat()", function () {
        var expectedInterval = 100,
            numRuns = 100,
            runs = 0,
            lastFired = 0,
            mistimingTolerance = 60; // TODO: This value is excessively high.

        expect(2 * numRuns);

        var sked = flock.scheduler.async({
            components: {
                timeConverter: {
                    type: "flock.convert.ms"
                }
            }
        });

        var callback = function () {
            var now = Date.now(),
                actualInterval = now - lastFired;

            if (runs >= numRuns) {
                sked.repeatScheduler.clearInterval(expectedInterval);
                start();
                return;
            }

            ok(actualInterval >= expectedInterval - mistimingTolerance,
                "The scheduled callback should be fired no earlier than " + mistimingTolerance + " ms. Actual was " + actualInterval);
            ok(actualInterval <= expectedInterval + mistimingTolerance,
                "The scheduled callback should be fired no later than " + mistimingTolerance + " ms. Actual was " + actualInterval);

            runs++;
            lastFired = Date.now();
        };

        sked.repeat(expectedInterval, callback);
        lastFired = Date.now();
    });
}());
