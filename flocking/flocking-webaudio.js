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

    flock.webAudio.createNode = function (context, type, args, params) {
        // Second argument is a NodeSpec object.
        if (typeof type !== "string") {
            args = type.args;
            params = type.params;
            type = type.node;
        }

        args = args === undefined || args === null ? [] :
            fluid.isArrayable(args) ? args : [args];

        var creatorName = "create" + type,
            nodeStrIdx = creatorName.indexOf("Node");

        // Trim off "Node" if it is present.
        if (nodeStrIdx > -1) {
            creatorName = creatorName.substring(0, nodeStrIdx);
        }

        var node = context[creatorName].apply(context, args);
        flock.webAudio.initializeNodeInputs(node, params);

        return node;
    };

    // TODO: Add support for other types of AudioParams.
    flock.webAudio.initializeNodeInputs = function (node, paramSpec) {
        if (!node || !paramSpec) {
            return;
        }

        for (var inputName in paramSpec) {
            node[inputName].value = paramSpec[inputName];
        }

        return node;
    };


    // TODO: Remove this when Chrome implements navigator.getMediaDevices().
    fluid.registerNamespace("flock.webAudio.chrome");

    flock.webAudio.chrome.getSources = function (callback) {
        return MediaStreamTrack.getSources(function (infoSpecs) {
            var normalized = fluid.transform(infoSpecs, function (infoSpec) {
                infoSpec.deviceId = infoSpec.id;
                return infoSpec;
            });

            callback(normalized);
        });
    };

    flock.webAudio.mediaStreamFailure = function () {
        flock.fail("Media Capture and Streams are not supported on this browser.");
    };

    var webAudioShims = {
        AudioContext: window.AudioContext || window.webkitAudioContext,

        getUserMediaImpl: navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia || flock.webAudio.mediaStreamFailure,

        getUserMedia: function () {
            flock.shim.getUserMediaImpl.apply(navigator, arguments);
        },

        getMediaDevicesImpl: navigator.getMediaDevices ? navigator.getMediaDevices :
            typeof window.MediaStreamTrack !== "undefined" ?
            flock.webAudio.chrome.getSources : flock.webAudio.mediaStreamFailure,

        getMediaDevice: function () {
            flock.shim.getMediaDevicesImpl.apply(navigator, arguments);
        }
    };

    jQuery.extend(flock.shim, webAudioShims);


    /**
     * Web Audio API Audio Strategy
     */
    fluid.defaults("flock.audioStrategy.web", {
        gradeNames: ["flock.audioStrategy", "autoInit"],

        members: {
            context: "{contextWrapper}.context",
            sampleRate: "{that}.context.sampleRate",
            chans: {
                expander: {
                    funcName: "flock.audioStrategy.web.calculateChannels",
                    args: ["{contextWrapper}.context", "{enviro}.options.audioSettings.chans"]
                }
            },
            jsNode: {
                expander: {
                    funcName: "flock.audioStrategy.web.createScriptProcessor",
                    args: [
                        "{contextWrapper}.context",
                        "{enviro}.options.audioSettings.bufferSize",
                        "{enviro}.options.audioSettings.numInputBuses",
                        "{that}.chans"
                    ]
                }
            }
        },

        model: {
            isGenerating: false,
            shouldInitIOS: flock.platform.isIOS,
            krPeriods: {
                expander: {
                    funcName: "flock.audioStrategy.web.calcNumKrPeriods",
                    args: "{enviro}.options.audioSettings"
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
            }
        },

        components: {
            contextWrapper: {
                type: "flock.webAudio.contextWrapper"
            },

            nativeNodeManager: {
                type: "flock.webAudio.nativeNodeManager"
            },

            inputDeviceManager: {
                type: "flock.webAudio.inputDeviceManager"
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
                    funcName: "flock.audioStrategy.web.setChannelState",
                    args: ["{that}.chans", "{contextWrapper}.context.destination"]
                },
                {
                    funcName: "flock.audioStrategy.web.pushAudioSettings",
                    args: ["{that}.sampleRate", "{that}.chans", "{enviro}.options.audioSettings"]
                },
                {
                    funcName: "flock.audioStrategy.web.bindWriter",
                    args: [
                        "{that}.jsNode",
                        "{nodeEvaluator}",
                        "{nativeNodeManager}",
                        "{that}.model",
                        "{enviro}.options.audioSettings"
                    ]
                }
            ],

            onStart: [
                {
                    func: "{that}.applier.change",
                    args: ["isGenerating", true]
                },
                {
                    // TODO: Replace this with some progressive enhancement action.
                    funcName: "flock.audioStrategy.web.iOSStart",
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

    flock.audioStrategy.web.calculateChannels = function (context, chans) {
        // TODO: Remove this conditional when Safari adds support for multiple channels.
        return flock.platform.browser.safari ?  context.destination.channelCount :
            Math.min(chans, context.destination.maxChannelCount);
    };

    // TODO: Refactor into a shared environment-level model property.
    flock.audioStrategy.web.pushAudioSettings = function (sampleRate, chans, audioSettings) {
        audioSettings.rates.audio = sampleRate;
        audioSettings.chans = chans;
    };

    flock.audioStrategy.web.setChannelState = function (chans, destinationNode) {
        // Safari will throw an InvalidStateError DOM Exception 11 when
        // attempting to set channelCount on the audioContext's destination.
        // TODO: Remove this conditional when Safari adds support for multiple channels.
        if (!flock.platform.browser.safari) {
            destinationNode.channelCount = chans;
            destinationNode.channelCountMode = "explicit";
            destinationNode.channelInterpretation = "discrete";
        }
    };

    flock.audioStrategy.web.calcNumKrPeriods = function (s) {
        return s.bufferSize / s.blockSize;
    };

    flock.audioStrategy.web.createScriptProcessor = function (ctx, bufferSize, numInputs, chans) {
        var jsNodeName = ctx.createScriptProcessor ? "createScriptProcessor" : "createJavaScriptNode",
            jsNode = ctx[jsNodeName](bufferSize, numInputs, chans);

        jsNode.channelCountMode = "explicit";

        return jsNode;
    };

    flock.audioStrategy.web.bindWriter = function (jsNode, nodeEvaluator, nativeNodeManager, model, audioSettings) {
        jsNode.model = model;
        jsNode.evaluator = nodeEvaluator;
        jsNode.audioSettings = audioSettings;
        jsNode.inputNodes = nativeNodeManager.inputNodes;
        jsNode.onaudioprocess = flock.audioStrategy.web.writeSamples;
    };

    /**
     * Writes samples to the audio strategy's ScriptProcessorNode.
     *
     * This function must be bound as a listener to the node's
     * onaudioprocess event. It expects to be called in the context
     * of a "this" instance containing the following properties:
     *  - model: the strategy's model object
     *  - inputNodes: a list of native input nodes to be read into input buses
     *  - nodeEvaluator: a nodeEvaluator instance
     *  - audioSettings: the enviornment's audio settings
     */
    flock.audioStrategy.web.writeSamples = function (e) {
        var m = this.model,
            numInputNodes = this.inputNodes.length,
            evaluator = this.evaluator,
            s = this.audioSettings,
            inBufs = e.inputBuffer,
            outBufs = e.outputBuffer,
            krPeriods = m.krPeriods,
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
    };

    flock.audioStrategy.web.iOSStart = function (model, applier, ctx, jsNode) {
        // Work around a bug in iOS Safari where it now requires a noteOn()
        // message to be invoked before sound will work at all. Just connecting a
        // ScriptProcessorNode inside a user event handler isn't sufficient.
        if (model.shouldInitIOS) {
            var s = ctx.createBufferSource();
            s.connect(jsNode);
            s.start(0);
            s.disconnect(0);
            applier.change("shouldInitIOS", false);
        }
    };


    /**
     * An Infusion component wrapper for a Web Audio API AudioContext instance.
     */
    // TODO: Refactor this into an "audio system" component (with cross-platform base grade)
    // that serves as the canonical source for shared audio settings such as
    // sample rate, number of channels, etc.
    fluid.defaults("flock.webAudio.contextWrapper", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        members: {
            context: "@expand:flock.webAudio.contextWrapper.create()"
        },

        listeners: {
            onCreate: [
                {
                    funcName: "flock.webAudio.contextWrapper.registerSingleton",
                    args: ["{that}"]
                }
            ]
        }
    });

    flock.webAudio.contextWrapper.create = function () {
        var singleton = fluid.staticEnvironment.webAudioContextWrapper;
        return singleton ? singleton.context : new flock.shim.AudioContext();
    };

    flock.webAudio.contextWrapper.registerSingleton = function (that) {
        fluid.staticEnvironment.webAudioContextWrapper = that;
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

        audioSettings: "{enviro}.options.audioSettings",

        members: {
            outputNode: undefined,
            inputNodes: [],
            merger: {
                expander: {
                    funcName: "flock.webAudio.nativeNodeManager.createInputMerger",
                    args: [
                        "{contextWrapper}.context",
                        "{enviro}.options.audioSettings.numInputBuses",
                        "{web}.jsNode"
                    ]
                }
            }
        },

        invokers: {
            connect: {
                funcName: "flock.webAudio.nativeNodeManager.connect",
                args: [
                    "{that}.merger",
                    "{web}.jsNode",
                    "{that}.outputNode",
                    "{contextWrapper}.context.destination"
                ]
            },

            createNode: {
                funcName: "flock.webAudio.createNode",
                args: [
                    "{contextWrapper}.context",
                    "{arguments}.0", // Node type.
                    "{arguments}.1", // Constructor args.
                    "{arguments}.2"  // AudioParam connections.
                ]
            },

            createInputNode: {
                funcName: "flock.webAudio.nativeNodeManager.createInputNode",
                args: [
                    "{that}",
                    "{arguments}.0", // Node type.
                    "{arguments}.1", // Constructor args.
                    "{arguments}.2", // AudioParam connections.
                    "{arguments}.3"  // {optional} The input bus number to insert it at.
                ]
            },

            createMediaStreamInput: {
                funcName: "flock.webAudio.nativeNodeManager.createInputNode",
                args: [
                    "{that}",
                    "MediaStreamSource",
                    "{arguments}.0", // The MediaStream,
                    undefined,
                    "{arguments}.1"  // {optional} The input bus number to insert it at.
                ]
            },

            createMediaElementInput: {
                funcName: "flock.webAudio.nativeNodeManager.createInputNode",
                args: [
                    "{that}",
                    "MediaElementSource",
                    "{arguments}.0", // The HTMLMediaElement
                    undefined,
                    "{arguments}.1"  // {optional} The input bus number to insert it at.
                ]
            },

            createOutputNode: {
                funcName: "flock.webAudio.nativeNodeManager.createOutputNode",
                args: [
                    "{that}",
                    "{arguments}.0", // Node type.
                    "{arguments}.1", // Constructor args.
                    "{arguments}.2"  // AudioParam connections.
                ]
            },

            disconnect: {
                funcName: "flock.webAudio.nativeNodeManager.disconnect",
                args: ["{that}.merger", "{web}.jsNode", "{that}.outputNode"]
            },

            insertInput: {
                funcName: "flock.webAudio.nativeNodeManager.insertInput",
                args: [
                    "{that}",
                    "{enviro}",
                    "{arguments}.0", // The node to insert.
                    "{arguments}.1"  // {optional} The bus number to insert it at.
                ]
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
                args: ["{web}.jsNode"]
            }
        },

        listeners: {
            onCreate: {
                func: "{that}.insertOutput",
                args: "{web}.jsNode"
            }
        }
    });

    flock.webAudio.nativeNodeManager.createInputNode = function (that, type, args, params, busNum) {
        var node = that.createNode(type, args, params);
        return that.insertInput(node, busNum);
    };

    flock.webAudio.nativeNodeManager.createOutputNode = function (that, type, args, params) {
        var node = that.createNode(type, args, params);
        return that.insertOutput(node);
    };

    flock.webAudio.nativeNodeManager.createInputMerger = function (ctx, numInputBuses, jsNode) {
        var merger = ctx.createChannelMerger(numInputBuses);
        merger.channelInterpretation = "discrete";
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

    flock.webAudio.nativeNodeManager.insertInput = function (that, enviro, node, busNum) {
        var maxInputs = that.options.audioSettings.numInputBuses;
        if (that.inputNodes.length >= maxInputs) {
            flock.fail("There are too many input nodes connected to Flocking. " +
                "The maximum number of input buses is currently set to " + maxInputs + ". " +
                "Either remove an existing input node or increase Flockings numInputBuses option.");

            return;
        }

        busNum = busNum === undefined ? enviro.acquireNextBus("input") : busNum;
        var idx = busNum - enviro.audioSettings.chans;

        that.inputNodes.push(node);
        node.connect(that.merger, 0, idx);

        return busNum;
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

        return node;
    };

    flock.webAudio.nativeNodeManager.removeOutput = function (jsNode) {
        // Replace the current output node with the jsNode.
        flock.webAudio.nativeNodeManager.insertOutput(jsNode);
    };


    /**
     * Manages audio input devices using the Web Audio API.
     */
    // Add a means for disconnecting audio input nodes.
    fluid.defaults("flock.webAudio.inputDeviceManager", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        members: {
            context: "{contextWrapper}.context"
        },

        invokers: {
            /**
             * Opens the specified audio device.
             * If no device is specified, the default device is opened.
             *
             * @param {Object} deviceSpec a device spec containing, optionally, an 'id' or 'label' parameter
             */
            openAudioDevice: {
                funcName: "flock.webAudio.inputDeviceManager.openAudioDevice",
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
                funcName: "flock.webAudio.inputDeviceManager.openAudioDeviceWithConstraints",
                args: [
                    "{that}.context",
                    "{enviro}",
                    "{nativeNodeManager}.createMediaStreamInput",
                    "{arguments}.0"
                ]
            },

            /**
             * Opens an audio device with the specified WebRTC device id.
             *
             * @param {string} id a device identifier
             */
            openAudioDeviceWithId: {
                funcName: "flock.webAudio.inputDeviceManager.openAudioDeviceWithId",
                args: ["{arguments}.0", "{that}.openAudioDeviceWithConstraints"]
            },

            /**
             * Opens the first audio device found with the specified label.
             * The label must be an exact, case-insensitive match.
             *
             * @param {string} label a device label
             */
            openFirstAudioDeviceWithLabel: {
                funcName: "flock.webAudio.inputDeviceManager.openFirstAudioDeviceWithLabel",
                args: ["{arguments}.0", "{that}.openAudioDeviceWithId"]
            }
        }
    });

    flock.webAudio.inputDeviceManager.openAudioDevice = function (sourceSpec, idOpener, labelOpener, specOpener) {
        if (sourceSpec) {
            if (sourceSpec.id) {
                return idOpener(sourceSpec.id);
            } else if (sourceSpec.label) {
                return labelOpener(sourceSpec.label);
            }
        }

        return specOpener();
    };


    flock.webAudio.inputDeviceManager.openAudioDeviceWithId = function (id, deviceOpener) {
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

    flock.webAudio.inputDeviceManager.openFirstAudioDeviceWithLabel = function (label, deviceOpener) {
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

    flock.webAudio.inputDeviceManager.openAudioDeviceWithConstraints = function (context, enviro, openMediaStream, options) {
        options = options || {
            audio: true
        };

        // Acquire an input bus ahead of time so we can synchronously
        // notify the client where its output will be.
        var busNum = enviro.acquireNextBus("input");

        function error (err) {
            fluid.log(fluid.logLevel.IMPORTANT,
                "An error occurred while trying to access the user's microphone. " +
                err);
        }

        function success (mediaStream) {
            openMediaStream(mediaStream, busNum);
        }


        flock.shim.getUserMedia(options, success, error);

        return busNum;
    };

    fluid.demands("flock.audioStrategy.platform", "flock.platform.webAudio", {
        funcName: "flock.audioStrategy.web"
    });

}());
