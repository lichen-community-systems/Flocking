/*
* Flocking WebAudio Strategy
* http://github.com/colinbdclark/flocking
*
* Copyright 2013-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global require*/
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

    flock.shim.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia || navigator.msGetUserMedia;

    /**
     * Web Audio API Audio Strategy
     */
    fluid.defaults("flock.audioStrategy.web", {
        gradeNames: ["flock.audioStrategy", "autoInit"],

        model: {
            // TODO: Resolve this with the isPlaying model field in flock.enviro.
            isGenerating: false,
            hasInput: false,
            krPeriods: "@expand:flock.audioStrategy.web.calcNumBlocks({that}.options.audioSettings)"
        },

        members: {
            context: "@expand:flock.audioStrategy.web.createAudioContext()",
            jsNode: {
                expander: {
                    funcName: "flock.audioStrategy.web.createScriptNode",
                    args: ["{that}.context", "{that}.options.audioSettings"]
                }
            },
            postNode: "{that}.jsNode",
            preNode: null
        },

        invokers: {
            // TODO: Rename to "start"
            startGeneratingSamples: {
                funcName: "flock.audioStrategy.web.start",
                args: [
                    "{that}.model",
                    "{that}.applier",
                    "{that}.context",
                    "{that}.jsNode",
                    "{that}.preNode",
                    "{that}.postNode"
                ]
            },

            // TODO: Rename to "stop"
            stopGeneratingSamples: {
                funcName: "flock.audioStrategy.web.stop",
                args: [
                    "{that}.applier",
                    "{that}.jsNode",
                    "{that}.preNode",
                    "{that}.postNode"
                ]
            },

            writeSamples: {
                funcName: "flock.audioStrategy.web.writeSamples",
                args: [
                    "{arguments}.0", // The onprocessaudio event.
                    "{that}"
                ]
            },

            // TODO: Rename, de-thatify.
            insertInputNode: "flock.audioStrategy.web.insertInputNode({arguments}.0, {that})",

            // TODO: De-thatify.
            removeInputNode: "flock.audioStrategy.web.removeInputNode({that})",

            // TODO: Rename, de-thatify.
            insertOutputNode: "flock.audioStrategy.web.insertOutputNode({arguments}.0, {that})",

            // TODO: De-thatify.
            removeOutputNode: "flock.audioStrategy.web.removeOutputNode({that})",

            // TODO: De-thatify.
            startReadingAudioInput: "flock.audioStrategy.web.startReadingAudioInput({that})",

            stopReadingAudioInput: "{that}.removeInputNode()"
        },

        listeners: {
            onCreate: [
                {
                    funcName: "flock.audioStrategy.web.bindAudioProcessEvent",
                    args: ["{that}.jsNode", "{that}.writeSamples"]
                },
                {
                    // TODO: Replace this with progressive enhancement.
                    func: "{that}.applier.change",
                    args: ["shouldInitIOS", flock.platform.isIOS]
                }
            ]
        }
    });

    flock.audioStrategy.web.createAudioContext = function () {
        // Singleton AudioContext since the WebKit implementation
        // freaks if we try to instantiate a new one.
        if (!flock.audioStrategy.web.audioContext) {
            flock.audioStrategy.web.audioContext = new flock.audioStrategy.web.contextConstructor();
        }

        return flock.audioStrategy.web.audioContext;
    };

    flock.audioStrategy.web.setupChannels = function (context, audioSettings) {
        // TODO: This reduces the user's ability to easily control how many
        // channels of their device are actually used. They can control
        // how many non-silent channels there are by using the "expand"
        // input of flock.ugen.output, but there will still be some extra
        // overhead. The best way to solve this is to not override settings.chans,
        // but to instead offer some kind of controls in the playground for adjusting this,
        // or by providing some kind of "max channels" flag as a parameter to chans.

        if (!flock.platform.browser.safari) {
            // TODO: Fix this temporary workaround for the fact that iOS won't
            // allow us to access the destination node until the user has
            // touched something.
            audioSettings.chans = context.destination.maxChannelCount;
            context.destination.channelCount = audioSettings.chans;
        }
    };

    flock.audioStrategy.web.calcNumBlocks = function (audioSettings) {
        return audioSettings.bufferSize / audioSettings.blockSize;
    };

    flock.audioStrategy.web.updateSampleRate = function (context, audioSettings) {
        // Override audio settings based on the capabilities of the environment.
        // These values are "pulled" by the enviro in a hacky sort of way.
        // TODO: Fix this by modelizing audioSettings.
        audioSettings.rates.audio = context.sampleRate;
    };

    flock.audioStrategy.web.start = function (model, applier, context, jsNode, preNode, postNode) {
        if (preNode) {
            preNode.connect(jsNode);
        }

        postNode.connect(context.destination);
        if (postNode !== jsNode) {
            jsNode.connect(postNode);
        }

        // Work around a bug in iOS Safari where it now requires a noteOn()
        // message to be invoked before sound will work at all. Just connecting a
        // ScriptProcessorNode inside a user event handler isn't sufficient.
        if (model.shouldInitIOS) {
            var s = context.createBufferSource();
            s.connect(jsNode);
            s.start(0);
            s.stop(0);
            s.disconnect(0);
            applier.change("shouldInitIOS", false);
        }

        applier.change("isGenerating", true);
    };

    flock.audioStrategy.web.stop = function (applier, jsNode, preNode, postNode) {
        jsNode.disconnect(0);
        postNode.disconnect(0);
        if (preNode) {
            preNode.disconnect(0);
        }

        applier.change("isGenerating", false);
    };

    // TODO: Break into multiple functions.
    flock.audioStrategy.web.writeSamples = function (evt, that) {
        var m = that.model,
            hasInput = m.hasInput,
            krPeriods = m.krPeriods,
            evaluator = that.nodeEvaluator,
            buses = evaluator.buses,
            audioSettings = that.options.audioSettings,
            blockSize = audioSettings.blockSize,
            playState = m.playState,
            chans = audioSettings.chans,
            inBufs = evt.inputBuffer,
            inChans = evt.inputBuffer.numberOfChannels,
            outBufs = evt.outputBuffer,
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

    flock.audioStrategy.web.insertInputNode = function (node, that) {
        var m = that.model;

        if (that.preNode) {
            that.removeInputNode(that.preNode);
        }

        that.preNode = node;
        m.hasInput = true;

        if (m.isGenerating) {
            that.preNode.connect(that.jsNode);
        }
    };

    flock.audioStrategy.web.insertOutputNode = function (node, that) {
        if (that.postNode) {
            that.removeOutputNode(that.postNode);
        }

        that.postNode = node;
    };

    flock.audioStrategy.web.removeInputNode = function (that) {
        flock.audioStrategy.web.disconnectNode(that.preNode);
        that.preNode = null;
        that.model.hasInput = false;
    };

    flock.audioStrategy.web.removeOutputNode = function (that) {
        flock.audioStrategy.web.disconnectNode(that.postNode);
        that.postNode = that.jsNode;
    };

    flock.audioStrategy.web.startReadingAudioInput = function (that) {
        flock.shim.getUserMedia.call(navigator, {
            audio: true
        },
        function success (mediaStream) {
            var mic = that.context.createMediaStreamSource(mediaStream);
            that.insertInputNode(mic);
        },
        function error (err) {
            fluid.log(fluid.logLevel.IMPORTANT,
                "An error occurred while trying to access the user's microphone. " +
                err);
        });
    };

    flock.audioStrategy.web.createScriptNode = function (context, audioSettings) {
        // TODO: Define an event for script process creation and factor this behaviour out.
        flock.audioStrategy.web.updateSampleRate(context, audioSettings);
        flock.audioStrategy.web.setupChannels(context, audioSettings);

        // Create the script processor and setup the audio context's
        // destination to the appropriate number of channels.
        var chans = audioSettings.chans,
            creatorName = context.createScriptProcessor ?
                "createScriptProcessor" : "createJavaScriptNode";

        var jsNode = context[creatorName](audioSettings.bufferSize, chans, chans);
        jsNode.channelCountMode = "explicit";
        jsNode.channelCount = chans;

        return jsNode;
    };

    flock.audioStrategy.web.bindAudioProcessEvent = function (jsNode, writerFn) {
        jsNode.onaudioprocess = writerFn;
    };

    flock.audioStrategy.web.disconnectNode = function (node) {
        node.disconnect(0);
    };

    flock.audioStrategy.web.contextConstructor = window.AudioContext || window.webkitAudioContext;

    fluid.demands("flock.audioStrategy.platform", "flock.platform.webAudio", {
        funcName: "flock.audioStrategy.web"
    });

}());
