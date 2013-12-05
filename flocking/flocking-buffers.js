/*
* Flocking Buffer
* http://github.com/colinbdclark/flocking
*
* Copyright 2013, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Float32Array*/
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");
    
(function () {
    "use strict";
    
    // Brian Cavalier and John Hann's Tiny Promises library.
    // https://github.com/unscriptable/promises/blob/master/src/Tiny2.js
    function Promise() {
        "use strict";
        
        var callbacks = [],
            promise = {
                state: "pending",
                value: undefined,
                resolve: resolve,
                reject: reject,
                then: then,
                safe: {
                    then: function safeThen(resolve, reject) {
                        promise.then(resolve, reject);
                        return this;
                    }
                }
            };
        
        function complete(type, result) {
            promise.value = result;
            
            promise.then = type === 'reject'
                ? function(resolve, reject) { reject(result); return this; }
                : function(resolve)         { resolve(result); return this; };
            
            promise.resolve = promise.reject = function() { throw new Error("Promise already completed"); };
            
            var i = 0, cb;
            while(cb = callbacks[i++]) { cb[type] && cb[type](result); }
            
            callbacks = null;
        }
        
        function resolve(result) {
            complete('resolve', result);
            promise.state = "fulfilled";
        }
        function reject(err) {
            complete('reject', err);
            promise.state = "rejected";
        }
        function then(resolve, reject) {
            if (callbacks) {
                callbacks.push({ resolve: resolve, reject: reject });
            } else {
                var fn = promise.state === "fulfilled" ? resolve : reject;
                fn(promise.value);
            }

            return this;
        }

        return promise;
    }
    
    fluid.defaults("flock.promise", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        
        members: {
            promise: {
                expander: {
                    funcName: "flock.promise.make"
                }
            }
        }
    });
    
    flock.promise.make = function () {
        return new Promise();
    };
    
    flock.bufferDesc = function (data) {
        data.container = data.container || {};
        data.format = data.format || {};

        data.format.sampleRate = data.format.sampleRate || 44100;
        data.format.numChannels = data.format.numChannels || data.data.channels.length;
        data.format.numSampleFrames = data.format.numSampleFrames || data.data.channels[0].length;
        data.format.duration = data.format.numSampleFrames / data.format.sampleRate;
        
        return data;
    };

    /**
     * Represents a source for fetching buffers.
     */
    fluid.defaults("flock.bufferSource", {
        gradeNames: ["fluid.eventedComponent", "fluid.modelComponent", "autoInit"],
        
        model: {
            state: "start",
            src: null
        },
        
        components: {
            bufferPromise: {
                createOnEvent: "onRefreshPromise",
                type: "flock.promise",
                options: {
                    listeners: {
                        onCreate: {
                            "this": "{that}.promise",
                            method: "then",
                            args: ["{bufferSource}.events.afterFetch.fire", "{bufferSource}.events.onError.fire"]
                        }
                    }
                }
            }
        },
        
        invokers: {
            get: {
                funcName: "flock.bufferSource.get",
                args: ["{that}", "{arguments}.0"]
            },
            
            set: {
                funcName: "flock.bufferSource.set",
                args: ["{that}", "{arguments}.0"]
            },
            
            error: {
                funcName: "flock.bufferSource.error",
                args: ["{that}", "{arguments}.0"]
            }
        },
        
        listeners: {
            onCreate: {
                funcName: "{that}.events.onRefreshPromise.fire"
            },
            
            onRefreshPromise: {
                funcName: "{that}.applier.requestChange",
                args: ["state", "start"]
            },
            
            onFetch: {
                funcName: "{that}.applier.requestChange",
                args: ["state", "in-progress"]
            },
            
            afterFetch: [
                {
                    funcName: "{that}.applier.requestChange",
                    args: ["state", "fetched"]
                },
                {
                    funcName: "{that}.events.onBufferUpdated.fire", // TODO: Replace with boiling?
                    args: ["{arguments}.0"]
                }
            ],
            
            onBufferUpdated: {
                // TODO: Hardcoded reference to shared environment.
                funcName: "flock.enviro.shared.registerBuffer",
                args: ["{arguments}.0"]
            },
            
            onError: {
                funcName: "{that}.applier.requestChange",
                args: ["state", "error"]
            }
        },
        
        events: {
            onRefreshPromise: null,
            onError: null,
            onFetch: null,
            afterFetch: null,
            onBufferUpdated: null
        }
    });
    
    flock.bufferSource.get = function (that, bufDef) {
        if (that.model.state === "in-progress" || (bufDef.src === that.model.src && !bufDef.replace)) {
            // We've already fetched the buffer or are in the process of doing so.
            return that.bufferPromise.promise;
        }

        if (bufDef.src) {
            if ((that.model.state === "fetched" || that.model.state === "errored") && 
                (that.model.src !== bufDef.src || bufDef.replace)) {
                that.events.onRefreshPromise.fire();
            }
            
            if (that.model.state === "start") {
                that.model.src = bufDef.src;
                that.events.onFetch.fire(bufDef);
                flock.audio.decode({
                    src: bufDef.src,
                    success: function (bufDesc) {
                        if (bufDef.id) {
                            bufDesc.id = bufDef.id;
                        }
                        
                        that.set(bufDesc);
                    },
                    error: that.error
                });
            }
        }
                
        return that.bufferPromise.promise;
    };
    
    flock.bufferSource.set = function (that, bufDesc) {
        var state = that.model.state
        if (state === "start" || state === "in-progress") {
            that.bufferPromise.promise.resolve(bufDesc);
        }
        
        return that.bufferPromise.promise;
    };
    
    flock.bufferSource.error = function (that, msg) {
        that.bufferPromise.promise.reject(msg);
        
        return that.bufferPromise.promise;
    };

}());
