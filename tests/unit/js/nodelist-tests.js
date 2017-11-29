/*!
* Flocking NodeList Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2017, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/
var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    QUnit.module("nodeList and ugenNodeList");

    QUnit.test("flock.nodeList", function () {
        var nl = new flock.nodeList();
        QUnit.equal(nl.nodes.length, 0,
            "When a NodeList is instantiated, it should contain no nodes.");

        var testNodes = [{name: "first"}, {cat: "second"}, {id: "third"}];
        flock.nodeList.head(nl, testNodes[0]);
        QUnit.equal(nl.nodes.length, 1,
            "The node should have been added to the list.");
        QUnit.ok(flock.nodeList.isNodeActive(nl, testNodes[0]),
            "The node should be active in the list.");
        QUnit.equal(nl.nodes[0], testNodes[0],
            "The node should have been added at the correct index.");
        QUnit.equal(1, Object.keys(nl.namedNodes).length,
            "The node should have also been added to the collection of namedNodes.");

        flock.nodeList.remove(nl, testNodes[0]);
        QUnit.equal(nl.nodes.length, 0,
            "The node should have been removed from the list");
        QUnit.ok(!flock.nodeList.isNodeActive(nl, testNodes[0]),
            "The node should not be active in the list.");
        QUnit.equal(0, Object.keys(nl.namedNodes).length,
            "The node should have also been removed from the collection of namedNodes.");

        flock.nodeList.remove(nl, testNodes[0]);
        QUnit.equal(nl.nodes.length, 0,
            "Removing a node that is not in the list should not cause errors, and the list should remain the same.");
        QUnit.equal(0, Object.keys(nl.namedNodes).length,
            "The collection of namedNodes should also remain the same.");

        flock.nodeList.head(nl, testNodes[2]);
        flock.nodeList.head(nl, testNodes[0]);
        QUnit.deepEqual(nl.nodes, [testNodes[0], testNodes[2]],
            "Adding a node to the head of the list should put it in the correct position.");
        QUnit.deepEqual(nl.namedNodes, {"first": testNodes[0], "third": testNodes[2]},
            "The collection of namedNodes should contain all nodes with a valid name or id.");

        flock.nodeList.tail(nl, testNodes[0]);
        QUnit.deepEqual(nl.nodes, [testNodes[0], testNodes[2], testNodes[0]],
            "Adding a node twice should include it twice, in the correct positions.");
        QUnit.deepEqual(nl.namedNodes, {"first": testNodes[0], "third": testNodes[2]},
            "The collection of namedNodes should remain the same.");

        flock.nodeList.remove(nl, testNodes[0]);
        QUnit.deepEqual(nl.nodes, [testNodes[2], testNodes[0]],
            "Removing a duplicate node should remove the first one.");
        QUnit.deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "But the node will be removed entirely from the namedNodes collection.");

        flock.nodeList.insert(nl, testNodes[1], 1);
        QUnit.deepEqual(nl.nodes, [testNodes[2], testNodes[1], testNodes[0]],
            "Adding a node at a specific position should work.");
        QUnit.deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "A unit generator without a name or id should not be added to namedNodes.");
        flock.nodeList.remove(nl, testNodes[1]);
        QUnit.deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "The collection of namedNodes should not change when a node without a name or id is removed.");

        flock.nodeList.before(nl, testNodes[1], testNodes[0]);
        QUnit.deepEqual(nl.nodes, [testNodes[2], testNodes[1], testNodes[0]],
            "Adding a node before another node should work.");
        QUnit.deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same.");

        flock.nodeList.after(nl, testNodes[1], testNodes[0]);
        QUnit.deepEqual(nl.nodes, [testNodes[2], testNodes[1], testNodes[0], testNodes[1]],
            "Adding a duplicate node after another node should work.");
        QUnit.deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same.");

        flock.nodeList.remove(nl, testNodes[1]);
        QUnit.deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same after an unnamed node is removed.");

        flock.nodeList.remove(nl, testNodes[0]);
        QUnit.deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same after a named node is removed, which a duplicated of had already been removed.");

        flock.nodeList.after(nl, testNodes[0], testNodes[2]);
        QUnit.deepEqual(nl.nodes, [testNodes[2], testNodes[0], testNodes[1]],
            "Adding a node after another node should work.");
        QUnit.deepEqual(nl.namedNodes, {"first": testNodes[0], "third": testNodes[2]},
            "namedNodes should have been updated.");
    });

    QUnit.test("nodeList.clearAll()", function () {
        var nl = new flock.nodeList();
        QUnit.equal(nl.nodes.length, 0,
            "When a NodeList is instantiated, it should contain no nodes.");

        var testNodes = [{name: "first"}, {cat: "second"}, {id: "third"}];
        fluid.each(testNodes, function (node) {
            flock.nodeList.tail(nl, node);
        });

        QUnit.equal(nl.nodes.length, 3,
            "When a NodeList has stuff added to it, it should have stuff in it.");

        flock.nodeList.clearAll(nl);
        QUnit.equal(nl.nodes.length, 0,
            "After a NodeList has been cleared, it should have no nodes in its list.");
        QUnit.deepEqual(nl.namedNodes, {},
            "After a NodeList has been cleared, it should have no named nodes.");
    });

    QUnit.test("flock.ugenNodeList", function () {
        var testNodes = [
            {
                id: "1",
                tags: ["flock.ugen"],
                inputs: {
                    cat: {
                        id: "1.2",
                        tags: ["flock.ugen"],
                        inputs: {
                            dog: {
                                id: "1.1",
                                tags: ["flock.ugen"]
                            }
                        }
                    }
                }
            },
            {
                id: "2",
                tags: ["flock.ugen"]
            },
            {
                id: "3",
                tags: ["flock.ugen"],
                inputs: {
                    hamster: {
                        id: 3.1,
                        tags: ["flock.ugen"]
                    }
                }
            }
        ];

        var ugnl = new flock.nodeList();
        QUnit.equal(ugnl.nodes.length, 0,
            "When a ugenNodeList is instantiated, it should contain no nodes.");
        QUnit.equal(Object.keys(ugnl.namedNodes).length, 0,
            "When a ugenNodeList is instantiated, it should contain no named nodes.");

        flock.ugenNodeList.insertTree(ugnl, testNodes[0], 0);
        QUnit.deepEqual(ugnl.nodes, [testNodes[0].inputs.cat.inputs.dog, testNodes[0].inputs.cat, testNodes[0]],
            "The list of nodes should include the node and all its inputs and grandinputs.");
        QUnit.deepEqual(ugnl.namedNodes, {
            "1": testNodes[0],
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat
        }, "The named nodes collection should contain the added unit generator and all its inputs.");

        flock.ugenNodeList.removeTree(ugnl, testNodes[0]);
        QUnit.equal(ugnl.nodes.length, 0,
            "After removing the unit generator and all its inputs, there should be no active nodes.");
        QUnit.deepEqual(ugnl.namedNodes, {}, "Nor any named nodes.");

        flock.ugenNodeList.insertTree(ugnl, testNodes[2], 0);
        QUnit.equal(ugnl.nodes.length, 2, "The node list should contain the inserted node and its input.");
        QUnit.deepEqual(ugnl.namedNodes, {
            "3": testNodes[2],
            "3.1": testNodes[2].inputs.hamster
        }, "The named nodes collection should also contain the inserted nodes.");

        flock.ugenNodeList.removeTree(ugnl, testNodes[2].inputs.hamster);
        QUnit.equal(ugnl.nodes.length, 1, "The specified node should have been removed, but not its parent node.");
        QUnit.deepEqual(ugnl.namedNodes, {
            "3": testNodes[2]
        }, "The node should have been removed from the named nodes collection.");

        flock.ugenNodeList.insertTree(ugnl, testNodes[0], 0);
        QUnit.equal(ugnl.nodes.length, 4, "The node and its inputs should have been added.");
        QUnit.deepEqual(ugnl.namedNodes, {
            "1": testNodes[0],
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat,
            "3": testNodes[2]
        }, "The named nodes collection should contain the added unit generator and all its inputs.");

        flock.ugenNodeList.swapTree(ugnl, testNodes[1], testNodes[0]);
        QUnit.equal(ugnl.nodes.length, 4, "The new node should have been swapped in, leaving all the previous inputs.");
        QUnit.deepEqual(ugnl.namedNodes, {
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat,
            "2": testNodes[1],
            "3": testNodes[2]
        }, "The new node should have been added to the named nodes, leaving the others untouched.");

        flock.ugenNodeList.removeTree(ugnl, testNodes[1]);
        QUnit.deepEqual(ugnl.namedNodes, {
            "3": testNodes[2]
        }, "The node and all its swapped inputs should have been removed.");

        var multiInputNode = {
            id: "4",
            inputs: {
                giraffe: {
                    id: 4.1,
                    tags: ["flock.ugen"]
                },
                goose: {
                    id: 4.2,
                    tags: ["flock.ugen"]
                }
            }
        };

        flock.ugenNodeList.removeTree(ugnl, testNodes[2]);
        flock.ugenNodeList.insertTree(ugnl, multiInputNode, 0);
        flock.ugenNodeList.swapTree(ugnl, testNodes[0], multiInputNode, ["goose"]);
        QUnit.equal(ugnl.nodes.length, 4);
        QUnit.deepEqual(ugnl.namedNodes, {
            "1": testNodes[0],
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat,
            "4.2": multiInputNode.inputs.goose,
        }, "The new node should have been added along with its inputs, and the specified inputs should have been swapped..");

        flock.ugenNodeList.replaceTree(ugnl, testNodes[2], testNodes[0]);
        QUnit.equal(ugnl.nodes.length, 2);
        QUnit.deepEqual(ugnl.namedNodes, {
            "3": testNodes[2],
            "3.1": testNodes[2].inputs.hamster
        }, "The old node and all its inputs should be replaced by the new one and its inputs.");
    });

    var testRemoval = function (synthDef, testSpecs) {
        var synth = flock.synth({
            synthDef: synthDef
        });

        fluid.each(testSpecs, function (spec) {
            var toRemove = spec.ugenToRemove;
            if (toRemove) {
                toRemove = typeof (toRemove) === "string" ? flock.get(synth, toRemove) : toRemove;
                flock.ugenNodeList.removeTree(synth.nodeList, toRemove, true);
            }
            QUnit.equal(synth.nodeList.nodes.length, spec.expected.all,
                spec.msg + ", there should be " + spec.expected.all + " all ugens.");
            QUnit.equal(Object.keys(synth.nodeList.namedNodes).length, spec.expected.named,
                spec.msg + ", there should be " + spec.expected.named + " named ugens.");
        });
    };

    var nestedSynthDef = {
        ugen: "flock.ugen.out",
        inputs: {
            sources: {
                ugen: "flock.test.ugen.mock",
                inputs: {
                    gerbil: {
                        id: "gerbil",
                        ugen: "flock.test.ugen.mock",
                        inputs: {
                            ear: {
                                id: "ear",
                                ugen: "flock.ugen.value",
                                value: 500
                            }
                        }
                    },
                    cat: {
                        id: "cat",
                        ugen: "flock.test.ugen.mock"
                    },
                    dog: {
                        ugen: "flock.test.ugen.mock"
                    }
                }
            },
            bus: 0,
            expand: 2
        }
    };

    QUnit.test("flock.ugenNodeList: removing ugens", function () {
        var removalTestSpecs = [
            {
                ugenToRemove: null,
                expected: {
                    all: 8,
                    named: 3
                },
                msg: "To start"
            },
            {
                ugenToRemove: "nodeList.namedNodes.ear",
                expected: {
                    all: 7,
                    named: 2
                },
                msg: "After removing a passive, named ugen"
            },
            {
                ugenToRemove: "nodeList.namedNodes.cat",
                expected: {
                    all: 6,
                    named: 1
                },
                msg: "After removing an active, named ugen"
            },
            {
                ugenToRemove: "out.inputs.sources.inputs.dog",
                expected: {
                    all: 5,
                    named: 1
                },
                msg: "After removing an active, unnamed ugen"
            },
            {
                ugenToRemove: "out",
                expected: {
                    all: 0,
                    named: 0
                },
                msg: "After removing a ugen with other inputs, its inputs should be recursively removed"
            }
        ];

        testRemoval(nestedSynthDef, removalTestSpecs);
    });

    QUnit.test("flock.ugenNodeList.replace(): reattach inputs", function () {
        var synth = flock.synth({
            synthDef: nestedSynthDef
        });

        var toReplace = synth.nodeList.namedNodes.gerbil,
            expectedInput = synth.nodeList.namedNodes.ear,
            newUGen = flock.parse.ugenForDef({
                id: "gerbil",
                ugen: "flock.test.ugen.mock"
            });
        flock.ugenNodeList.swapTree(synth.nodeList, newUGen, toReplace);

        QUnit.equal(synth.nodeList.namedNodes.gerbil, newUGen,
            "The old ugen should have been replaced by the new one.");
        QUnit.equal(synth.nodeList.namedNodes.gerbil.inputs.ear, expectedInput,
            "The old ugen's input should have been copied over to the new one.");
    });

}());
