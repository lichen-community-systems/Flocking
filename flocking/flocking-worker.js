/*
* Flocking Web Worker Code
* http://github.com/colinbdclark/flocking
*
* Copyright 2013, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Float32Array, Audio*/
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";

    flock.intervalClock = function () {
        var that = {
            scheduled: {}
        };
                
        that.onInterval = function (interval) {
            self.postMessage({
                msg: "tick",
                value: interval
            });
        };

        that.schedule = function (interval) {
            var id = setInterval(function () {
                that.onInterval(interval);
            }, interval);
            that.scheduled[interval] = id;
        };

        that.clear = function (interval) {
            var id = that.scheduled[interval];
            clearInterval(id);
        };
             
        that.clearAll = function () {
            for (var interval in self.scheduled) {
                that.clear(interval);
            }
        };
                
        return that;
    };
            
    flock.specifiedTimeClock = function () {
        var that = {
            scheduled: []
        };
            
        that.schedule = function (timeFromNow) {
            var id;
            id = setTimeout(function () {
                that.clear(id);
                self.postMessage({
                    msg: "tick",
                    value: timeFromNow
                });
            }, timeFromNow);
            that.scheduled.push(id);
        };
            
        // TODO: How do we pass the id back to the client?
        that.clear = function (id, idx) {
            idx = idx === undefined ? that.scheduled.indexOf(id) : idx;
            if (idx > -1) {
                that.scheduled.splice(idx, 1);
            }
            clearTimeout(id);
        };
            
        that.clearAll = function () {
            for (var i = 0; i < that.scheduled.length; i++) {
                var id = that.scheduled[i];
                clearTimeout(id);
            }
            that.scheduled.length = 0;
        };
            
        return that;
    };
        
    self.addEventListener("message", function (e) {
        if (e.data.msg === "start") {
            flock.clock = flock[e.data.value]();
        } else if (flock.clock) {
            flock.clock[e.data.msg](e.data.value);
        }
    }, false);
    
}());
