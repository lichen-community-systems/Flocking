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
        gradeNames: ["flock.node", "flock.noteTarget"],

        methodEventMap: {
            "onSet": "set"
        },

        members: {
            nodeList: "@expand:flock.nodeList()",
            genFn: "@expand:fluid.getGlobalValue(flock.evaluate.synths)"
        },

        invokers: {
            play: "{that}.events.onPlay.fire",
            pause: "{that}.events.onPause.fire",
            set: "{that}.events.onSet.fire",
            get: "flock.synth.group.get({arguments}, {that}.nodeList.nodes)",
            head: "flock.synth.group.head({arguments}.0, {that})",
            tail: "flock.synth.group.tail({arguments}.0, {that})",
            insert: "flock.synth.group.insert({arguments}.0, {arguments}.1, {that})",
            before: "flock.synth.group.before({arguments}.0, {arguments}.1, {that})",
            after: "flock.synth.group.after({arguments}.0, {arguments}.1, {that})",
            remove: "{that}.events.onRemove.fire",

            // Deprecated. Use set() instead.
            input: {
                funcName: "flock.synth.group.input",
                args: ["{arguments}", "{that}.get", "{that}.events.onSet.fire"]
            }
        },

        events: {
            onSet: null,
            onGen: null,
            onPlay: null,
            onPause: null,
            onInsert: null,
            onRemove: null
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

                "flock.synth.group.removeNodeFromEnvironment({arguments}.0)"
            ],

            onRemove: [
                {
                    funcName: "flock.synth.group.bindMethods",
                    args: [
                        "{arguments}.0", // The removed node.
                        "{that}.options.methodEventMap",
                        "{that}.events",
                        "removeListener"
                    ]
                },
                {
                    "this": "{that}.nodeList",
                    method: "remove",
                    args: ["{arguments}.0"]
                }
            ]
        }
    });

    flock.synth.group.head = function (node, that) {
        flock.nodeList.head(that.nodeList, node);
        that.events.onInsert.fire(node);
    };

    flock.synth.group.tail = function (node, that) {
        flock.nodeList.tail(that.nodeList, node);
        that.events.onInsert.fire(node);
    };

    flock.synth.group.insert = function (node, idx, that) {
        flock.nodeList.insert(that.nodeList, node, idx);
        that.events.onInsert.fire(node);
    };

    flock.synth.group.before = function (nodeToInsert, targetNode, that) {
        flock.nodeList.before(that.nodeList, nodeToInsert, targetNode);
        that.events.onInsert.fire(nodeToInsert);
    };

    flock.synth.group.after = function (nodeToInsert, targetNode, that) {
        flock.nodeList.after(that.nodeList, nodeToInsert, targetNode);
        that.events.onInsert.fire(nodeToInsert);
    };

    flock.synth.group.removeNodeFromEnvironment = function (node) {
        node.removeFromEnvironment();
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
