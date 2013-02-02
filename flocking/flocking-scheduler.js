/*
* Flocking Scheduler
* http://github.com/colinbdclark/flocking
*
* Copyright 2013, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.registerNamespace("flock.scheduler");
    
    
    /**********
     * Clocks *
     **********/
    
    flock.scheduler.intervalClockFinalInit = function (that) {
        that.scheduled = {};
        
        that.schedule = function (interval) {
            var id = setInterval(function () {
                that.events.tick.fire(interval);
            }, interval);
            that.scheduled[interval] = id;
        };

        that.clear = function (interval) {
            var id = that.scheduled[interval];
            clearInterval(id);
            delete that.scheduled[interval];
        };
        
        that.clearAll = function () {
            for (var interval in self.scheduled) {
                that.clear(interval);
            }
        };
    };
    
    fluid.defaults("flock.scheduler.intervalClock", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        finalInitFunction: "flock.scheduler.intervalClockFinalInit",
        events: {
            tick: null
        }
    });
    
    flock.scheduler.scheduleClockFinalInit = function (that) {
        that.scheduled = [];
        
        that.schedule = function (timeFromNow) {
            var id;
            id = setTimeout(function () {
                that.clear(id);
                that.events.tick.fire(timeFromNow);
            }, timeFromNow);
            that.scheduled.push(id);
        };
        
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
    };
    
    fluid.defaults("flock.scheduler.scheduleClock", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        finalInitFunction: "flock.scheduler.scheduleClockFinalInit",
        events: {
            tick: null
        }
    });
    
    
    /**************
     * Schedulers *
     **************/
     
    flock.scheduler.asyncFinalInit = function (that) {
        that.clocks = {
            interval: flock.scheduler.intervalClock(),
            scheduled: flock.scheduler.scheduleClock()
        };
        
        that.valueListeners = {};
        
        that.addFilteredListener = function (clock, value, fn, isOneShot) {
            // TODO: Rewrite.
            var listener = function (time) {
                if (time === value) {
                    fn(time);
                    if (isOneShot) {
                        clock.events.tick.removeListener(listener);
                    }
                }
            };
            listener.wrappedListener = fn;
            clock.events.tick.addListener(listener);
            that.valueListeners[value] = that.valueListeners[value] || [];
            that.valueListeners[value].push(listener);

            return listener;
        };
        
        that.removeFilteredListener = function (clock, value) {
            // TODO: Rewrite.
            var listeners = that.valueListeners[value],
                i,
                listener;
            
            if (!listeners) {
                return;
            }
            
            for (i = 0; i < listeners.length; i++) {
                listener = listeners[i];
                clock.events.tick.removeListener(listener);
            }
            listeners.length = 0;
            
            return listener;
        };
        
        that.repeat = function (interval, fn) {
            return that.schedule(that.clocks.interval, interval, fn, false);
        };
        
        that.once = function (time, fn) {
            return that.schedule(that.clocks.scheduled, time, fn, true);
        };
        
        that.schedule = function (clock, time, fn, isOneShot) {
            var ms = that.timeConverter.value(time),
                listener = that.addFilteredListener(clock, ms, fn, isOneShot);
            
            clock.schedule(ms);

            return listener;
        };
        
        that.sequence = function (times, fn) {
            var listeners = [],
                listener;
                
            for (var i = 0; i < times.length; i++) {
                listener = that.once(times[i], fn)
                listeners.push(listener);
            }
            
            return listeners;
        };
        
        that.clear = function (listener) {
            if (!listener) {
                return;
            }
            
            // TODO: Rather inefficient.
            var type,
                clock;
            for (type in that.clocks) {
                clock = that.clocks[type];
                clock.events.tick.removeListener(listener);
            }
        };
        
        that.clearRepeat = function (interval) {
            that.removeFilteredListener(that.clocks.interval, interval);
            that.clocks.interval.clear(interval);
        };
        
        that.clearAll = function () {
            var type,
                clock,
                value;
            
            for (type in that.clocks) {
                clock = that.clocks[type];
                clock.clearAll();
            }
            
            for (value in that.valueListeners) {
                delete that.valueListeners[value];
            }
        };
        
        that.init = function () {
            // TODO: Convert to Infusion subcomponent.
            var converter = that.options.timeConverter;
            var converterType = typeof (converter) === "string" ? converter : converter.type;
            that.timeConverter = flock.invoke(undefined, converterType, converter.options);
        };
         
        that.init();
    };
    
    fluid.defaults("flock.scheduler.async", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        finalInitFunction: "flock.scheduler.asyncFinalInit",
        timeConverter: "flock.convert.seconds"
    });

    
    flock.scheduler.async.beat = function (bpm, options) {
        var that = fluid.initComponent("flock.scheduler.async.beat", options);
        if (bpm !== undefined) {
            that.timeConverter.options.bpm = bpm;
        }
        return that;
    };
    
    fluid.defaults("flock.scheduler.async.beat", {
        gradeNames: ["flock.scheduler.async"],
        argumentMap: {
            options: 1
        },
        timeConverter: {
            type: "flock.convert.beats",
            options: {
                bpm: 60
            }
        }
    });
    
    
    /*******************
     * Time Conversion *
     *******************/
    
    fluid.registerNamespace("flock.convert");
    
    flock.convert.makeStatelessConverter = function (convertFn) {
        return function (options) {
            return {
                value: convertFn
            };
        }
    };
    
    flock.convert.ms = flock.convert.makeStatelessConverter(fluid.identity);
    
    flock.convert.seconds = flock.convert.makeStatelessConverter(function (secs) {
        return secs * 1000;
    });
    
    flock.convert.beatsFinalInit = function (that) {
        that.value = function (beats) {
            var bpm = that.options.bpm;
            return bpm <= 0 ? 0 : (beats / bpm) * 60000;
        };
    };
    
    fluid.defaults("flock.convert.beats", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        finalInitFunction: "flock.convert.beatsFinalInit",
        bpm: 60
    });
    
}());
