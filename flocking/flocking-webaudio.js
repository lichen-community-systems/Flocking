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
            jsNode: null,
            merger: null,
            postNode: null
        },

        model: {
            isGenerating: false,
            hasInput: false
        },

        components: {
            contextWrapper: {
                type: "flock.webAudio.contextWrapper"
            },

            deviceManager: {
                type: "flock.webAudio.deviceManager",
                options: {
                    members: {
                        context: "{contextWrapper}.context"
                    },

                    listeners: {
                        onMediaStreamOpened: {
                            func: "{strategy}.insertInputNode",
                            args: ["{arguments}.0"]
                        }
                    }
                }
            }
        }
    });

    flock.webAudio.strategy.preInit = function (that) {
        that.connectInputNodes = function () {
            var nodes = that.preNodes;
            if (!nodes) {
                return;
            }

            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                node.connect(that.jsNode);
            }
        };

        that.disconnectInputNodes = function () {
            var nodes = that.preNodes;
            if (!nodes) {
                return;
            }

            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                node.disconnect(0);
            }
        };

        that.startGeneratingSamples = function () {
            var m = that.model;

            that.connectInputNodes();
            that.postNode.connect(that.context.destination);
            if (that.postNode !== that.jsNode) {
                that.jsNode.connect(that.postNode);
            }

            // Work around a bug in iOS Safari where it now requires a noteOn()
            // message to be invoked before sound will work at all. Just connecting a
            // ScriptProcessorNode inside a user event handler isn't sufficient.
            if (m.shouldInitIOS) {
                var s = that.context.createBufferSource();
                s.connect(that.jsNode);
                s.start(0);
                s.stop(0);
                s.disconnect(0);
                m.shouldInitIOS = false;
            }

            m.isGenerating = true;
        };

        that.stopGeneratingSamples = function () {
            that.jsNode.disconnect(0);
            that.postNode.disconnect(0);
            that.disconnectInputNodes();
            that.model.isGenerating = false;
        };

        that.writeSamples = function (e) {
            var m = that.model,
                hasInput = m.hasInput,
                krPeriods = m.krPeriods,
                evaluator = that.nodeEvaluator,
                buses = evaluator.buses,
                audioSettings = that.options.audioSettings,
                blockSize = audioSettings.blockSize,
                playState = m.playState,
                chans = audioSettings.chans,
                inBufs = e.inputBuffer,
                inChans = e.inputBuffer.numberOfChannels,
                outBufs = e.outputBuffer,
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
                if (hasInput) {
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

            playState.written += audioSettings.bufferSize * chans;
            if (playState.written >= playState.total) {
                that.stopGeneratingSamples();
            }
        };

        that.insertInputNode = function (node) {
            var m = that.model;

            that.preNodes.push(node);
            m.hasInput = true;

            if (m.isGenerating) {
                node.connect(that.jsNode);
            }
        };

        that.insertOutputNode = function (node) {
            if (that.postNode) {
                that.removeOutputNode(that.postNode);
            }

            that.postNode = node;
        };

        that.removeInputNode = function (node) {
            var idx = that.preNodes.indexOf(node);
            if (idx > -1) {
                that.preNodes.splice(idx, 1);
            }
            flock.enviro.webAudio.removeNode(node);

            if (that.preNodes.length === 0) {
                that.model.hasInput = false;
            }
        };

        that.removeOutputNode = function () {
            flock.enviro.webAudio.removeNode(that.postNode);
            that.postNode = that.jsNode;
        };

        that.stopReadingAudioInput = function () {
            that.removeInputNode(); // TODO: How?
        };

        that.createScriptProcessor = function (s) {
            var ctx = that.context,
                jsNodeName = ctx.createScriptProcessor ? "createScriptProcessor" : "createJavaScriptNode";

            that.jsNode = ctx[jsNodeName](s.bufferSize, s.numInputBuses, s.chans);
            that.merger = that.context.createChannelMerger(s.numInputBuses);
            that.merger.connect(that.jsNode);
            that.insertOutputNode(that.jsNode);
            that.jsNode.onaudioprocess = that.writeSamples;
        };
    };

    flock.webAudio.strategy.finalInit = function (that) {
        var m = that.model,
            settings = that.options.audioSettings;

        m.krPeriods = settings.bufferSize / settings.blockSize;
        settings.rates.audio = that.context.sampleRate;
        that.createScriptProcessor(settings);
        m.shouldInitIOS = flock.platform.isIOS;
    };

    flock.webAudio.strategy.removeNode = function (node) {
        node.disconnect(0); // TODO: Is this still accurate?
    };

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
