/*!
* Flocking Core Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2015, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, QUnit, module, test, ok, equal, deepEqual*/
var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.registerNamespace("flock.test.core");

    var environment = flock.silentEnviro();

    var $ = fluid.registerNamespace("jQuery");


    module("nodeList and ugenNodeList");

    test("flock.nodeList", function () {
        var nl = new flock.nodeList();
        equal(nl.nodes.length, 0,
            "When a NodeList is instantiated, it should contain no nodes.");

        var testNodes = [{name: "first"}, {cat: "second"}, {id: "third"}];
        flock.nodeList.head(nl, testNodes[0]);
        equal(nl.nodes.length, 1,
            "The node should have been added to the list.");
        ok(flock.nodeList.isNodeActive(nl, testNodes[0]),
            "The node should be active in the list.");
        equal(nl.nodes[0], testNodes[0],
            "The node should have been added at the correct index.");
        equal(1, Object.keys(nl.namedNodes).length,
            "The node should have also been added to the collection of namedNodes.");

        flock.nodeList.remove(nl, testNodes[0]);
        equal(nl.nodes.length, 0,
            "The node should have been removed from the list");
        ok(!flock.nodeList.isNodeActive(nl, testNodes[0]),
            "The node should not be active in the list.");
        equal(0, Object.keys(nl.namedNodes).length,
            "The node should have also been removed from the collection of namedNodes.");

        flock.nodeList.remove(nl, testNodes[0]);
        equal(nl.nodes.length, 0,
            "Removing a node that is not in the list should not cause errors, and the list should remain the same.");
        equal(0, Object.keys(nl.namedNodes).length,
            "The collection of namedNodes should also remain the same.");

        flock.nodeList.head(nl, testNodes[2]);
        flock.nodeList.head(nl, testNodes[0]);
        deepEqual(nl.nodes, [testNodes[0], testNodes[2]],
            "Adding a node to the head of the list should put it in the correct position.");
        deepEqual(nl.namedNodes, {"first": testNodes[0], "third": testNodes[2]},
            "The collection of namedNodes should contain all nodes with a valid name or id.");

        flock.nodeList.tail(nl, testNodes[0]);
        deepEqual(nl.nodes, [testNodes[0], testNodes[2], testNodes[0]],
            "Adding a node twice should include it twice, in the correct positions.");
        deepEqual(nl.namedNodes, {"first": testNodes[0], "third": testNodes[2]},
            "The collection of namedNodes should remain the same.");

        flock.nodeList.remove(nl, testNodes[0]);
        deepEqual(nl.nodes, [testNodes[2], testNodes[0]],
            "Removing a duplicate node should remove the first one.");
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "But the node will be removed entirely from the namedNodes collection.");

        flock.nodeList.insert(nl, testNodes[1], 1);
        deepEqual(nl.nodes, [testNodes[2], testNodes[1], testNodes[0]],
            "Adding a node at a specific position should work.");
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "A unit generator without a name or id should not be added to namedNodes.");
        flock.nodeList.remove(nl, testNodes[1]);
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "The collection of namedNodes should not change when a node without a name or id is removed.");

        flock.nodeList.before(nl, testNodes[1], testNodes[0]);
        deepEqual(nl.nodes, [testNodes[2], testNodes[1], testNodes[0]],
            "Adding a node before another node should work.");
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same.");

        flock.nodeList.after(nl, testNodes[1], testNodes[0]);
        deepEqual(nl.nodes, [testNodes[2], testNodes[1], testNodes[0], testNodes[1]],
            "Adding a duplicate node after another node should work.");
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same.");

        flock.nodeList.remove(nl, testNodes[1]);
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same after an unnamed node is removed.");

        flock.nodeList.remove(nl, testNodes[0]);
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same after a named node is removed, which a duplicated of had already been removed.");

        flock.nodeList.after(nl, testNodes[0], testNodes[2]);
        deepEqual(nl.nodes, [testNodes[2], testNodes[0], testNodes[1]],
            "Adding a node after another node should work.");
        deepEqual(nl.namedNodes, {"first": testNodes[0], "third": testNodes[2]},
            "namedNodes should have been updated.");
    });

    test("nodeList.clearAll()", function () {
        var nl = new flock.nodeList();
        equal(nl.nodes.length, 0,
            "When a NodeList is instantiated, it should contain no nodes.");

        var testNodes = [{name: "first"}, {cat: "second"}, {id: "third"}];
        fluid.each(testNodes, function (node) {
            flock.nodeList.tail(nl, node);
        });

        equal(nl.nodes.length, 3,
            "When a NodeList has stuff added to it, it should have stuff in it.");

        flock.nodeList.clearAll(nl);
        equal(nl.nodes.length, 0,
            "After a NodeList has been cleared, it should have no nodes in its list.");
        deepEqual(nl.namedNodes, {},
            "After a NodeList has been cleared, it should have no named nodes.");
    });

    test("flock.ugenNodeList", function () {
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
        equal(ugnl.nodes.length, 0,
            "When a ugenNodeList is instantiated, it should contain no nodes.");
        equal(Object.keys(ugnl.namedNodes).length, 0,
            "When a ugenNodeList is instantiated, it should contain no named nodes.");

        flock.ugenNodeList.insertTree(ugnl, testNodes[0], 0);
        deepEqual(ugnl.nodes, [testNodes[0].inputs.cat.inputs.dog, testNodes[0].inputs.cat, testNodes[0]],
            "The list of nodes should include the node and all its inputs and grandinputs.");
        deepEqual(ugnl.namedNodes, {
            "1": testNodes[0],
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat
        }, "The named nodes collection should contain the added unit generator and all its inputs.");

        flock.ugenNodeList.removeTree(ugnl, testNodes[0]);
        equal(ugnl.nodes.length, 0,
            "After removing the unit generator and all its inputs, there should be no active nodes.");
        deepEqual(ugnl.namedNodes, {}, "Nor any named nodes.");

        flock.ugenNodeList.insertTree(ugnl, testNodes[2], 0);
        equal(ugnl.nodes.length, 2, "The node list should contain the inserted node and its input.");
        deepEqual(ugnl.namedNodes, {
            "3": testNodes[2],
            "3.1": testNodes[2].inputs.hamster
        }, "The named nodes collection should also contain the inserted nodes.");

        flock.ugenNodeList.removeTree(ugnl, testNodes[2].inputs.hamster);
        equal(ugnl.nodes.length, 1, "The specified node should have been removed, but not its parent node.");
        deepEqual(ugnl.namedNodes, {
            "3": testNodes[2]
        }, "The node should have been removed from the named nodes collection.");

        flock.ugenNodeList.insertTree(ugnl, testNodes[0], 0);
        equal(ugnl.nodes.length, 4, "The node and its inputs should have been added.");
        deepEqual(ugnl.namedNodes, {
            "1": testNodes[0],
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat,
            "3": testNodes[2]
        }, "The named nodes collection should contain the added unit generator and all its inputs.");

        flock.ugenNodeList.swapTree(ugnl, testNodes[1], testNodes[0]);
        equal(ugnl.nodes.length, 4, "The new node should have been swapped in, leaving all the previous inputs.");
        deepEqual(ugnl.namedNodes, {
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat,
            "2": testNodes[1],
            "3": testNodes[2]
        }, "The new node should have been added to the named nodes, leaving the others untouched.");

        flock.ugenNodeList.removeTree(ugnl, testNodes[1]);
        deepEqual(ugnl.namedNodes, {
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
        equal(ugnl.nodes.length, 4);
        deepEqual(ugnl.namedNodes, {
            "1": testNodes[0],
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat,
            "4.2": multiInputNode.inputs.goose,
        }, "The new node should have been added along with its inputs, and the specified inputs should have been swapped..");

        flock.ugenNodeList.replaceTree(ugnl, testNodes[2], testNodes[0]);
        equal(ugnl.nodes.length, 2);
        deepEqual(ugnl.namedNodes, {
            "3": testNodes[2],
            "3.1": testNodes[2].inputs.hamster
        }, "The old node and all its inputs should be replaced by the new one and its inputs.");
    });

    var testRemoval = function (synthDef, testSpecs) {
        var synth = flock.synth({
            synthDef: synthDef
        });

        $.each(testSpecs, function (i, spec) {
            var toRemove = spec.ugenToRemove;
            if (toRemove) {
                toRemove = typeof (toRemove) === "string" ? flock.get(synth, toRemove) : toRemove;
                flock.ugenNodeList.removeTree(synth.nodeList, toRemove, true);
            }
            equal(synth.nodeList.nodes.length, spec.expected.all,
                spec.msg + ", there should be " + spec.expected.all + " all ugens.");
            equal(Object.keys(synth.nodeList.namedNodes).length, spec.expected.named,
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

    test("flock.ugenNodeList: removing ugens", function () {
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

    test("flock.ugenNodeList.replace(): reattach inputs", function () {
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

        equal(synth.nodeList.namedNodes.gerbil, newUGen,
            "The old ugen should have been replaced by the new one.");
        equal(synth.nodeList.namedNodes.gerbil.inputs.ear, expectedInput,
            "The old ugen's input should have been copied over to the new one.");
        // TODO: Why is this failing?
        //deepEqual(synth.out.inputs.sources.inputs.gerbil, newUGen, "The new ugen's output should be wired back up.");
    });


    var checkTypedArrayProperty = function (componentType, propertyPath, componentOptions) {
        var component = fluid.invokeGlobalFunction(componentType, [componentOptions]);
        var property = fluid.get(component, propertyPath);
        var isTyped = property instanceof Float32Array;
        ok(isTyped, "A typed array stored as a component default should not be corrupted.");
    };

    test("Typed Array Merge Preservation", function () {
        var ta = new Float32Array([1.1, 2.2, 3.3]);
        ok(ta instanceof Float32Array, "Sanity check: a Float32Array should be an instance of a Float32Array.");
        ok(!fluid.isPlainObject(ta), "fluid.isPlainObject() should not recognize a typed array as a primitive.");
        ok(!fluid.isPrimitive(ta), "fluid.isPrimitive() should not recognize a typed array as a primitive.");

        fluid.defaults("flock.test.typedArrayComponent", {
            gradeNames: ["fluid.component"],
            synthDef: {
                cat: ta
            }
        });

        // Check the property after it has been stored in fluid.defaults().
        var defaultProperty = fluid.defaults("flock.test.typedArrayComponent").synthDef.cat;
        ok(defaultProperty instanceof Float32Array);

        // Instantiate the component with no options and check the typed array property.
        checkTypedArrayProperty("flock.test.typedArrayComponent", "options.synthDef.cat");

        // Specify, in options, a typed array and check that it is not merged.
        checkTypedArrayProperty("flock.test.typedArrayComponent", "options.synthDef.cat", {
            synthDef: {
                cat: new Float32Array([4.4, 5.5, 6.6])
            }
        });
    });

    fluid.defaults("flock.test.componentWithTypedArrayOption", {
        gradeNames: "fluid.component",
        buffer: new Float32Array([1, 1, 1, 1])
    });

    test("Typed Array Component Merging", function () {
        var c = flock.test.componentWithTypedArrayOption();
        deepEqual(c.options.buffer, new Float32Array([1, 1, 1, 1]),
            "The component's typed array should be set to the default value.");

        c = flock.test.componentWithTypedArrayOption({
            buffer: new Float32Array([2, 2, 2, 2])
        });
        deepEqual(c.options.buffer, new Float32Array([2, 2, 2, 2]),
            "The component's typed array should have been overriden.");
    });


    module("flock.band tests");

    test("flock.band with multiple addToEnvironment synths", function () {
        flock.nodeList.clearAll(environment.nodeList);

        var def = {
            ugen: "flock.ugen.sin"
        };

        var band = flock.band({
            components: {
                dog: {
                    type: "flock.synth",
                    options: {
                        synthDef: def,
                        addToEnvironment: "tail"
                    }
                },

                cat: {
                    type: "flock.synth",
                    options: {
                        synthDef: def,
                        addToEnvironment: "head"
                    }
                },

                hamster: {
                    type: "flock.synth",
                    options: {
                        synthDef: def,
                        addToEnvironment: "tail"
                    }
                }
            }
        });

        equal(environment.nodeList.nodes.length, 3,
            "Three synth nodes should have been added to the shared environment.");

        equal(environment.nodeList.nodes[0], band.cat,
            "The first node in the list should be the synth that declared itself at the head.");

        // TODO: This test probably doesn't belong here.
        equal(band.cat.enviro.nodeList.nodes,
            environment.nodeList.nodes,
            "The synths' enviro's audio strategy's node evaluator should share the same node list" +
            "as the environment itself.");
    });

    test("getSynths", function () {
        fluid.defaults("flock.test.band", {
            gradeNames: "flock.band",

            components: {
                synth1: {
                    type: "flock.synth",
                    options: {
                        synthDef: {
                            ugen: "flock.ugen.sin"
                        }
                    }
                },

                synth2: {
                    type: "flock.synth",
                    options: {
                        synthDef: {
                            ugen: "flock.ugen.sin"
                        }
                    }
                },

                nonSynth: {
                    type: "fluid.component"
                }
            }
        });

        var b = flock.test.band();
        var synths = b.getSynths();

        equal(synths.length, 2,
            "The correct number of synths were returned from getSynths().");

        fluid.each(synths, function (synth) {
            ok(fluid.hasGrade(synth.options, "flock.synth"),
                "All synths returned from getSynths() are of the appropriate grade.");
        });
    });

    test("Options clamping", function () {
        var enviro = flock.init({
            chans: 64,
            numInputBuses: 128
        });

        var audioSystemDefaults = fluid.defaults("flock.audioSystem"),
            defaultInputBusRange = audioSystemDefaults.inputBusRange,
            defaultMaxChans = audioSystemDefaults.channelRange.max;
        ok(enviro.audioSystem.model.chans <= defaultMaxChans,
            "The environment's number of channels should be clamped at " + defaultMaxChans);
        equal(enviro.audioSystem.model.numInputBuses, defaultInputBusRange.max,
            "The environment's number of input buses should be clamped at " + defaultInputBusRange.max);
        ok(enviro.audioSystem.model.numInputBuses >= defaultInputBusRange.min,
            "The environment should have at least " + defaultInputBusRange.min + " input buses.");

        enviro = flock.init({
            chans: 1,
            numBuses: 1
        });
        ok(enviro.audioSystem.model.numBuses >= 2,
            "The environment should always have two or more buses.");

        enviro = flock.init({
            chans: 8,
            numBuses: 4
        });
        ok(enviro.audioSystem.model.numBuses >= enviro.audioSystem.model.chans,
            "The environment should always have at least as many buses as channels.");
    });

    test("Options merging", function () {
        var enviro = flock.init({
            numBuses: 24,
            chans: 1
        });

        var expectedNumChans = !flock.platform.browser.safari ? 1 : enviro.audioSystem.context.destination.channelCount;
        equal(enviro.audioSystem.model.chans, expectedNumChans,
            "The environment should have been configured with the specified chans option (except on Safari).");

        equal(enviro.audioSystem.model.numBuses, 24,
            "The environment should have been configured with the specified number of buses");

        equal(enviro.busManager.buses.length, 24,
            "The environment should actually have the specified number of buses.");
    });


    module("Bus tests");

    flock.test.core.runBusTests = function (type, numBuses, enviroOpts, expectedCalcFn) {
        var enviro = flock.init(enviroOpts),
            actualBusNum,
            expectedBusNum;

        for (var i = 0; i < numBuses; i++) {
            actualBusNum = enviro.busManager.acquireNextBus(type);
            expectedBusNum = expectedCalcFn(i, enviro);
            equal(actualBusNum, expectedBusNum,
                "The correct " + type + " bus number should have been returned.");
        }

        try {
            enviro.busManager.acquireNextBus(type);
            ok(false, "An error should have been thrown when " +
                "trying to acquire more than the available number of buses.");
        } catch (e) {
            ok(e.message.indexOf("insufficient buses available") > -1,
                "The correct error should be thrown when trying to acquire " +
                "more than the available number of buses.");
        }
    };

    test("Input bus acquisition", function () {
        var enviroOpts = {
            chans: 1,
            numBuses: 10,
            numInputBuses: 2
        };

        flock.test.core.runBusTests("input", 2, enviroOpts, function (runIdx, enviro) {
            return runIdx + enviro.audioSystem.model.chans;
        });
    });

    test("Interconnect bus acquisition", function () {
        var enviroOpts = {
            chans: 2,
            numBuses: 6,
            numInputBuses: 2
        };

        flock.test.core.runBusTests("interconnect", 2, enviroOpts, function (runIdx, enviro) {
            return runIdx + enviro.audioSystem.model.chans + enviro.audioSystem.model.numInputBuses;
        });
    });

    flock.test.core.testBusAcquisition = function (enviro, expected, msg) {
        var busNum = enviro.busManager.acquireNextBus("interconnect");
        QUnit.equal(busNum, expected, msg);
    };

    test("Bus acquisition after environment reset", function () {
        var enviroOptions = {
            chans: 2,
            numBuses: 6,
            numInputBuses: 2
        };

        var enviro = flock.init(enviroOptions);
        flock.test.core.testBusAcquisition(enviro, 4, "The first interconnect bus should have been acquired.");
        enviro.reset();
        flock.test.core.testBusAcquisition(enviro, 4,
            "The first interconnectBus should have been acquired again after resetting the environment.");
    });

    module("Random number generators");

    test("flock.randomAudioValue()", function () {
        var buf = new Float32Array(100000);
        flock.fillBuffer(buf, flock.randomAudioValue);
        flock.test.signalInRange(buf, -1.0, 1.0);
    });

    test("flock.randomValue()", function () {
        var buf = new Float32Array(100000);
        flock.fillBuffer(buf, function () {
            return flock.randomValue(-12, 2);
        });
        flock.test.signalInRange(buf, -12.0, 2.0);
    });
}());
