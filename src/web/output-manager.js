/*
 * Flocking Web Audio Output Manager
 * https://github.com/colinbdclark/flocking
 *
 * Copyright 2013-2015, Colin Clark
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

    /**
     * Web Audio API Output Manager
     */
    fluid.defaults("flock.webAudio.outputManager", {
        gradeNames: ["flock.outputManager"],

        model: {
            isGenerating: false,
            audioSettings: {}
        },

        invokers: {
            bindAudioProcess: {
                funcName: "flock.webAudio.outputManager.bindAudioProcess",
                args: [
                    "{enviro}.nodeList",
                    "{busManager}.buses",
                    "{nativeNodeManager}",
                    "{that}.model"
                ]
            },

            unbindAudioProcess: {
                funcName: "flock.webAudio.outputManager.unbindAudioProcess",
                args: ["{nativeNodeManager}"]
            }
        },

        listeners: {
            "{nativeNodeManager}.events.onConnect": [
                "{that}.bindAudioProcess()"
            ],

            "{nativeNodeManager}.events.onDisconnect": [
                "{that}.unbindAudioProcess()"
            ],

            onStart: [
                {
                    func: "{that}.applier.change",
                    args: ["isGenerating", true]
                },
                {
                    // Satisfy Safari and Chrome's user interaction
                    // requirement, where it requires an AudioContext
                    // to be explicitly resumed within a user action
                    // event of some kind. For this to work,
                    // the Flocking environment must be started within
                    // a user-triggered event handler,
                    // such as with Flocking's built-in
                    // flock.ui.enviroPlayButton UI component.
                    priority: "last",
                    "this": "{audioSystem}.context",
                    method: "resume"
                }
            ],

            onStop: [
                {
                    func: "{that}.applier.change",
                    args: ["isGenerating", false]
                }
            ],

            "onDestroy.unbindAudioProcess": "{that}.unbindAudioProcess()"
        }
    });

    flock.webAudio.outputManager.bindAudioProcess = function (nodeList, buses,
        nativeNodeManager, model) {
        var jsNode = nativeNodeManager.scriptProcessor.node;

        jsNode.model = model;
        jsNode.nodeList = nodeList;
        jsNode.buses = buses;
        jsNode.inputNodes = nativeNodeManager.inputNodes;
        jsNode.onaudioprocess = flock.webAudio.outputManager.writeSamples;
    };

    flock.webAudio.outputManager.unbindAudioProcess = function (nativeNodeManager) {
        nativeNodeManager.scriptProcessor.node.onaudioprocess = undefined;
    };

    /**
     * Writes samples to a ScriptProcessorNode's output buffers.
     *
     * This function must be bound as a listener to the node's
     * onaudioprocess event. It expects to be called in the context
     * of a "this" instance containing the following properties:
     *  - model: the outputManager's model
     *  - inputNodes: a list of native input nodes to be read into input buses
     *  - nodeEvaluator: a nodeEvaluator instance
     */
    flock.webAudio.outputManager.writeSamples = function (e) {
        var numInputNodes = this.inputNodes ? this.inputNodes.length : 0,
            nodes = this.nodeList.nodes,
            s = this.model.audioSettings,
            inBufs = e.inputBuffer,
            outBufs = e.outputBuffer,
            numBlocks = s.numBlocks,
            buses = this.buses,
            numBuses = s.numBuses,
            blockSize = s.blockSize,
            chans = s.chans,
            inChans = inBufs.numberOfChannels,
            chan,
            i,
            samp;

        // If there are no nodes providing samples, write out silence.
        if (nodes.length < 1) {
            for (chan = 0; chan < chans; chan++) {
                flock.clearBuffer(outBufs.getChannelData(chan));
            }
            return;
        }

        // TODO: Make a formal distinction between input buses,
        // output buses, and interconnect buses in the environment!
        for (i = 0; i < numBlocks; i++) {
            var offset = i * blockSize;

            flock.evaluate.clearBuses(buses, numBuses, blockSize);

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

            flock.evaluate.synths(nodes);

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
}());
