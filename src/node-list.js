/*
 * Flocking Node Lists
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

    /*************
     * Node List *
     *************/

    flock.nodeList = function () {
        return {
            nodes: [],
            namedNodes: {}
        };
    };

    flock.nodeList.insert = function (nodeList, node, idx) {
        if (idx < 0) {
            idx = 0;
        }

        nodeList.nodes.splice(idx, 0, node);
        flock.nodeList.registerNode(nodeList, node);

        return idx;
    };

    flock.nodeList.registerNode = function (nodeList, node) {
        var name = node.name || node.id;
        if (name) {
            nodeList.namedNodes[name] = node;
        }
    };

    flock.nodeList.head = function (nodeList, node) {
        return flock.nodeList.insert(nodeList, node, 0);
    };

    flock.nodeList.before = function (nodeList, nodeToInsert, targetNode) {
        var refIdx = nodeList.nodes.indexOf(targetNode);
        return flock.nodeList.insert(nodeList, nodeToInsert, refIdx);
    };

    flock.nodeList.after = function (nodeList, nodeToInsert, targetNode) {
        var refIdx = nodeList.nodes.indexOf(targetNode),
            atIdx = refIdx + 1;

        return flock.nodeList.insert(nodeList, nodeToInsert, atIdx);
    };

    flock.nodeList.tail = function (nodeList, node) {
        var idx = nodeList.nodes.length;
        return flock.nodeList.insert(nodeList, node, idx);
    };

    flock.nodeList.unregisterNode = function (nodeList, node) {
        var name = node.name || node.id;
        if (name) {
            delete nodeList.namedNodes[name];
        }
    };

    flock.nodeList.isNodeActive = function (nodeList, node) {
        var idx = nodeList.nodes.indexOf(node);
        return idx > -1;
    };

    flock.nodeList.remove = function (nodeList, node) {
        if (!nodeList) {
            return;
        }

        var idx = nodeList.nodes.indexOf(node);
        if (idx > -1) {
            nodeList.nodes.splice(idx, 1);
            flock.nodeList.unregisterNode(nodeList, node);
        }

        return idx;
    };

    flock.nodeList.replace = function (nodeList, nodeToInsert, nodeToReplace) {
        var idx = nodeList.nodes.indexOf(nodeToReplace);
        if (idx < 0) {
            return flock.nodeList.tail(nodeList, nodeToInsert);
        }

        nodeList.nodes[idx] = nodeToInsert;
        flock.nodeList.unregisterNode(nodeList, nodeToReplace);
        flock.nodeList.registerNode(nodeList, nodeToInsert);

        return idx;
    };

    flock.nodeList.clearAll = function (nodeList) {
        nodeList.nodes.length = 0;

        for (var nodeName in nodeList.namedNodes) {
            delete nodeList.namedNodes[nodeName];
        }
    };


    /******************
     * UGen Node List *
     ******************/

    flock.ugenNodeList = function () {
        return flock.nodeList();
    };

    flock.ugenNodeList.insertTree = function (nodeList, ugen, idx) {
        var inputs = ugen.inputs,
            key,
            input;

        for (key in inputs) {
            input = inputs[key];
            if (flock.isUGen(input)) {
                idx = flock.ugenNodeList.insertTree(nodeList, input, idx);
                idx++;
            }
        }

        return flock.nodeList.insert(nodeList, ugen, idx);
    };

    flock.ugenNodeList.removeTree = function (nodeList, ugen) {
        var inputs = ugen.inputs,
            key,
            input;

        for (key in inputs) {
            input = inputs[key];
            if (flock.isUGen(input)) {
                flock.ugenNodeList.removeTree(nodeList, input);
            }
        }

        return flock.nodeList.remove(nodeList, ugen);
    };

    flock.ugenNodeList.tailTree = function (nodeList, ugen) {
        // Can't use .tail() because it won't recursively add inputs.
        var idx = nodeList.nodes.length;
        return flock.ugenNodeList.insertTree(nodeList, ugen, idx);
    };

    flock.ugenNodeList.replaceTree = function (nodeList, ugenToInsert, ugenToReplace) {
        if (!ugenToReplace) {
            return flock.ugenNodeList.tailTree(nodeList, ugenToInsert);
        }

        var idx = flock.ugenNodeList.removeTree(nodeList, ugenToReplace);
        flock.ugenNodeList.insertTree(nodeList, ugenToInsert, idx);

        return idx;
    };

    flock.ugenNodeList.swapTree = function (nodeList, ugenToInsert, ugenToReplace, inputsToReattach) {
        if (!inputsToReattach) {
            ugenToInsert.inputs = ugenToReplace.inputs;
        } else {
            flock.ugenNodeList.reattachInputs(nodeList, ugenToInsert, ugenToReplace, inputsToReattach);
            flock.ugenNodeList.replaceInputs(nodeList, ugenToInsert, ugenToReplace, inputsToReattach);
        }

        return flock.nodeList.replace(nodeList, ugenToInsert, ugenToReplace);
    };

    flock.ugenNodeList.reattachInputs = function (nodeList, ugenToInsert, ugenToReplace, inputsToReattach) {
        for (var inputName in ugenToReplace.inputs) {
            if (inputsToReattach.indexOf(inputName) < 0) {
                flock.ugenNodeList.removeTree(nodeList, ugenToReplace.inputs[inputName]);
            } else {
                ugenToInsert.inputs[inputName] = ugenToReplace.inputs[inputName];
            }
        }
    };

    flock.ugenNodeList.replaceInputs = function (nodeList, ugenToInsert, ugenToReplace, inputsToReattach) {
        for (var inputName in ugenToInsert.inputs) {
            if (inputsToReattach.indexOf(inputName) < 0) {
                flock.ugenNodeList.replaceTree(nodeList,
                    ugenToInsert.inputs[inputName],
                    ugenToReplace.inputs[inputName]
                );
            }
        }
    };

    flock.makeUGens = function (synthDef, rate, ugenList, enviro, audioSettings) {
        if (!synthDef) {
            fluid.log(fluid.logLevel.IMPORTANT,
                "Warning: An empy synthDef was found while instantiating a unit generator tree." +
                "Did you forget to include a 'synthDef' option for your Synth?");
        }

        // At demand or schedule rates, override the rate of all non-constant ugens.
        var overrideRate = rate === flock.rates.SCHEDULED ||
            rate === flock.rates.DEMAND;

        // Parse the synthDef into a graph of unit generators.
        return flock.parse.synthDef(synthDef, enviro, {
            rate: rate,
            overrideRate: overrideRate,
            visitors: [flock.makeUGens.visitor(ugenList)],
            buffers: enviro.buffers,
            buses: enviro.busManager.buses,
            audioSettings: audioSettings || enviro.audioSystem.model
        });
    };

    flock.makeUGens.visitor = function (ugenList) {
        return function (ugen) {
            flock.nodeList.tail(ugenList, ugen);
        };
    };
}());
