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

    module("Asynchronous Scheduler tests");
    
    var checkScheduledCallback = function (scheduledTime, sentAt, receivedAt) {
        equals(scheduledTime, 500,
            "The callback for once() should return the correct scheduled time.");
        ok(sentAt >= receivedAt - 3,
            "The callback should have been called at the scheduled time, within a tolerance of 3 ms.");
    };
    
    asyncTest("flock.scheduler.async.once()", function () {
        var sked = flock.scheduler.async(),
            runs = 10,
            numRuns = 0;
        
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
        var sked = flock.scheduler.async(),
            expectedInterval = 100,
            numRuns = 100,
            runs = 0,
            lastFired = 0,
            mistimingTolerance = 5,
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
    
    var assertOnlyProperty = function (obj, prop, value) {
        if (arguments.length === 2) {
            value = true;
        }
        
        equal(obj[prop], value,
            "The expected property should have the correct value.");
        equal(1, Object.keys(obj).length,
            "There should be no other properties in the object.");
    };
    
    var testClearScheduler = function (name, clearFnName) {
        asyncTest(name, function () {
            var sked = flock.scheduler.async(),
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
                        assertOnlyProperty(record, prop);
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
