/*
 * Flocking Synth Group
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2015, Colin Clark
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

    fluid.defaults("flock.synth.group", {
        gradeNames: ["flock.nodeList", "flock.node"],

        methodEventMap: {
            "onSet": "set"
        },

        invokers: {
            play: "{that}.events.onPlay.fire",
            pause: "{that}.events.onPause.fire",
            set: "{that}.events.onSet.fire",
            get: "flock.synth.group.get({arguments}, {that}.nodes)",
            input: {
                funcName: "flock.synth.group.input",
                args: ["{arguments}", "{that}.get", "{that}.events.onSet.fire"]
            },
            gen: {
                funcName: "flock.synth.group.gen",
                args: "{that}"
            }
        },

        events: {
            onSet: null,
            onGen: null,
            onPlay: null,
            onPause: null
        },

        listeners: {
            onInsert: [
                {
                    funcName: "flock.synth.group.bindMethods",
                    args: [
                        "{arguments}.0", // The newly added node.
                        "{that}.options.methodEventMap",
                        "{that}.events",
                        "addListener"
                    ]
                },

                {
                    funcName: "flock.node.removeFromEnvironment",
                    args: ["{arguments}.0", "{that}.enviro"]
                }
            ],

            onRemove: {
                funcName: "flock.synth.group.bindMethods",
                args: [
                    "{arguments}.0", // The removed node.
                    "{that}.options.methodEventMap",
                    "{that}.events",
                    "removeListener"
                ]
            }
        }
    });

    flock.synth.group.gen = function (that) {
        flock.nodeEvaluator.gen(that.nodes);
    };

    flock.synth.group.get = function (args, nodes) {
        var tailIdx = nodes.length - 1,
            tailNode = nodes[tailIdx];

        return tailNode.get.apply(tailNode, args);
    };

    flock.synth.group.input = function (args, onGet, onSet) {
        var evt = args.length > 1 ? onSet : onGet;
        return evt.apply(null, args);
    };

    flock.synth.group.bindMethods = function (node, methodEventMap, events, eventActionName) {
        for (var eventName in methodEventMap) {
            var methodName = methodEventMap[eventName],
                method = node[methodName],
                firer = events[eventName],
                eventAction = firer[eventActionName];

            eventAction(method);
        }
    };
}());
