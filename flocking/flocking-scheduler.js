/*
* Flocking Scheduler
* http://github.com/colinbdclark/flocking
*
* Copyright 2013-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global require, self*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    // TODO: This duplicates code in flocking-core and should be factored differently.
    flock.shim = {
        URL: typeof window !== "undefined" ? window.URL || window.webkitURL || window.msURL : undefined
    };

    flock.worker = function (code) {
        var type = typeof code,
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


    fluid.registerNamespace("flock.scheduler");


    /**********
     * Clocks *
     **********/

    fluid.defaults("flock.scheduler.intervalClock", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        events: {
            tick: null
        }
    });

    flock.scheduler.intervalClock.finalInit = function (that) {
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

        that.end = that.clearAll;
    };


    fluid.defaults("flock.scheduler.scheduleClock", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        events: {
            tick: null
        }
    });

    flock.scheduler.scheduleClock.finalInit = function (that) {
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

        that.end = that.clearAll;
    };


    fluid.defaults("flock.scheduler.webWorkerClock", {
        gradeNames: ["fluid.modelComponent", "fluid.eventedComponent", "autoInit"],
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
                },
                end: {
                    msg: "end"
                }
            }
        },
        events: {
            tick: null
        },
        clockType: "intervalClock"
    });

    flock.scheduler.webWorkerClock.finalInit = function (that) {
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

        that.end = function () {
            that.postToWorker("end");
        };
    };


    // This code is only intended to run from within a Worker, via flock.worker.
    flock.scheduler.webWorkerClock.workerImpl = function () {
        "use strict"; // jshint ignore:line

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

            // TODO: Copy-pasted from flock.scheduler.intervalClock.
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

            // TODO: Copy-pasted from flock.scheduler.scheduleClock.
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
            } else if (e.data.msg === "end") {
                if (flock.clock) {
                    flock.clock.clearAll();
                    self.close();
                }
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

    flock.scheduler.makeOneShotValueListener = function (value, fn, removeFn) {
        var listener = function (time) {
            if (time === value) {
                fn(time);
                removeFn(listener);
            }
        };

        return listener;
    };

    flock.scheduler.makeRepeatingValueListener = function (value, fn) {
        return function (time) {
            if (time === value) {
                fn(time);
            }
        };
    };


    fluid.defaults("flock.scheduler.async", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        components: {
            timeConverter: {
                type: "flock.convert.seconds"
            },
            intervalClock: {
                type: "flock.scheduler.webWorkerIntervalClock"
            },
            scheduleClock: {
                type: "flock.scheduler.webWorkerScheduleClock"
            }
        }
    });

    // TODO: Duplication!
    flock.scheduler.async.finalInit = function (that) {
        that.intervalListeners = {};
        that.scheduleListeners = [];

        that.addIntervalListener = function (interval, fn) {
            var listener = flock.scheduler.makeRepeatingValueListener(interval, fn);
            listener.wrappedListener = fn;
            that.intervalListeners[interval] = that.intervalListeners[interval] || [];
            that.intervalListeners[interval].push(listener);
            that.intervalClock.events.tick.addListener(listener);

            return listener;
        };

        that.addScheduleListener = function (time, fn) {
            var listener = flock.scheduler.makeOneShotValueListener(time, fn, that.clear);
            listener.wrappedListener = fn;
            that.scheduleListeners.push(listener);
            that.scheduleClock.events.tick.addListener(listener);

            return listener;
        };

        that.scheduleChange = function (time, changeSpec, addListenerFn, clock) {
            var ms = that.timeConverter.value(time),
                fn = flock.scheduler.async.prepareSchedulerFn(changeSpec, that.events),
                listener = addListenerFn(ms, fn);

            clock.schedule(ms);
            return listener;
        };

        that.repeat = function (interval, changeSpec) {
            return that.scheduleChange(interval, changeSpec, that.addIntervalListener, that.intervalClock);
        };

        that.once = function (time, changeSpec) {
            return that.scheduleChange(time, changeSpec, that.addScheduleListener, that.scheduleClock);
        };

        that.sequence = function (times, changeSpec) {
            var listeners = [],
                listener;

            for (var i = 0; i < times.length; i++) {
                listener = that.once(times[i], changeSpec);
                listeners.push(listener);
            }

            return listeners;
        };

        that.schedule = function (schedules) {
            schedules = flock.isIterable(schedules) ? schedules : [schedules];

            var i,
                schedule;

            for (i = 0; i < schedules.length; i++) {
                schedule = schedules[i];
                flock.invoke(that, schedule.interval, [schedule.time, schedule.change]);
            }
        };

        that.clear = function (listener) {
            if (!listener) {
                return;
            }

            // TODO: Rather inefficient.
            var idx = that.scheduleListeners.indexOf(listener),
                interval;
            if (idx > -1) {
                that.scheduleClock.events.tick.removeListener(listener);
                that.scheduleListeners.splice(idx, 1);
                return;
            }

            that.intervalClock.events.tick.removeListener(listener);
            for (interval in that.intervalListeners) {
                idx = that.intervalListeners[interval].indexOf(listener);
                if (idx > -1) {
                    that.intervalListeners[interval].splice(idx, 1);
                }
            }
        };

        that.clearRepeat = function (interval) {
            that.intervalClock.clear(interval);

            var listeners = that.intervalListeners[interval],
                i,
                listener;

            if (!listeners) {
                return;
            }

            for (i = 0; i < listeners.length; i++) {
                listener = listeners[i];
                that.intervalClock.events.tick.removeListener(listener);
            }
            listeners.length = 0;

            return listener;
        };

        that.clearAll = function () {
            that.intervalClock.clearAll();
            for (var interval in that.intervalListeners) {
                that.clearRepeat(interval);
            }

            that.scheduleClock.clearAll();
            for (var listener in that.scheduleListeners) {
                that.clear(listener);
            }
        };

        that.end = function () {
            that.intervalClock.end();
            that.scheduleClock.end();
        };

        if (that.options.score) {
            that.schedule(that.options.score);
        }
    };

    flock.scheduler.async.prepareSchedulerFn = function (changeSpec, events) {
        var type = typeof changeSpec,
            fn;

        if (type === "function") {
            // The user has scheduled a raw function pointer.
            fn = changeSpec;
        } else if (type === "string") {
            // An event was scheduled by name.
            fn = events[changeSpec].fire;
        } else {
            // A change spec object was scheduled.
            fn = flock.scheduler.async.evaluateChangeSpec(changeSpec);
        }

        return fn;
    };

    flock.scheduler.async.evaluateChangeSpec = function (changeSpec) {
        var synths = {},
            staticChanges = {};

        // Find all synthDefs and create demand rate synths for them.
        for (var path in changeSpec.values) {
            var change = changeSpec.values[path];
            if (change.synthDef) {
                synths[path] = flock.synth.value(change);
            } else {
                staticChanges[path] = change;
            }
        }

        // Create a scheduler listener that evaluates the changeSpec and updates the synth.
        return function () {
            for (var path in synths) {
                var synth = synths[path];
                staticChanges[path] = synth.value();
            }

            // TODO: Hardcoded to the shared environment.
            var targetSynth = typeof changeSpec.synth === "string" ?
                flock.enviro.shared.namedNodes[changeSpec.synth] : changeSpec.synth;
            targetSynth.set(staticChanges);
        };
    };

    fluid.defaults("flock.scheduler.async.tempo", {
        gradeNames: ["flock.scheduler.async", "autoInit"],

        bpm: 60,

        components: {
            timeConverter: {
                type: "flock.convert.beats",
                options: {
                    bpm: "{tempo}.options.bpm"
                }
            }
        }
    });


    /*******************
     * Time Conversion *
     *******************/

    fluid.registerNamespace("flock.convert");

    flock.convert.makeStatelessConverter = function (convertFn) {
        return function () {
            return {
                value: convertFn
            };
        };
    };

    flock.convert.ms = flock.convert.makeStatelessConverter(fluid.identity);

    flock.convert.seconds = flock.convert.makeStatelessConverter(function (secs) {
        return secs * 1000;
    });

    fluid.defaults("flock.convert.beats", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        bpm: 60
    });

    flock.convert.beats.finalInit = function (that) {
        that.value = function (beats) {
            var bpm = that.options.bpm;
            return bpm <= 0 ? 0 : (beats / bpm) * 60000;
        };
    };
}());
