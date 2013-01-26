/*
* Flocking Web Worker Code
* http://github.com/colinbdclark/flocking
*
* Copyright 2013, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global importScripts, self, flock*/
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";
    
    importScripts("flock-scheduler");
    
    flock.worker = flock.worker || {};
    
    flock.worker.intervalClock = function () {
        var that = flock.scheduler.intervalClock();
        
        that.tick = function (interval) {
            self.postMessage({
                msg: "tick",
                value: interval
            });
        };
        
        return that;
    };
    
    flock.worker.scheduleClock = function () {
        var that = flock.scheduler.scheduleClock();
        
        that.tick = function (time) {
            self.postMessage({
                msg: "tick",
                value: timeFromNow
            });
        };
        
        return that;
    };
        
    self.addEventListener("message", function (e) {
        if (e.data.msg === "start") {
            flock.clock = flock.worker[e.data.value]();
        } else if (flock.clock) {
            flock.clock[e.data.msg](e.data.value);
        }
    }, false);
    
}());
