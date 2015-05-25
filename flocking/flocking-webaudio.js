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

    flock.webAudio.createNode = function (context, nodeSpec) {
        nodeSpec.args = nodeSpec.args ? fluid.makeArray(nodeSpec.args) : undefined;

        var creatorName = "create" + nodeSpec.node,
            nodeStrIdx = creatorName.indexOf("Node");

        // Trim off "Node" if it is present.
        if (nodeStrIdx > -1) {
            creatorName = creatorName.substring(0, nodeStrIdx);
        }

        var node = context[creatorName].apply(context, nodeSpec.args);
        flock.webAudio.initNodeParams(context, node, nodeSpec);
        flock.webAudio.initNodeProperties(node, nodeSpec);
        flock.webAudio.initNodeInputs(node, nodeSpec);

        return node;
    };

    flock.webAudio.setAudioParamValue = function (context, param, value, atTime) {
        atTime = atTime || 0.0;
        var scheduledTime = context.currentTime + atTime;
        param.setValueAtTime(value, scheduledTime);
    };

    // TODO: Add support for other types of AudioParams.
    flock.webAudio.initNodeParams = function (context, node, nodeSpec) {
        var params = nodeSpec.params;

        if (!node || !params) {
            return;
        }

        for (var paramName in params) {
            var param = node[paramName],
                value = params[paramName];

            flock.webAudio.setAudioParamValue(context, param, value);
        }

        return node;
    };

    flock.webAudio.safariPropertyProhibitions = [
        "channelCount",
        "channelCountMode"
    ];

    flock.webAudio.shouldSetProperty = function (propName) {
        return flock.platform.browser.safari ?
            flock.webAudio.safariPropertyProhibitions.indexOf(propName) < 0 :
            true;
    };

    flock.webAudio.initNodeProperties = function (node, nodeSpec) {
        var props = nodeSpec.props;
        if (!props) {
            return;
        }

        for (var propName in props) {
            var value = props[propName];

            if (flock.webAudio.shouldSetProperty(propName)) {
                node[propName] = value;
            }
        }

        return node;
    };

    flock.webAudio.connectInput = function (node, inputNum, input, outputNum) {
        input.connect(node, outputNum, inputNum);
    };

    // TODO: Add the ability to specify the output channel of the connection.
    // TODO: Unify this with AudioParams so they all just look like "inputs".
    flock.webAudio.initNodeInputs = function (node, nodeSpec) {
        var inputs = nodeSpec.inputs;

        for (var inputName in inputs) {
            var inputNodes = inputs[inputName],
                inputNum = parseInt(inputName, 10);

            inputNodes = fluid.makeArray(inputNodes);

            for (var i = 0; i < inputNodes.length; i++) {
                var input = inputNodes[i];
                flock.webAudio.connectInput(node, inputNum, input);
            }
        }
    };


    fluid.defaults("flock.webAudio.audioSystem", {
        gradeNames: ["flock.audioSystem", "autoInit"],

        channelRange: {
            min: "@expand:flock.webAudio.audioSystem.calcMinChannels()",
            max: "@expand:flock.webAudio.audioSystem.calcMaxChannels({that}.context.destination)"
        },

        members: {
            context: "@expand:flock.webAudio.audioSystem.createContext()"
        },

        model: {
            rates: {
                audio: "{that}.context.sampleRate"
            }
        },

        listeners: {
            onCreate: [
                "flock.webAudio.audioSystem.registerContextSingleton({that})",
                "flock.webAudio.audioSystem.configureDestination({that}.context, {that}.model.chans)"
            ]
        }
    });

    flock.webAudio.audioSystem.createContext = function () {
        var singleton = fluid.staticEnvironment.audioSystem;
        return singleton ? singleton.context : new flock.shim.AudioContext();
    };

    flock.webAudio.audioSystem.registerContextSingleton = function (that) {
        fluid.staticEnvironment.audioSystem = that;
    };

    flock.webAudio.audioSystem.calcMaxChannels = function (destination) {
        return flock.platform.browser.safari ? destination.channelCount :
            destination.maxChannelCount;
    };

    flock.webAudio.audioSystem.calcMinChannels = function () {
        return flock.platform.browser.safari ? 2 : 1;
    };

    flock.webAudio.audioSystem.configureDestination = function (context, chans) {
        // Safari will throw an InvalidStateError DOM Exception 11 when
        // attempting to set channelCount on the audioContext's destination.
        // TODO: Remove this conditional when Safari adds support for multiple channels.
        if (!flock.platform.browser.safari) {
            context.destination.channelCount = chans;
            context.destination.channelCountMode = "explicit";
            context.destination.channelInterpretation = "discrete";
        }
    };

    fluid.defaults("flock.webAudio.node", {
        gradeNames: ["fluid.standardRelayComponent", "autoInit"],

        members: {
            node: "@expand:flock.webAudio.createNode({audioSystem}.context, {that}.options.nodeSpec)"
        },

        nodeSpec: {
            args: [],
            params: {},
            properties: {}
        }
    });


    fluid.defaults("flock.webAudio.gain", {
        gradeNames: ["flock.webAudio.node", "autoInit"],

        members: {
            node: "@expand:flock.webAudio.createNode({audioSystem}.context, {that}.options.nodeSpec)"
        },

        nodeSpec: {
            node: "Gain"
        }
    });


    fluid.defaults("flock.webAudio.scriptProcessor", {
        gradeNames: ["flock.webAudio.node", "autoInit"],

        nodeSpec: {
            node: "ScriptProcessor",
            args: [
                "{audioSystem}.model.bufferSize",
                "{audioSystem}.model.numInputBuses",
                "{audioSystem}.model.chans"
            ],
            params: {},
            properties: {
                channelCountMode: "explicit"
            }
        }
    });

    fluid.defaults("flock.webAudio.channelMerger", {
        gradeNames: ["flock.webAudio.node", "autoInit"],

        nodeSpec: {
            node: "ChannelMerger",
            args: ["{audioSystem}.model.numInputBuses"],
            properties: {
                channelCountMode: "discrete"
            }
        }
    });


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

        model: {
            isGenerating: false,
            shouldInitIOS: flock.platform.isIOS
        },

        invokers: {
            start: "{that}.events.onStart.fire()",
            stop: "{that}.events.onStop.fire()",
            saveBuffer: "flock.audioStrategy.web.saveBuffer({arguments}.0)"
        },

        components: {
            nativeNodeManager: {
                type: "flock.webAudio.nativeNodeManager"
            },

            inputDeviceManager: {
                type: "flock.webAudio.inputDeviceManager"
            }
        },

        listeners: {
            onStart: [
                {
                    func: "{that}.applier.change",
                    args: ["isGenerating", true]
                }
            ],

            onStop: [
                {
                    func: "{that}.applier.change",
                    args: ["isGenerating", false]
                }
            ]
        }
    });


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
        var numInputNodes = this.inputNodes.length,
            evaluator = this.evaluator,
            nodes = evaluator.nodes,
            s = this.audioSettings,
            inBufs = e.inputBuffer,
            outBufs = e.outputBuffer,
            numBlocks = s.numBlocks,
            buses = evaluator.buses,
            numBuses = s.numBuses,
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
        for (i = 0; i < numBlocks; i++) {
            var offset = i * blockSize;

            flock.nodeEvaluator.clearBuses(numBuses, blockSize, buses);

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

            flock.nodeEvaluator.gen(nodes);

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
            s.stop(0);
            s.disconnect(0);
            applier.change("shouldInitIOS", false);
        }
    };

    flock.audioStrategy.web.saveBuffer = function (o) {
        try {
            var encoded = flock.audio.encode.wav(o.buffer, o.format),
                blob = new Blob([encoded], {
                    type: "audio/wav"
                });

            flock.audioStrategy.web.download(o.path, blob);

            if (o.success) {
                o.success(encoded);
            }

            return encoded;
        } catch (e) {
            if (!o.error) {
                flock.fail("There was an error while trying to download the buffer named " +
                    o.buffer.id + ". Error: " + e);
            } else {
                o.error(e);
            }
        }
    };

    flock.audioStrategy.web.download = function (fileName, blob) {
        var dataURL = flock.shim.URL.createObjectURL(blob),
            a = window.document.createElement("a"),
            click = document.createEvent("Event");

        // TODO: This approach currently only works in Chrome.
        // Although Firefox apparently supports it, this method of
        // programmatically clicking the link doesn't seem to have an
        // effect in it.
        // http://caniuse.com/#feat=download
        a.href = dataURL;
        a.download = fileName;
        click.initEvent("click", true, true);
        a.dispatchEvent(click);
    };


    /**
     * Manages a collection of input nodes and an output node,
     * with a JS node in between.
     *
     * Note: this component is slated for removal when Web Audio
     * "islands" are implemented.
     */
    fluid.defaults("flock.webAudio.nativeNodeManager", {
        gradeNames: ["fluid.standardRelayComponent", "autoInit"],

        members: {
            outputNode: undefined,
            inputNodes: []
        },

        components: {
            scriptProcessor: {
                createOnEvent: "onCreateScriptProcessor",
                type: "flock.webAudio.scriptProcessor",
                options: {
                    nodeSpec: {
                        inputs: {
                            "0": "{inputMerger}"
                        }
                    },

                    listeners: {
                        onCreate: [
                            // TODO: Where should this really go?
                            {
                                funcName: "flock.audioStrategy.web.bindWriter",
                                args: [
                                    "{that}.node",
                                    "{nodeEvaluator}",
                                    "{nativeNodeManager}",
                                    "{audioStrategy}.model",
                                    "{audioSystem}.model"
                                ]
                            }
                        ]
                    }
                }
            },

            merger: {
                type: "flock.webAudio.channelMerger"
            }
        },

        invokers: {
            connect: "{that}.events.onConnect.fire",

            disconnect: "{that}.events.onDisconnect.fire",

            createNode: {
                funcName: "flock.webAudio.createNode",
                args: [
                    "{audioSystem}.context",
                    "{arguments}.0" // The nodeSpec
                ]
            },

            createInputNode: {
                funcName: "flock.webAudio.nativeNodeManager.createInputNode",
                args: [
                    "{that}",
                    "{arguments}.0", // The nodeSpec.
                    "{arguments}.1", // {optional} The input bus number to insert it at.
                ]
            },

            createMediaStreamInput: {
                funcName: "flock.webAudio.nativeNodeManager.createInputNode",
                dynamic: true,
                args: [
                    "{that}",
                    {
                        node: "MediaStreamSource",
                        args: ["{arguments}.0"] // The MediaStream
                    },
                    "{arguments}.1"  // {optional} The input bus number to insert it at.
                ]
            },

            createMediaElementInput: {
                funcName: "flock.webAudio.nativeNodeManager.createInputNode",
                dynamic: true,
                args: [
                    "{that}",
                    {
                        node: "MediaElementSource",
                        args: ["{arguments}.0"] // The HTMLMediaElement
                    },
                    "{arguments}.1"  // {optional} The input bus number to insert it at.
                ]
            },

            createOutputNode: {
                funcName: "flock.webAudio.nativeNodeManager.createOutputNode",
                args: [
                    "{that}",
                    "{arguments}.0" // The nodeSpec
                ]
            },

            insertInput: {
                funcName: "flock.webAudio.nativeNodeManager.insertInput",
                args: [
                    "{that}",
                    "{audioSystem}.model",
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
                dynamic: true,
                args: ["{scriptProcessor}.node"]
            }
        },

        events: {
            onCreateScriptProcessor: null, // TODO: Naming!
            onStart: "{audioStrategy}.events.onStart",
            onConnect: null,
            onStop: "{audioStrategy}.events.onStop",
            onDisconnect: null,
            onReset: "{audioStrategy}.events.onReset"
        },

        listeners: {
            onCreate: [
                "{that}.events.onCreateScriptProcessor.fire()",
                {
                    func: "{that}.insertOutput",
                    args: "{scriptProcessor}.node"
                }
            ],

            onStart: [
                "{nativeNodeManager}.connect()",

                {
                    // TODO: Replace this with some progressive enhancement action.
                    // TODO: Where should this really go?
                    funcName: "flock.audioStrategy.web.iOSStart",
                    args: [
                        "{audioStrategy}.model",
                        "{audioStrategy}.applier",
                        "{audioSystem}.context",
                        "{scriptProcessor}.node"
                    ]
                }
            ],

            onConnect: [
                {
                    "this": "{merger}.node",
                    method: "connect",
                    args: ["{scriptProcessor}.node"]
                },
                {
                    "this": "{that}.outputNode",
                    method: "connect",
                    args: ["{audioSystem}.context.destination"]
                },
                {
                    funcName: "flock.webAudio.nativeNodeManager.connectOutput",
                    args: ["{scriptProcessor}.node", "{that}.outputNode"]
                }
            ],

            onStop: [
                "{nativeNodeManager}.disconnect()"
            ],

            onDisconnect: [
                {
                    "this": "{merger}.node",
                    method: "disconnect",
                    args: [0]
                },
                {
                    "this": "{scriptProcessor}.node",
                    method: "disconnect",
                    args: [0]
                },
                {
                    "this": "{that}.outputNode",
                    method: "disconnect",
                    args: [0]
                }
            ],

            onReset: [
                "{that}.removeAllInputs",
                "{that}.events.onCreateScriptProcessor.fire()"
            ]
        }
    });

    flock.webAudio.nativeNodeManager.createInputNode = function (that, nodeSpec, busNum) {
        var node = that.createNode(nodeSpec);
        return that.insertInput(node, busNum);
    };

    flock.webAudio.nativeNodeManager.createOutputNode = function (that, nodeSpec) {
        var node = that.createNode(nodeSpec);
        return that.insertOutput(node);
    };

    flock.webAudio.nativeNodeManager.connectOutput = function (jsNode, outputNode) {
        if (jsNode !== outputNode) {
            jsNode.connect(outputNode);
        }
    };

    flock.webAudio.nativeNodeManager.removeAllInputs = function (inputNodes) {
        for (var i = 0; i < inputNodes.length; i++) {
            var node = inputNodes[i];
            node.disconnect(0);
        }
        inputNodes.length = 0;
    };

    flock.webAudio.nativeNodeManager.insertInput = function (that, audioSettings, enviro, node, busNum) {
        var maxInputs = audioSettings.numInputBuses;
        if (that.inputNodes.length >= maxInputs) {
            flock.fail("There are too many input nodes connected to Flocking. " +
                "The maximum number of input buses is currently set to " + maxInputs + ". " +
                "Either remove an existing input node or increase Flockings numInputBuses option.");

            return;
        }

        busNum = busNum === undefined ? enviro.busManager.acquireNextBus("input") : busNum;
        var idx = busNum - audioSettings.chans;

        that.inputNodes.push(node);
        node.connect(that.merger.node, 0, idx);

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
                    "{audioSystem}.context",
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
        var busNum = enviro.busManager.acquireNextBus("input");

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


    fluid.defaults("flock.webAudio.outputFader", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        fadeDuration: 0.5,

        gainSpec: {
            node: "Gain",

            params: {
                gain: 0.0
            },

            properties: {
                channelCount: "{audioSystem}.model.chans",
                channelCountMode: "explicit"
            }
        },

        members: {
            gainNode: "@expand:flock.webAudio.outputFader.createGainNode({enviro}, {that}.options.gainSpec)",
            context: "{audioSystem}.context"
        },

        invokers: {
            fadeIn: {
                funcName: "flock.webAudio.outputFader.fadeIn",
                args: [
                    "{that}.context",
                    "{that}.gainNode",
                    "{arguments}.0", // Target amplitude
                    "{that}.options.fadeDuration"
                ]
            },

            fadeTo: {
                funcName: "flock.webAudio.outputFader.fadeTo",
                args: [
                    "{that}.context",
                    "{that}.gainNode",
                    "{arguments}.0", // Target amplitude
                    "{that}.options.fadeDuration"
                ]
            }
        }
    });

    flock.webAudio.outputFader.createGainNode = function (enviro, gainSpec) {
        var gainNode = enviro.audioStrategy.nativeNodeManager.createOutputNode(gainSpec);

        return gainNode;
    };

    flock.webAudio.outputFader.fade = function (context, gainNode, start, end, duration) {
        duration = duration || 0.0;

        var now = context.currentTime,
            endTime = now + duration;

        // Set the current value now, then ramp to the target.
        flock.webAudio.setAudioParamValue(context, gainNode.gain, start);
        gainNode.gain.linearRampToValueAtTime(end, endTime);
    };

    flock.webAudio.outputFader.fadeTo = function (context, gainNode, end, duration) {
        flock.webAudio.outputFader.fade(context, gainNode, gainNode.gain.value, end, duration);
    };

    flock.webAudio.outputFader.fadeIn = function (context, gainNode, end, duration) {
        flock.webAudio.outputFader.fade(context, gainNode, 0, end, duration);
    };


    fluid.demands("flock.audioSystem.platform", "flock.platform.webAudio", {
        funcName: "flock.webAudio.audioSystem"
    });

    fluid.demands("flock.audioStrategy.platform", "flock.platform.webAudio", {
        funcName: "flock.audioStrategy.web"
    });

}());
