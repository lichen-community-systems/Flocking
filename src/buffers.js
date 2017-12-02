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
        /* jshint ignore:start */
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
        /* jshint ignore:end */
    }

    fluid.defaults("flock.promise", {
        gradeNames: ["fluid.component"],

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
    flock.bufferDesc = function (data, sampleRate, numChannels) {
        var fn = flock.platform.isWebAudio && data instanceof AudioBuffer ?
            flock.bufferDesc.fromAudioBuffer : flock.isIterable(data) ?
            flock.bufferDesc.fromChannelArray : flock.bufferDesc.expand;

        return fn(data, sampleRate, numChannels);
    };

    flock.bufferDesc.inferFormat = function (bufDesc, sampleRate, numChannels) {
        var format = bufDesc.format,
            data = bufDesc.data;

        format.sampleRate = sampleRate || format.sampleRate || 44100;
        format.numChannels = numChannels || format.numChannels || bufDesc.data.channels.length;
        format.numSampleFrames = format.numSampleFrames ||
            data.channels.length > 0 ? data.channels[0].length : 0;
        format.duration = format.numSampleFrames / format.sampleRate;

        return bufDesc;
    };

    flock.bufferDesc.fromChannelArray = function (arr, sampleRate, numChannels) {
        if (arr instanceof Float32Array) {
            arr = [arr];
        }

        var bufDesc = {
            container: {},

            format: {
                numChannels: numChannels,
                sampleRate: sampleRate,
                numSampleFrames: arr[0].length
            },

            data: {
                channels: arr
            }
        };

        return flock.bufferDesc.inferFormat(bufDesc, sampleRate, numChannels);
    };

    flock.bufferDesc.expand = function (bufDesc, sampleRate, numChannels) {
        bufDesc = bufDesc || {
            data: {
                channels: []
            }
        };

        bufDesc.container = bufDesc.container || {};
        bufDesc.format = bufDesc.format || {};
        bufDesc.format.numChannels = numChannels ||
            bufDesc.format.numChannels || bufDesc.data.channels.length; // TODO: Duplication with inferFormat.

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

        return flock.bufferDesc.inferFormat(bufDesc, sampleRate, numChannels);
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

    flock.bufferDesc.toAudioBuffer = function (context, bufDesc) {
        var buffer = context.createBuffer(bufDesc.format.numChannels,
            bufDesc.format.numSampleFrames, bufDesc.format.sampleRate);

        for (var i = 0; i < bufDesc.format.numChannels; i++) {
            buffer.copyToChannel(bufDesc.data.channels[i], i);
        }

        return buffer;
    };

    /**
     * Represents a source for fetching buffers.
     */
    fluid.defaults("flock.bufferSource", {
        gradeNames: ["fluid.modelComponent"],

        sampleRate: "{enviro}.audioSystem.model.sampleRate",

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
                changePath: "state",
                value: "start"
            },

            onFetch: {
                changePath: "state",
                value: "in-progress"
            },

            afterFetch: [
                {
                    changePath: "state",
                    value: "fetched"
                },
                {
                    funcName: "{that}.events.onBufferUpdated.fire", // TODO: Replace with boiling?
                    args: ["{arguments}.0"]
                }
            ],

            onBufferUpdated: "{enviro}.registerBuffer({arguments}.0)",

            onError: {
                changePath: "state",
                value: "error"
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
                    sampleRate: that.options.sampleRate,
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
        gradeNames: ["fluid.component"],

        // A list of BufferDef objects to resolve.
        bufferDefs: [],

        members: {
            buffers: [],
            bufferDefs: "@expand:flock.bufferLoader.expandBufferDefs({that}.options.bufferDefs)"
        },

        components: {
            enviro: "{flock.enviro}"
        },

        events: {
            afterBuffersLoaded: null,
            onError: null
        },

        listeners: {
            "onCreate.loadBuffers": {
                funcName: "flock.bufferLoader.loadBuffers",
                args: ["{that}"]
            },

            "onError.logError": {
                funcName: "flock.log.fail"
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

    // TODO: Resolve this with the expansion logic in the interpeter.
    // This operates similar but conflicting logic; strings are expanded as URLs
    // instead of IDs.
    flock.bufferLoader.expandBufferDef = function (bufDef) {
        if (typeof bufDef === "string") {
            bufDef = {
                url: bufDef
            };
        }

        if (bufDef.id === undefined && bufDef.url !== undefined) {
            bufDef.id = flock.bufferLoader.idFromURL(bufDef.url);
        }

        return bufDef;
    };

    flock.bufferLoader.expandBufferDefs = function (bufferDefs) {
        if (!bufferDefs) {
            return [];
        }

        bufferDefs = fluid.makeArray(bufferDefs);
        return fluid.transform(bufferDefs, flock.bufferLoader.expandBufferDef);
    };

    flock.bufferLoader.loadBuffer = function (bufDef, bufferTarget, that) {
        try {
            flock.parse.bufferForDef(bufDef, bufferTarget, that.enviro);
        } catch (e) {
            that.events.onError.fire(e.message);
        }
    };

    flock.bufferLoader.loadBuffers = function (that) {
        var bufferDefIdx = 1;

        // TODO: This is a sign that flock.parse.bufferForDef is still terribly broken.
        var bufferTarget = {
            setBuffer: function (decoded) {
                that.buffers.push(decoded);

                // TODO: This is not robust and provides no means for error notification!
                if (that.buffers.length === that.options.bufferDefs.length) {
                    that.events.afterBuffersLoaded.fire(that.buffers);
                } else if (bufferDefIdx < that.bufferDefs.length){
                    var nextBufferDef = that.bufferDefs[bufferDefIdx];
                    flock.bufferLoader.loadBuffer(nextBufferDef, bufferTarget, that);
                    bufferDefIdx++;
                }
            }
        };

        flock.bufferLoader.loadBuffer(that.bufferDefs[0], bufferTarget, that);
    };

}());
