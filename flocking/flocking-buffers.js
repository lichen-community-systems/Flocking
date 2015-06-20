/*
* Flocking Audio Buffers
* http://github.com/colinbdclark/flocking
*
* Copyright 2013-14, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global require, AudioBuffer*/
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

    // Based on Brian Cavalier and John Hann's Tiny Promises library.
    // https://github.com/unscriptable/promises/blob/master/src/Tiny2.js
    function Promise() {
        var resolve = function (result) {
            complete("resolve", result);
            promise.state = "fulfilled";
        };

        var reject = function (err) {
            complete("reject", err);
            promise.state = "rejected";
        };

        var then = function (resolve, reject) {
            if (callbacks) {
                callbacks.push({
                    resolve: resolve,
                    reject: reject
                });
            } else {
                var fn = promise.state === "fulfilled" ? resolve : reject;
                fn(promise.value);
            }

            return this;
        };

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
            var rejector = function (resolve, reject) {
                reject(result);
                return this;
            };

            var resolver = function (resolve) {
                resolve(result);
                return this;
            };

            promise.value = result;
            promise.then = type === "reject" ? rejector : resolver;
            promise.resolve = promise.reject = function () {
                throw new Error("Promise already completed");
            };

            invokeCallbacks(type, result);
        }

        function invokeCallbacks (type, result) {
            var i,
                cb;

            for (i = 0; i < callbacks.length; i++) {
                cb = callbacks[i];

                if (cb[type]) {
                    cb[type](result);
                }
            }

            callbacks = null;
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

    // TODO: This is actually part of the interpreter's expansion process
    // and should be clearly named as such.
    flock.bufferDesc = function (data) {
        var fn = flock.platform.isWebAudio && data instanceof AudioBuffer ?
            flock.bufferDesc.fromAudioBuffer : flock.isIterable(data) ?
            flock.bufferDesc.fromChannelArray : flock.bufferDesc.expand;

        return fn(data);
    };

    flock.bufferDesc.inferFormat = function (bufDesc) {
        var format = bufDesc.format,
            data = bufDesc.data;

        format.sampleRate = format.sampleRate || 44100;
        format.numSampleFrames = format.numSampleFrames || data.channels[0].length;
        format.duration = format.numSampleFrames / format.sampleRate;

        return bufDesc;
    };

    flock.bufferDesc.fromChannelArray = function (arr, sampleRate) {
        var bufDesc = {
            container: {},

            format: {
                numChannels: 1,
                sampleRate: sampleRate
            },

            data: {
                channels: [arr]
            }
        };

        return flock.bufferDesc.inferFormat(bufDesc);
    };

    flock.bufferDesc.expand = function (bufDesc) {
        bufDesc.container = bufDesc.container || {};
        bufDesc.format = bufDesc.format || {};

        bufDesc.format.numChannels = bufDesc.format.numChannels || bufDesc.data.channels.length;

        if (bufDesc.data && bufDesc.data.channels) {
            // Special case for an unwrapped single-channel array.
            if (bufDesc.format.numChannels === 1 && bufDesc.data.channels.length !== 1) {
                bufDesc.data.channels = [bufDesc.data.channels];
            }

            if (bufDesc.format.numChannels !== bufDesc.data.channels.length) {
                throw new Error("The specified number of channels does not match " +
                    "the actual channel data. " +
                    "numChannels was: " + bufDesc.format.numChannels +
                    " but the sample data contains " + bufDesc.data.channels.length + " channels.");
            }
        }

        return flock.bufferDesc.inferFormat(bufDesc);
    };

    flock.bufferDesc.fromAudioBuffer = function (audioBuffer) {
        var desc = {
            container: {},
            format: {
                sampleRate: audioBuffer.sampleRate,
                numChannels: audioBuffer.numberOfChannels,
                numSampleFrames: audioBuffer.length,
                duration: audioBuffer.duration
            },
            data: {
                channels: []
            }
        },
        i;

        for (i = 0; i < audioBuffer.numberOfChannels; i++) {
            desc.data.channels.push(audioBuffer.getChannelData(i));
        }

        return desc;
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
        var state = that.model.state;
        if (state === "start" || state === "in-progress") {
            that.bufferPromise.promise.resolve(bufDesc);
        }

        return that.bufferPromise.promise;
    };

    flock.bufferSource.error = function (that, msg) {
        that.bufferPromise.promise.reject(msg);

        return that.bufferPromise.promise;
    };

    /**
     * A Buffer Loader is responsible for loading a collection
     * of buffers asynchronously, and will fire an event when they
     * are all ready.
     */
    fluid.defaults("flock.bufferLoader", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        members: {
            buffers: []
        },

        // A list of BufferDef objects to resolve.
        bufferDefs: [],

        events: {
            afterBuffersLoaded: null
        },

        listeners: {
            onCreate: {
                funcName: "flock.bufferLoader.loadBuffers",
                args: ["{that}.options.bufferDefs", "{that}.buffers", "{that}.events.afterBuffersLoaded.fire"]
            }
        }
    });

    flock.bufferLoader.idFromURL = function (url) {
        var lastSlash = url.lastIndexOf("/"),
            idStart = lastSlash > -1 ? lastSlash + 1 : 0,
            ext = url.lastIndexOf("."),
            idEnd = ext > -1 ? ext : url.length;

        return url.substring(idStart, idEnd);
    };

    flock.bufferLoader.idsFromURLs = function (urls) {
        return fluid.transform(urls, flock.bufferLoader.idFromURL);
    };

    flock.bufferLoader.expandFileSequence = function (fileURLs) {
        fileURLs = fileURLs || [];

        var bufDefs = [],
            i,
            url,
            id;

        for (i = 0; i < fileURLs.length; i++) {
            url = fileURLs[i];
            id = flock.bufferLoader.idFromURL(url);
            bufDefs.push({
                id: id,
                url: url
            });
        }

        return bufDefs;
    };

    flock.bufferLoader.loadBuffers = function (bufferDefs, decodedBuffers, afterBuffersLoaded) {
        bufferDefs = fluid.makeArray(bufferDefs);

        // TODO: This is a sign that flock.parse.bufferForDef is still terribly broken.
        var bufferTarget = {
            setBuffer: function (decoded) {
                decodedBuffers.push(decoded);

                if (decodedBuffers.length === bufferDefs.length) {
                    afterBuffersLoaded(decodedBuffers);
                }
            }
        };

        for (var i = 0; i < bufferDefs.length; i++) {
            var bufDef = bufferDefs[i];
            if (bufDef.id === undefined && bufDef.url !== undefined) {
                bufDef.id = flock.bufferLoader.idFromURL(bufDef.url);
            }

            // TODO: Hardcoded reference to the shared environment.
            flock.parse.bufferForDef(bufferDefs[i], bufferTarget, flock.enviro.shared);
        }
    };

}());
