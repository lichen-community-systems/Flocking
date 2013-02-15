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
    
    flock.shim = {
        URL: typeof (window) !== "undefined" ? window.URL || window.webkitURL || window.msURL : undefined
    };
    
    flock.worker = function (code) {
        var type = typeof (code),
            url,
            blob;
        
        if (type === "function") {
            code = "(" + code.toString() + ")();";
        } else if (type !== "string") {
            throw new Error("A flock.worker must be initialized with a String or a Function.");
        }
         
        if (window.Blob) {
            blob = new Blob([code], {
                type: "text/javascript"
            });
            url = flock.shim.URL.createObjectURL(blob);
        } else {
            url = "data:text/javascript;base64," + window.btoa(code);
        }
        return new Worker(url);
    };
    
    
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
            for (var interval in that.scheduled) {
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
    
    
    flock.scheduler.webWorkerClockFinalInit = function (that) {
        that.worker = new flock.worker(flock.scheduler.webWorkerClock.workerImpl);
        
        // Start the worker-side clock.
        that.worker.postMessage({
            msg: "start",
            value: that.options.clockType
        });
        
        // Listen for tick messages from the worker and fire accordingly.
        that.worker.addEventListener("message", function (e) {
            that.events.tick.fire(e.data.value);
        }, false);

        that.postToWorker = function (msgName, value) {
            var msg = that.model.messages[msgName];
            if (value !== undefined) {
                msg.value = value;
            }
            that.worker.postMessage(msg);
        };
        
        that.schedule = function (time) {
            that.postToWorker("schedule", time);
        };
        
        that.clear = function (time) {
            that.postToWorker("clear", time);
        };
        
        that.clearAll = function () {
            that.postToWorker("clearAll");
        };
    };
    
    fluid.defaults("flock.scheduler.webWorkerClock", {
        gradeNames: ["fluid.modelComponent", "fluid.eventedComponent", "autoInit"],
        finalInitFunction: "flock.scheduler.webWorkerClockFinalInit",
        model: {
            messages: {
                schedule: {
                    msg: "schedule"
                },
                clear: {
                    msg: "clear"
                },
                clearAll: {
                    msg: "clearAll"
                }
            }
        },
        events: {
            tick: null
        },
        clockType: "intervalClock"
    });
    
    // This code is only intended to run from within a Worker, via flock.worker.
    flock.scheduler.webWorkerClock.workerImpl = function () {
        "use strict";
        
        var flock = flock || {};
        flock.worker = flock.worker || {};
    
        flock.worker.clock = function () {
            var that = {};
        
            that.tick = function (interval) {
                self.postMessage({
                    msg: "tick",
                    value: interval
                });
            };
        
            return that;
        };
    
        flock.worker.intervalClock = function () {
            var that = flock.worker.clock();
            that.scheduled = {};
        
            that.schedule = function (interval) {
                var id = setInterval(function () {
                    that.tick(interval);
                }, interval);
                that.scheduled[interval] = id;
            };

            // TODO: Copy-pasted from flock.scheduler.intervalClock.
            that.clear = function (interval) {
                var id = that.scheduled[interval];
                clearInterval(id);
                delete that.scheduled[interval];
            };
        
            // TODO: Copy-pasted from flock.scheduler.intervalClock.
            that.clearAll = function () {
                for (var interval in that.scheduled) {
                    that.clear(interval);
                }
            };
            
            return that;
        };
    
        flock.worker.scheduleClock = function () {
            var that = flock.worker.clock();
            that.scheduled = [];
        
            that.schedule = function (timeFromNow) {
                var id;
                id = setTimeout(function () {
                    that.clear(id);
                    that.tick(timeFromNow);
                }, timeFromNow);
                that.scheduled.push(id);
            };
        
            // TODO: Copy-pasted from flock.scheduler.scheduleClock.
            that.clear = function (id, idx) {
                idx = idx === undefined ? that.scheduled.indexOf(id) : idx;
                if (idx > -1) {
                    that.scheduled.splice(idx, 1);
                }
                clearTimeout(id);
            };
        
            // TODO: Copy-pasted from flock.scheduler.scheduleClock.
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
                flock.clock = flock.worker[e.data.value]();
            } else if (flock.clock) {
                flock.clock[e.data.msg](e.data.value);
            }
        }, false);
    };
    
    fluid.defaults("flock.scheduler.webWorkerIntervalClock", {
        gradeNames: ["flock.scheduler.webWorkerClock", "autoInit"],
        clockType: "intervalClock"
    });
    
    fluid.defaults("flock.scheduler.webWorkerScheduleClock", {
        gradeNames: ["flock.scheduler.webWorkerClock", "autoInit"],
        clockType: "scheduleClock"
    });
    
    
    /**************
     * Schedulers *
     **************/
     
    flock.scheduler.asyncFinalInit = function (that) {
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
            return that.schedule(that.intervalClock, interval, fn, false);
        };
        
        that.once = function (time, fn) {
            return that.schedule(that.scheduleClock, time, fn, true);
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
            that.intervalClock.events.tick.removeListener(listener);
            that.scheduleClock.events.tick.removeListener(listener);
        };
        
        that.clearRepeat = function (interval) {
            that.removeFilteredListener(that.intervalClock, interval);
            that.intervalClock.clear(interval);
        };
        
        that.clearAll = function () {
            that.intervalClock.clearAll();
            that.scheduleClock.clearAll();

            for (var value in that.valueListeners) {
                delete that.valueListeners[value];
            }
        };
        
        that.init = function () {
            // TODO: Convert to Infusion subcomponent.
            var converter = that.options.timeConverter;
            var converterType = typeof (converter) === "string" ? converter : converter.type;
            that.timeConverter = flock.invoke(undefined, converterType, converter.options);
            
            that.intervalClock = fluid.initSubcomponent(that, "intervalClock", [fluid.COMPONENT_OPTIONS]);
            that.scheduleClock = fluid.initSubcomponent(that, "scheduleClock", [fluid.COMPONENT_OPTIONS]);
        };
         
        that.init();
    };
    
    fluid.defaults("flock.scheduler.async", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        finalInitFunction: "flock.scheduler.asyncFinalInit",
        
        timeConverter: "flock.convert.seconds",
        intervalClock: {
            type: "flock.scheduler.webWorkerIntervalClock"
        },
        scheduleClock: {
            type: "flock.scheduler.webWorkerScheduleClock"
        }
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
