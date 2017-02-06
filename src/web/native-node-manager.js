/*
 * Flocking Web Audio Native Node Manager
 * http://github.com/colinbdclark/flocking
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
     * Manages a collection of input nodes and an output node,
     * with a JS node in between.
     *
     * Note: this component is slated for removal when Web Audio
     * "islands" are implemented.
     */
    fluid.defaults("flock.webAudio.nativeNodeManager", {
        gradeNames: ["fluid.component"],

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
                args: ["{scriptProcessor}.node"]
            }
        },

        events: {
            // TODO: Normalize these with other components
            // that reference the same events. Bump them up to {audioSystem}
            // or use cross-component listener references?
            onStart: "{enviro}.events.onStart",
            onStop: "{enviro}.events.onStop",
            onReset: "{enviro}.events.onReset",

            onCreateScriptProcessor: null,
            onConnect: null,
            onDisconnectNodes: null,
            onDisconnect: null
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
                "{that}.connect()"
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
                "{that}.disconnect()"
            ],

            onDisconnectNodes: [
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

            "onDisconnect.onDisconnectNodes": {
                 func: "{that}.events.onDisconnectNodes.fire",
            },

            onReset: [
                "{that}.removeAllInputs()",
                "{that}.events.onCreateScriptProcessor.fire()"
            ],

            onDestroy: [
                "{that}.events.onDisconnectNodes.fire()",
                "{that}.removeAllInputs()",
                "flock.webAudio.nativeNodeManager.disconnectOutput({that})"
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

    flock.webAudio.nativeNodeManager.disconnectOutput = function (that) {
        if (that.outputNode) {
            that.outputNode.disconnect(0);
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
        flock.webAudio.nativeNodeManager.disconnectOutput(that);
        that.outputNode = node;

        return node;
    };

    flock.webAudio.nativeNodeManager.removeOutput = function (jsNode) {
        // Replace the current output node with the jsNode.
        flock.webAudio.nativeNodeManager.insertOutput(jsNode);
    };

}());
