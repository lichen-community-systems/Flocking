/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global module, test, expect, ok, equals, deepEqual, Float32Array*/
/*jslint white: true, vars: true, plusplus: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";

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
            "4 beats at 60 bpm seconds should convert to " + expected + " ms.")
            equal(converter.value(0), 0, "0 beats at 60 bpm should convert to 0 ms.");

        converter = flock.convert.beats({
            bpm: 0
        });
        equal(converter.value(100), 0,
            "100 beats at 0 bpm should convert to 0 ms.");
    });
    
    
    module("Asynchronous Scheduler tests");
    
    var checkScheduledCallback = function (scheduledTime, sentAt, receivedAt) {
        equals(scheduledTime, 500,
            "The callback for once() should return the correct scheduled time.");
        ok(sentAt >= receivedAt - 3,
            "The callback should have been called at the scheduled time, within a tolerance of 3 ms.");
    };
    
    asyncTest("flock.scheduler.async.once()", function () {
        var runs = 10,
            numRuns = 0,
            sked = flock.scheduler.async({
                timeConverter: "flock.convert.ms"
            });
        
        expect(21);
        
        var scheduledAction = function (scheduledTime, now) {
            numRuns++;
            checkScheduledCallback(scheduledTime, now, Date.now());
            if (numRuns < runs) {
                sked.once(500, scheduledAction);
            } else {
                equals(numRuns, runs,
                    "The scheduled callback should be invoked only once.");
                start();
            }
        };
        sked.once(500, scheduledAction);
    });
    
    asyncTest("flock.scheduler.async.repeat()", function () {
        var sked = flock.scheduler.async({
                timeConverter: "flock.convert.ms"
            }),
            expectedInterval = 100,
            numRuns = 100,
            runs = 0,
            lastFired = 0,
            mistimingTolerance = 25,
            callback;
        
        expect(2 * numRuns);
        
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
        var sked = flock.scheduler.async({
                timeConverter: "flock.convert.ms"
            }),
            interval = 100,
            numRuns = 10,
            runs = 0,
            fired = {},
            both = true,
            makeRecordingListener,
            testingListenerImpl,
            listener1,
            listener2,
            testingListener;
        
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
                flock.clear(fired);
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
            flock.clear(fired);
            runs++;
        };
        
        listener1 = sked.repeat(100, makeRecordingListener(fired, "listener1"));
        listener2 = sked.repeat(100, makeRecordingListener(fired, "listener2"));
        testingListener = sked.repeat(100, testingListenerImpl);
    });
    
    
    var testClearScheduler = function (name, clearFnName) {
        asyncTest(name, function () {
            var sked = flock.scheduler.async({
                    timeConverter: "flock.convert.ms"
                }),
                interval = 100,
                numRuns = 10,
                runs = 0,
                fired = {},
                runNextTestStage,
                makeRecordingListener,
                listener1,
                listener2,
                stages;
        
            runNextTestStage = function () {
                var stage = stages.shift();
                sked[clearFnName](interval);
                
                if (stage) {
                    runs = 0;
                    sked.repeat(interval, stage);
                } else {
                    start();
                    expect(stages.length * 2);
                }
            };
        
            makeRecordingListener = function (record, prop) {
                return function () {
                    record[prop] = true;
                
                    if (runs >= numRuns) {
                        flock.test.assertSoleProperty(record, prop);
                        flock.clear(record);
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
        
            runNextTestStage();        
        });
    };
    
    testClearScheduler("flock.scheduler.async.clearRepeat()", "clearRepeat");
    testClearScheduler("flock.scheduler.async.clearAll()", "clearAll");

}());
