/*
* Flocking WebAudio Strategy
* http://github.com/colinbdclark/flocking
*
* Copyright 2013-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global require, MediaStreamTrack, jQuery*/
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

    fluid.registerNamespace("flock.webAudio");

    // TODO: Remove this when Chrome implements navigator.getMediaDevices().
    var getSources = function (callback) {
        return MediaStreamTrack.getSources(function (infoSpecs) {
            var normalized = fluid.transform(infoSpecs, function (infoSpec) {
                infoSpec.deviceId = infoSpec.id;
                return infoSpec;
            });

            callback(normalized);
        });
    };

    // TODO: Implement these in a way that doesn't require checking every time.
    var webAudioShims = {
        AudioContext: window.AudioContext || window.webkitAudioContext,

        getUserMedia: function (options, success, error) {
            var gumFn = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia || navigator.msGetUserMedia;

            return gumFn.call(navigator, options, success, error);
        },

        getMediaDevices: function (callback) {
            return navigator.getMediaDevices ? navigator.getMediaDevices(callback) :
                MediaStreamTrack.getSources ? getSources(callback) : undefined;
        }
    };
    jQuery.extend(flock.shim, webAudioShims);


    /**
     * Web Audio API Audio Strategy
     */
    fluid.defaults("flock.webAudio.strategy", {
        gradeNames: ["flock.enviro.audioStrategy", "autoInit"],

        members: {
            context: "{contextWrapper}.context",
            preNodes: [],
            jsNode: {
                expander: {
                    funcName: "flock.webAudio.strategy.createScriptProcessor",
                    args: [
                        "{contextWrapper}.context",
                        "{that}.options.audioSettings"
                    ]
                }
            }
        },

        model: {
            isGenerating: false,
            shouldInitIOS: flock.platform.isIOS,
            krPeriods: {
                expander: {
                    funcName: "flock.webAudio.strategy.calcNumKrPeriods",
                    args: "{that}.options.audioSettings"
                }
            }
        },

        invokers: {
            start: {
                func: "{that}.events.onStart.fire"
            },

            stop: {
                func: "{that}.events.onStop.fire"
            },

            reset: {
                func: "{that}.events.onReset.fire"
            },

            // Deprecated. Use start() instead.
            startGeneratingSamples: {
                func: "{that}.events.onStart.fire"
            },

            // Deprecated. Use stop() instead.
            stopGeneratingSamples: {
                func: "{that}.events.onStop.fire"
            }
        },

        components: {
            contextWrapper: {
                type: "flock.webAudio.contextWrapper"
            },

            nativeNodeManager: {
                type: "flock.webAudio.nativeNodeManager",
                options: {
                    members: {
                        context: "{contextWrapper}.context",
                        jsNode: "{strategy}.jsNode"
                    },

                    audioSettings: "{strategy}.options.audioSettings"
                }
            },

            deviceManager: {
                type: "flock.webAudio.deviceManager",
                options: {
                    members: {
                        context: "{contextWrapper}.context"
                    },

                    listeners: {
                        onMediaStreamOpened: {
                            func: "{nativeNodeManager}.insertInput",
                            args: ["{arguments}.0"]
                        }
                    }
                }
            }
        },

        events: {
            onStart: null,
            onStop: null,
            onReset: null
        },

        listeners: {
            onCreate: [
                {
                    funcName: "flock.webAudio.strategy.setSampleRate",
                    args: ["{that}.options.audioSettings", "{contextWrapper}.context.sampleRate"]
                },
                {
                    funcName: "flock.webAudio.strategy.bindSampleWriter",
                    args: ["{that}.jsNode", "{that}.writeSamples"]
                }
            ],

            onStart: [
                {
                    func: "{that}.applier.change",
                    args: ["isGenerating", true]
                },
                {
                    // TODO: Replace this with some progressive enhancement action.
                    funcName: "flock.webAudio.strategy.iOSStart",
                    args: ["{that}.model", "{that}.applier", "{contextWrapper}.context", "{that}.jsNode"]
                },
                {
                    func: "{nativeNodeManager}.connect"
                }
            ],

            onStop: [
                {
                    func: "{that}.applier.change",
                    args: ["isGenerating", false]
                },
                {
                    func: "{nativeNodeManager}.disconnect"
                }
            ],

            onReset: [
                {
                    func: "{that}.stop"
                },
                {
                    func: "{nativeNodeManager}.removeAllInputs"
                },
                {
                    func: "{that}.applier.change",
                    args: ["playState.written", 0]
                }
            ]
        }
    });

    // TODO: This is shady. Does it even work?
    // TODO: Refactor into a shared environment-level model property.
    flock.webAudio.strategy.setSampleRate = function (audioSettings, sampleRate) {
        audioSettings.sampleRate = sampleRate;
    };

    flock.webAudio.strategy.calcNumKrPeriods = function (s) {
        return s.bufferSize / s.blockSize;
    };

    flock.webAudio.strategy.createScriptProcessor = function (ctx, s) {
        var jsNodeName = ctx.createScriptProcessor ? "createScriptProcessor" : "createJavaScriptNode",
            jsNode = ctx[jsNodeName](s.bufferSize, s.numInputBuses, s.chans);

        return jsNode;
    };

    flock.webAudio.strategy.bindSampleWriter = function (jsNode, sampleWriter) {
        jsNode.onaudioprocess = sampleWriter;
    };

    // TODO: Split this out into a separate object.
    flock.webAudio.strategy.finalInit = function (that) {
        var m = that.model,
            inputNodes = that.nativeNodeManager.inputNodes,
            evaluator = that.nodeEvaluator,
            s = that.options.audioSettings,
            stop = that.stop;

        that.writeSamples = function (e) {
            var inBufs = e.inputBuffer,
                outBufs = e.outputBuffer,
                numInputNodes = inputNodes.length,
                krPeriods = m.krPeriods,
                playState = m.playState,
                buses = evaluator.buses,
                blockSize = s.blockSize,
                chans = s.chans,
                inChans = inBufs.numberOfChannels,
                chan,
                i,
                samp;

            // If there are no nodes providing samples, write out silence.
            if (evaluator.nodes.length < 1) {
                for (chan = 0; chan < chans; chan++) {
                    flock.generate.silence(outBufs.getChannelData(chan));
                }
                return;
            }

            // TODO: Make a formal distinction between input buses,
            // output buses, and interconnect buses in the environment!
            for (i = 0; i < krPeriods; i++) {
                var offset = i * blockSize;

                evaluator.clearBuses();

                // Read this ScriptProcessorNode's input buffers
                // into the environment.
                if (numInputNodes > 0) {
                    for (chan = 0; chan < inChans; chan++) {
                        var inBuf = inBufs.getChannelData(chan),
                            inBusNumber = chans + chan, // Input buses are located after output buses.
                            targetBuf = buses[inBusNumber];

                        for (samp = 0; samp < blockSize; samp++) {
                            targetBuf[samp] = inBuf[samp + offset];
                        }
                    }
                }

                evaluator.gen();

                // Output the environment's signal
                // to this ScriptProcessorNode's output channels.
                for (chan = 0; chan < chans; chan++) {
                    var sourceBuf = buses[chan],
                        outBuf = outBufs.getChannelData(chan);

                    // And output each sample.
                    for (samp = 0; samp < blockSize; samp++) {
                        outBuf[samp + offset] = sourceBuf[samp];
                    }
                }
            }

            playState.written += s.bufferSize * chans;
            if (playState.written >= playState.total) {
                stop();
            }
        };
    };

    flock.webAudio.strategy.iOSStart = function (model, applier, ctx, jsNode) {
        // Work around a bug in iOS Safari where it now requires a noteOn()
        // message to be invoked before sound will work at all. Just connecting a
        // ScriptProcessorNode inside a user event handler isn't sufficient.
        if (model.shouldInitIOS) {
            var s = ctx.createBufferSource();
            s.connect(jsNode);
            s.start(0);
            s.stop(0);
            s.disconnect(0);
            applier.change("shouldInitIOS", false);
        }
    };


    /**
     * An Infusion component wrapper for a Web Audio API AudioContext instance.
     */
    fluid.defaults("flock.webAudio.contextWrapper", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        members: {
            context: {
                expander: {
                    funcName: "flock.webAudio.contextWrapper.create"
                }
            }
        },

        listeners: {
            onCreate: {
                funcName: "flock.webAudio.contextWrapper.register",
                args: ["{that}"]
            }
        }
    });

    flock.webAudio.contextWrapper.create = function () {
        return new flock.shim.AudioContext();
    };

    flock.webAudio.contextWrapper.register = function (that) {
        fluid.staticEnvironment.webAudioContext = that;
    };

    /**
     * Manages a collection of input nodes and an output node,
     * with a JS node in between.
     *
     * Note: this component is slated for removal when Web Audio
     * "islands" are implemented.
     */
    fluid.defaults("flock.webAudio.nativeNodeManager", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        members: {
            context: undefined,
            jsNode: undefined,
            outputNode: undefined,
            inputNodes: [],
            merger: {
                expander: {
                    funcName: "flock.webAudio.nativeNodeManager.createMerger",
                    args: [
                        "{contextWrapper}.context",
                        "{that}.options.audioSettings.numInputBuses",
                        "{that}.jsNode"
                    ]
                }
            }
        },

        invokers: {
            connect: {
                funcName: "flock.webAudio.nativeNodeManager.connect",
                args: ["{that}.merger", "{that}.jsNode", "{that}.outputNode", "{that}.context.destination"]
            },

            disconnect: {
                funcName: "flock.webAudio.nativeNodeManager.disconnect",
                args: ["{that}.merger", "{that}.jsNode", "{that}.outputNode"]
            },

            insertInput: {
                funcName: "flock.webAudio.nativeNodeManager.insertInput",
                args: ["{arguments}.0", "{that}.inputNodes", "{that}.merger"]
            },

            removeInput: {
                funcName: "flock.webAudio.nativeNodeManager.removeInput",
                args: ["{arguments}.0", "{that}.inputNodes"]
            },

            removeAllInputs: {
                funcName: "flock.webAudio.nativeNodeManager.removeAllInputs",
                args: "{that}.inputNodes"
            },

            insertOutput: {
                funcName: "flock.webAudio.nativeNodeManager.insertOutput",
                args: ["{that}", "{arguments}.0"]
            },

            removeOutput: {
                funcName: "flock.webAudio.nativeNodeManager.removeOutput",
                args: ["{that}.jsNode"]
            }
        },

        listeners: {
            onCreate: {
                func: "{that}.insertOutput",
                args: "{that}.jsNode"
            }
        }
    });

    flock.webAudio.nativeNodeManager.createMerger = function (ctx, numInputBuses, jsNode) {
        var merger = ctx.createChannelMerger(numInputBuses);
        merger.connect(jsNode);

        return merger;
    };

    flock.webAudio.nativeNodeManager.connect = function (merger, jsNode, outputNode, destination) {
        merger.connect(jsNode);
        outputNode.connect(destination);
        if (jsNode !== outputNode) {
            jsNode.connect(outputNode);
        }
    };

    flock.webAudio.nativeNodeManager.disconnect = function (merger, jsNode, outputNode) {
        merger.disconnect(0);
        jsNode.disconnect(0);
        outputNode.disconnect(0);
    };

    flock.webAudio.nativeNodeManager.removeAllInputs = function (inputNodes) {
        for (var i = 0; i < inputNodes.length; i++) {
            var node = inputNodes[i];
            node.disconnect(0);
        }
        inputNodes.length = 0;
    };

    flock.webAudio.nativeNodeManager.insertInput = function (node, inputNodes, merger) {
        inputNodes.push(node);
        node.connect(merger, 0, inputNodes.indexOf(node));
    };

    flock.webAudio.nativeNodeManager.removeInput = function (node, inputNodes) {
        var idx = inputNodes.indexOf(node);
        if (idx > -1) {
            inputNodes.splice(idx, 1);
        }

        node.disconnect(0);
    };

    flock.webAudio.nativeNodeManager.insertOutput = function (that, node) {
        if (that.outputNode) {
            that.outputNode.disconnect(0);
        }

        that.outputNode = node;
    };

    flock.webAudio.nativeNodeManager.removeOutput = function (jsNode) {
        // Replace the current output node with the jsNode.
        flock.webAudio.nativeNodeManager.insertOutput(jsNode);
    };


    /**
     * Manages audio input devices using the Web Audio API.
     */
    // Add a means for disconnecting audio input nodes.
    fluid.defaults("flock.webAudio.deviceManager", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        members: {
            context: null
        },

        invokers: {
            /**
             * Opens the specified audio device.
             * If no device is specified, the default device is opened.
             *
             * @param {Object} deviceSpec a device spec containing, optionally, an 'id' or 'label' parameter
             */
            openAudioDevice: {
                funcName: "flock.webAudio.deviceManager.openAudioDevice",
                args: [
                    "{arguments}.0",
                    "{that}.openAudioDeviceWithId",
                    "{that}.openFirstAudioDeviceWithLabel",
                    "{that}.openAudioDeviceWithConstraints"
                ]
            },

            /**
             * Opens an audio device with the specified WebRTC constraints.
             * If no constraints are specified, the default audio device is opened.
             *
             * @param {Object} constraints a WebRTC-compatible constraints object
             */
            openAudioDeviceWithConstraints: {
                funcName: "flock.webAudio.deviceManager.openAudioDeviceWithConstraints",
                args: ["{arguments}.0", "{that}.context", "{that}.events.onMediaStreamOpened.fire"]
            },

            /**
             * Opens an audio device with the specified WebRTC device id.
             *
             * @param {string} id a device identifier
             */
            openAudioDeviceWithId: {
                funcName: "flock.webAudio.deviceManager.openAudioDeviceWithId",
                args: ["{arguments}.0", "{that}.openAudioDeviceWithConstraints"]
            },

            /**
             * Opens the first audio device found with the specified label.
             * The label must be an exact, case-insensitive match.
             *
             * @param {string} label a device label
             */
            openFirstAudioDeviceWithLabel: {
                funcName: "flock.webAudio.deviceManager.openFirstAudioDeviceWithLabel",
                args: ["{arguments}.0", "{that}.openAudioDeviceWithId"]
            }
        },

        events: {
            /**
             * Fires whenever a new media stream has been opened up.
             *
             * @param {MediaStreamSourceNode} node the MediaStreamSourceNode created from the open stream
             */
            onMediaStreamOpened: null
        }
    });


    flock.webAudio.deviceManager.openAudioDevice = function (sourceSpec, idOpener, labelOpener, specOpener) {
        if (sourceSpec) {
            if (sourceSpec.id) {
                return idOpener(sourceSpec.id);
            } else if (sourceSpec.label) {
                return labelOpener(sourceSpec.label);
            }
        }

        return specOpener();
    };

    flock.webAudio.deviceManager.openAudioDeviceWithId = function (id, deviceOpener) {
        var options = {
            audio: {
                optional: [
                    {
                        sourceId: id
                    }
                ]
            }
        };

        deviceOpener(options);
    };

    flock.webAudio.deviceManager.openFirstAudioDeviceWithLabel = function (label, deviceOpener) {
        if (!label) {
            return;
        }

        // TODO: Can't access device labels until the user agrees
        // to allow access to the current device.
        flock.shim.getMediaDevices(function (deviceInfoSpecs) {
            var matches = deviceInfoSpecs.filter(function (device) {
                if (device.label.toLowerCase() === label.toLowerCase()) {
                    return true;
                }
            });

            if (matches.length > 0) {
                deviceOpener(matches[0].deviceId);
            } else {
                fluid.log(fluid.logLevel.IMPORTANT,
                    "An audio device named '" + label + "' could not be found.");
            }
        });
    };

    flock.webAudio.deviceManager.openAudioDeviceWithConstraints = function (options, context, onMediaStreamOpened) {
        options = options || {
            audio: true
        };

        function callback (mediaStream) {
            flock.webAudio.deviceManager.nodeForStream(context, mediaStream, onMediaStreamOpened);
        }

        function errback (err) {
            fluid.log(fluid.logLevel.IMPORTANT,
                "An error occurred while trying to access the user's microphone. " +
                err);
        }

        flock.shim.getUserMedia(options, callback, errback);
    };

    flock.webAudio.deviceManager.nodeForStream = function (context, mediaStream, onMediaStreamOpened) {
        var mic = context.createMediaStreamSource(mediaStream);
        onMediaStreamOpened(mic);
    };

    fluid.demands("flock.enviro.audioStrategy", "flock.platform.webAudio", {
        funcName: "flock.webAudio.strategy"
    });

}());
