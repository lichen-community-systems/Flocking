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
    fluid.defaults("flock.scheduler.clock", {
        gradeNames: ["fluid.component"],

        invokers: {
            end: "fluid.mustBeOverridden"
        },

        events: {
            tick: null
        },

        listeners: {
            "onDestroy.end": "{that}.end()"
        }
    });

    fluid.defaults("flock.scheduler.intervalClock", {
        gradeNames: ["flock.scheduler.clock"],

        members: {
            scheduled: {}
        },

        invokers: {
            schedule: {
                funcName: "flock.scheduler.intervalClock.schedule",
                args: [
                    "{arguments}.0", // The inverval to clear.
                    "{that}.scheduled",
                    "{that}.events.tick.fire",
                    "{that}.events.onClear.fire"
                ]
            },

            clear: {
                funcName: "flock.scheduler.intervalClock.clear",
                args:[
                    "{arguments}.0", // The inverval to clear.
                    "{that}.scheduled",
                    "{that}.events.onClear.fire"
                ]
            },

            clearAll: {
                funcName: "flock.scheduler.intervalClock.clearAll",
                args: ["{that}.scheduled", "{that}.events.onClear.fire"]
            },

            end: "{that}.clearAll"
        }
    });

    flock.scheduler.intervalClock.schedule = function (interval, scheduled, onTick) {
        var id = setInterval(function () {
            onTick(interval);
        }, interval);
        scheduled[interval] = id;
    };

    flock.scheduler.intervalClock.clear = function (interval, scheduled) {
        var id = scheduled[interval];
        clearInterval(id);
        delete scheduled[interval];
    };

    flock.scheduler.intervalClock.clearAll = function (scheduled, onClear) {
        for (var interval in scheduled) {
            flock.scheduler.intervalClock.clear(interval, scheduled, onClear);
        }
    };


    fluid.defaults("flock.scheduler.scheduleClock", {
        gradeNames: ["flock.scheduler.clock"],

        members: {
            scheduled: []
        },

        invokers: {
            schedule: {
                funcName: "flock.scheduler.scheduleClock.schedule",
                args: [
                    "{arguments}.0",
                    "{that}.scheduled",
                    "{that}.events"
                ]
            },

            clear: {
                funcName: "flock.scheduler.scheduleClock.clear",
                args: [
                    "{arguments}.0",
                    "{arguments}.1",
                    "{that}.scheduled",
                    "{that}.events.onClear.fire"
                ]
            },

            clearAll: {
                funcName: "flock.scheduler.scheduleClock.clearAll",
                args: [
                    "{that}.scheduled",
                    "{that}.events.onClear.fire"
                ]
            },

            end: "{that}.clearAll"
        }
    });

    flock.scheduler.scheduleClock.schedule = function (timeFromNow, scheduled, events) {
        var id;
        id = setTimeout(function () {
            clearTimeout(id);
            events.tick.fire(timeFromNow);
        }, timeFromNow);

        scheduled.push(id);
    };

    flock.scheduler.scheduleClock.clear = function (id, idx, scheduled) {
        idx = idx === undefined ? scheduled.indexOf(id) : idx;
        if (idx > -1) {
            scheduled.splice(idx, 1);
            clearTimeout(id);
        }
    };

    flock.scheduler.scheduleClock.clearAll = function (scheduled) {
        for (var i = 0; i < scheduled.length; i++) {
            var id = scheduled[i];
            clearTimeout(id);
        }

        scheduled.length = 0;
    };


    fluid.defaults("flock.scheduler.webWorkerClock", {
        gradeNames: ["fluid.component"],

        members: {
            worker: {
                expander: {
                    funcName: "flock.worker",
                    args: "@expand:fluid.getGlobalValue(flock.scheduler.webWorkerClock.workerImpl)"
                }
            }
        },

        invokers: {
            postToWorker: {
                funcName: "flock.scheduler.webWorkerClock.postToWorker",
                args: [
                    "{arguments}.0", // Message name.
                    "{arguments}.1", // Value.
                    "{that}.options.messages",
                    "{that}.worker"
                ]
            },

            schedule: "{that}.postToWorker(schedule, {arguments}.0)",

            clear: "{that}.postToWorker(clear, {arguments}.0)",

            clearAll: "{that}.postToWorker(clearAll)",

            end: "{that}.postToWorker(end)"
        },

        events: {
            tick: null
        },

        listeners: {
            onCreate: {
                funcName: "flock.scheduler.webWorkerClock.init",
                args: ["{that}"]
            },

            "onDestroy.clearAllScheduled": "{that}.clearAll",

            "onDestroy.endWorker": {
                priority: "after:clearAllScheduled",
                func: "{that}.end"
            }
        },

        startMsg: {
            msg: "start",
            value: "{that}.options.clockType"
        },

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
    });

    flock.scheduler.webWorkerClock.init = function (that) {
        that.worker.addEventListener("message", function (e) {
            that.events.tick.fire(e.data.value);
        }, false);

        that.worker.postMessage(that.options.startMsg);
    };

    flock.scheduler.webWorkerClock.postToWorker = function (msgName, value, messages, worker) {
        var msg = messages[msgName];
        if (value !== undefined) {
            msg.value = value;
        }
        worker.postMessage(msg);
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
        gradeNames: ["flock.scheduler.webWorkerClock"],
        clockType: "intervalClock"
    });

    fluid.defaults("flock.scheduler.webWorkerScheduleClock", {
        gradeNames: ["flock.scheduler.webWorkerClock"],
        clockType: "scheduleClock"
    });


    /**************
     * Schedulers *
     **************/

    fluid.defaults("flock.scheduler", {
        gradeNames: ["fluid.component"],

        events: {
            onScheduled: null,
            onFinished: null,
            onClearAll: null
        },

        listeners: {
            "onClearAll.clearClock": [
                "{that}.clock.clearAll()"
            ]
        }
    });

    flock.scheduler.addListener = function (listener, listeners, onAdded) {
        listeners.push(listener);
        onAdded(listener);

        return listener;
    };

    flock.scheduler.removeListener = function (listener, listeners, onRemoved) {
        if (!listener) {
            return;
        }

        var idx = listeners.indexOf(listener);
        if (idx > -1) {
            listeners.splice(idx, 1);
            onRemoved(listener);
        } else if (listener.wrappedListener) {
            flock.scheduler.removeListener(listener.wrappedListener, listeners, onRemoved);
        }
    };

    fluid.defaults("flock.scheduler.repeat", {
        gradeNames: ["flock.scheduler"],

        members: {
            listeners: {}
        },

        components: {
            clock: {
                type: "flock.scheduler.webWorkerIntervalClock"
            }
        },

        invokers: {
            schedule: {
                funcName: "flock.scheduler.repeat.schedule",
                args: [
                    "{arguments}.0", // The interval to schedule.
                    "{arguments}.1", // The listener.
                    "{timeConverter}",
                    "{synthContext}",
                    "{that}.listeners",
                    "{that}.events.onScheduled.fire"
                ]
            },

            clear: "{that}.events.onFinished.fire",

            clearAll: {
                funcName: "flock.scheduler.repeat.clearAll",
                args: [
                    "{that}.listeners",
                    "{that}.events.onFinished.fire",
                    "{that}.events.onClearAll.fire"
                ]
            },

            clearInterval: {
                funcName: "flock.scheduler.repeat.clearInterval",
                args: ["{arguments}.0", "{that}.listeners", "{that}.events.onFinished.fire"]
            },

            addIntervalListener: {
                funcName: "flock.scheduler.repeat.addIntervalListener",
                args: [
                    "{arguments}.0", // Interval
                    "{arguments}.1", // Listener
                    "{that}.listeners",
                    "{that}.clock.events.tick.addListener"
                ]
            },

            removeIntervalListener: {
                funcName: "flock.scheduler.repeat.removeIntervalListener",
                args: [
                    "{arguments}.0", // Interval
                    "{arguments}.1", // Listener
                    "{that}.listeners",
                    "{that}.clock.events.tick.removeListener"
                ]
            }
        },

        listeners: {
            onScheduled: [
                "{that}.addIntervalListener({arguments}.0, {arguments}.1)",
                "{that}.clock.schedule({arguments}.0)"
            ],
            onFinished: [
                "{that}.removeIntervalListener({arguments}.0, {arguments}.1)"
            ]
        }
    });

    flock.scheduler.repeat.intervalListeners = function (interval, listeners) {
        return listeners[interval];
    };

    flock.scheduler.repeat.addIntervalListener = function (interval, listener, listeners, afterAdd) {
        var listenersForInterval = flock.scheduler.repeat.intervalListeners(interval, listeners);
        flock.scheduler.addListener(listener, listenersForInterval, afterAdd);
    };

    flock.scheduler.repeat.removeIntervalListener = function (interval, listener, listeners, afterRemove) {
        var listenersForInterval = flock.scheduler.repeat.intervalListeners(interval, listeners);
        flock.scheduler.removeListener(listener, listenersForInterval, afterRemove);
    };

    flock.scheduler.repeat.schedule = function (interval, listener, timeConverter, synthContext, listeners, onScheduled) {
        interval = timeConverter.value(interval);
        listener = flock.scheduler.async.prepareListener(listener, synthContext);

        var wrapper = flock.scheduler.repeat.wrapValueListener(interval, listener);

        flock.scheduler.repeat.addInterval(interval, listeners);
        onScheduled(interval, wrapper);

        return wrapper;
    };

    flock.scheduler.repeat.wrapValueListener = function (value, listener) {
        var wrapper = function (time) {
            if (time === value) {
                listener(time);
            }
        };

        wrapper.wrappedListener = listener;

        return wrapper;
    };

    flock.scheduler.repeat.addInterval = function (interval, listeners) {
        var listenersForInterval = listeners[interval];
        if (!listenersForInterval) {
            listenersForInterval = listeners[interval] = [];
        }
    };

    flock.scheduler.repeat.clearAll = function (listeners, onFinished, onClearAll) {
        for (var interval in listeners) {
            flock.scheduler.repeat.clearInterval(interval, listeners, onFinished);
        }

        onClearAll();
    };

    flock.scheduler.repeat.clearInterval = function (interval, listeners, onFinished) {
        var listenersForInterval = listeners[interval];

        if (!listenersForInterval) {
            return;
        }

        for (var i = 0; i < listenersForInterval.length; i++) {
            var listener = listenersForInterval[i];
            onFinished(interval, listener);
        }
    };


    fluid.defaults("flock.scheduler.once", {
        gradeNames: ["flock.scheduler"],

        members: {
            listeners: []
        },

        components: {
            clock: {
                type: "flock.scheduler.webWorkerScheduleClock"
            }
        },

        invokers: {
            schedule: {
                funcName: "flock.scheduler.once.schedule",
                args: [
                    "{arguments}.0", // The scheduled time.
                    "{arguments}.1", // The listener.
                    "{timeConverter}",
                    "{synthContext}",
                    "{that}.clear",
                    "{that}.events.onScheduled.fire"
                ]
            },

            clear: "{that}.events.onFinished.fire",

            clearAll: {
                funcName: "flock.scheduler.once.clearAll",
                args: [
                    "{that}.listeners",
                    "{that}.events.onFinished.fire",
                    "{that}.events.onClearAll.fire"
                ]
            }
        },

        listeners: {
            onScheduled: [
                {
                    funcName: "flock.scheduler.addListener",
                    args: [
                        "{arguments}.1", // The listener.
                        "{that}.listeners", // All registered listeners.
                        "{that}.clock.events.tick.addListener"
                    ]
                },
                {
                    func: "{that}.clock.schedule",
                    args: ["{arguments}.0"]
                }
            ],
            onFinished: {
                funcName: "flock.scheduler.removeListener",
                args: [
                    "{arguments}.0",    // The listener.
                    "{that}.listeners", // All registered listeners.
                    "{that}.clock.events.tick.removeListener"
                ]
            }
        }
    });

    flock.scheduler.once.wrapValueListener = function (value, listener, removeFn) {
        var wrapper = function (time) {
            if (time === value) {
                listener(time);
                removeFn(wrapper);
            }
        };

        wrapper.wrappedListener = listener;

        return wrapper;
    };

    flock.scheduler.once.schedule = function (time, listener, timeConverter, synthContext, removeFn, onScheduled) {
        time = timeConverter.value(time);
        listener = flock.scheduler.async.prepareListener(listener, synthContext);

        var wrapper = flock.scheduler.once.wrapValueListener(time, listener, removeFn);
        onScheduled(time, wrapper);

        return wrapper;
    };

    flock.scheduler.once.clearAll = function (listeners, onFinished, onClearAll) {
        for (var i = 0; i < listeners.length; i++) {
            onFinished(listeners[i]);
        }

        onClearAll();
    };


    fluid.defaults("flock.scheduler.async", {
        gradeNames: ["fluid.component"],

        subSchedulerOptions: {
            components: {
                timeConverter: "{async}.timeConverter"
            },

            listeners: {
                "{async}.events.onClear": "{that}.clear()",
                "{async}.events.onClearAll": "{that}.clearAll()",
                "{async}.events.onEnd": "{that}.clock.end()"
            }
        },

        distributeOptions: {
            source: "{that}.options.subSchedulerOptions",
            removeSource: true,
            target: "{that flock.scheduler}.options"
        },

        components: {
            timeConverter: {
                type: "flock.convert.seconds"
            },

            onceScheduler: {
                type: "flock.scheduler.once"
            },

            repeatScheduler: {
                type: "flock.scheduler.repeat"
            },

            // This is user-specified.
            // Typically a flock.band instance or a synth itself,
            // but can be anything that has a set of named synths.
            synthContext: undefined
        },

        invokers: {
            /**
             * Schedules a listener to be invoked repeatedly at the specified interval.
             *
             * @param {Number} interval the interval to schedule
             * @param {Function} listener the listener to invoke
             */
            repeat: {
                func: "{repeatScheduler}.schedule",
                args: ["{arguments}.0", "{arguments}.1"]
            },

            /**
             * Schedules a listener to be invoked once at a future time.
             *
             * @param {Number} time the time (relative to now) when the listener should be invoked
             * @param {Function} listener the listener to invoke
             */
            once: {
                func: "{onceScheduler}.schedule",
                args: ["{arguments}.0", "{arguments}.1"]
            },

            /**
             * Schedules a series of "once" events.
             *
             * @param {Array} times an array of times to schedule
             * @param {Object} changeSpec the change spec that should be applied
             */
            sequence: {
                funcName: "flock.scheduler.async.sequence",
                args: [
                    "{arguments}.0", // Array of times to schedule.
                    "{arguments}.1", // The changeSpec to schedule.
                    "{that}.once"
                ]
            },

            /**
             * Schedules a score.
             *
             * @param {Array} score an array of score object
             */
            schedule: {
                funcName: "flock.scheduler.async.schedule",
                args: ["{arguments}.0", "{that}"]
            },

            /**
             * Deprecated.
             *
             * Clears a previously-registered listener.
             *
             * Note that this function is relatively ineffecient, and
             * a direct call to the clear() method of either the repeatScheduler
             * or the onceScheduler is more effective.
             *
             * @param {Function} listener the listener to clear
             */
            clear: "{that}.events.onClear.fire",

            /**
             * Clears all listeners for all scheduled and repeating events.
             */
            clearAll: "{that}.events.onClearAll.fire",

            /**
             * Clears all registered listeners and stops this scheduler's
             * clocks.
             */
            end: "{that}.events.onEnd.fire"
        },

        events: {
            onClear: null,
            onClearAll: null,
            onEnd: null
        },

        listeners: {
            onCreate: "{that}.schedule({that}.options.score)",
            onEnd: "{that}.clearAll"
        }
    });

    flock.scheduler.async.sequence = function (times, changeSpec, onceFn) {
        var listeners = [];

        for (var i = 0; i < times.length; i++) {
            var listener = onceFn(times[i], changeSpec);
            listeners.push(listener);
        }

        return listeners;
    };

    // TODO: This function is implemented suspiciously.
    flock.scheduler.async.schedule = function (schedules, that) {
        if (!schedules) {
            return;
        }

        schedules = flock.isIterable(schedules) ? schedules : [schedules];

        for (var i = 0; i < schedules.length; i++) {
            var schedule = schedules[i];
            flock.invoke(that, schedule.interval, [schedule.time, schedule.change]);
        }
    };

    flock.scheduler.async.prepareListener = function (changeSpec, synthContext) {
        return typeof changeSpec === "function" ? changeSpec :
            flock.scheduler.async.evaluateChangeSpec(changeSpec, synthContext);
    };

    flock.scheduler.async.getTargetSynth = function (changeSpec, synthContext) {
        var synthPath = changeSpec.synth;
        return !synthPath ?
            synthContext : typeof synthPath !== "string" ?
            synthPath : fluid.get(synthContext, synthPath);
    };

    flock.scheduler.async.makeSynthUpdater = function (synths, changeSpec, staticChanges, synthContext) {
        return function () {
            for (var path in synths) {
                var synth = synths[path];
                staticChanges[path] = flock.evaluate.synthValue(synth);
            }

            var targetSynth = flock.scheduler.async.getTargetSynth(changeSpec, synthContext);

            if (!targetSynth) {
                flock.fail("A target synth named " + changeSpec.synth +
                    " could not be found in the specified synthContext. Synth context was: " + synthContext);
            } else {
                targetSynth.set(staticChanges);
            }
        };
    };

    flock.scheduler.async.evaluateChangeSpec = function (changeSpec, synthContext) {
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

        return flock.scheduler.async.makeSynthUpdater(synths, changeSpec, staticChanges, synthContext);
    };

    fluid.defaults("flock.scheduler.async.tempo", {
        gradeNames: ["flock.scheduler.async"],

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

    fluid.defaults("flock.convert.ms", {
        gradeNames: ["fluid.component"],

        invokers: {
            value: "fluid.identity({arguments}.0)"
        }
    });


    fluid.defaults("flock.convert.seconds", {
        gradeNames: ["fluid.component"],

        invokers: {
            value: "flock.convert.seconds.toMillis({arguments}.0)"
        }
    });

    flock.convert.seconds.toMillis = function (secs) {
        return secs * 1000;
    };


    fluid.defaults("flock.convert.beats", {
        gradeNames: ["fluid.component"],

        bpm: 60,

        invokers: {
            value: "flock.convert.beats.toMillis({arguments}.0, {that}.options.bpm)"
        }
    });

    flock.convert.beats.toMillis = function (beats, bpm) {
        return bpm <= 0 ? 0 : (beats / bpm) * 60000;
    };

}());
