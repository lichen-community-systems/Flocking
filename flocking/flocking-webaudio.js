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
    fluid.defaults("flock.enviro.webAudio", {
        gradeNames: ["flock.enviro.audioStrategy", "autoInit"],

        members: {
            preNode: null,
            jsNode: null,
            postNode: null
        },

        model: {
            isGenerating: false,
            hasInput: false
        }
    });

    flock.enviro.webAudio.finalInit = function (that) {

        that.startGeneratingSamples = function () {
            var m = that.model;

            if (that.preNode) {
                that.preNode.connect(that.jsNode);
            }

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
            if (that.preNode) {
                that.preNode.disconnect(0);
            }

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
                that.stop();
            }
        };

        that.insertInputNode = function (node) {
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

        that.insertOutputNode = function (node) {
            if (that.postNode) {
                that.removeOutputNode(that.postNode);
            }

            that.postNode = node;
        };

        that.removeInputNode = function () {
            flock.enviro.webAudio.removeNode(that.preNode);
            that.preNode = null;
            that.model.hasInput = false;
        };

        that.removeOutputNode = function () {
            flock.enviro.webAudio.removeNode(that.postNode);
            that.postNode = that.jsNode;
        };

        that.startReadingAudioInput = function () {
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

        that.stopReadingAudioInput = function () {
            that.removeInputNode();
        };

        that.init = function () {
            var m = that.model,
                settings = that.options.audioSettings,
                scriptNodeConstructorName;

            m.krPeriods = settings.bufferSize / settings.blockSize;

            // Singleton AudioContext since the WebKit implementation
            // freaks if we try to instantiate a new one.
            if (!flock.enviro.webAudio.audioContext) {
                flock.enviro.webAudio.audioContext = new flock.enviro.webAudio.contextConstructor();
            }

            that.context = flock.enviro.webAudio.audioContext;
            settings.rates.audio = that.context.sampleRate;
            scriptNodeConstructorName = that.context.createScriptProcessor ?
                "createScriptProcessor" : "createJavaScriptNode";
            that.jsNode = that.context[scriptNodeConstructorName](settings.bufferSize);
            that.insertOutputNode(that.jsNode);
            that.jsNode.onaudioprocess = that.writeSamples;

            m.shouldInitIOS = flock.platform.isIOS;
        };

        that.init();
    };

    flock.enviro.webAudio.removeNode = function (node) {
        node.disconnect(0);
    };

    flock.enviro.webAudio.contextConstructor = window.AudioContext || window.webkitAudioContext;

    fluid.demands("flock.enviro.audioStrategy", "flock.platform.webAudio", {
        funcName: "flock.enviro.webAudio"
    });

}());
