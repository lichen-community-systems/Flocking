/*
 * Flocking Web Audio Core
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

    fluid.registerNamespace("flock.webAudio");

    flock.webAudio.createNode = function (context, nodeSpec) {
        var args = nodeSpec.args ? fluid.makeArray(nodeSpec.args) : undefined;

        var creatorName = "create" + nodeSpec.node,
            nodeStrIdx = creatorName.indexOf("Node");

        // Trim off "Node" if it is present.
        if (nodeStrIdx > -1) {
            creatorName = creatorName.substring(0, nodeStrIdx);
        }

        var node = context[creatorName].apply(context, args);
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


    fluid.defaults("flock.webAudio.node", {
        gradeNames: ["fluid.modelComponent"],

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
        gradeNames: ["flock.webAudio.node"],

        members: {
            node: "@expand:flock.webAudio.createNode({audioSystem}.context, {that}.options.nodeSpec)"
        },

        nodeSpec: {
            node: "Gain"
        }
    });


    fluid.defaults("flock.webAudio.scriptProcessor", {
        gradeNames: ["flock.webAudio.node"],

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
        gradeNames: ["flock.webAudio.node"],

        nodeSpec: {
            node: "ChannelMerger",
            args: ["{audioSystem}.model.numInputBuses"],
            properties: {
                channelCountMode: "discrete"
            }
        }
    });

    fluid.defaults("flock.webAudio.outputFader", {
        gradeNames: ["fluid.component"],

        fadeDuration: 0.5,

        gainSpec: {
            node: "Gain",

            params: {
                gain: 0.0
            },

            properties: {
                channelCount: "{flock.enviro}.audioSystem.model.chans",
                channelCountMode: "explicit"
            }
        },

        members: {
            gainNode: "@expand:flock.webAudio.outputFader.createGainNode({flock.enviro}.audioSystem.nativeNodeManager, {that}.options.gainSpec)",
            context: "{flock.enviro}.audioSystem.context"
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

    flock.webAudio.outputFader.createGainNode = function (nativeNodeManager, gainSpec) {
        var gainNode = nativeNodeManager.createOutputNode(gainSpec);
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

}());
