/*
 * Flocking Group and Polyphonic Synth Tests
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

    QUnit.module("Group synth");

    var assertNodesHaveInputValue = function (nodes, ugenName, inputName, expected) {
        fluid.each(nodes, function (node, i) {
            var actual = node.nodeList.namedNodes[ugenName].input(inputName);
            QUnit.equal(expected, actual, "Node #" + i + " should have the correct value.");
        });
    };

    fluid.defaults("flock.test.synthGroup.base", {
        gradeNames: "flock.synth",
        addToEnvironment: false,

        model: {
            didGen: false
        },

        synthDef: {
            id: "mock",
            ugen: "flock.test.ugen.mock"
        },

        invokers: {
            genFn: {
                changePath: "didGen",
                value: true
            }
        }
    });

    fluid.defaults("flock.test.synthGroup.synth1", {
        gradeNames: "flock.test.synthGroup.base",

        synthDef: {
            freq: 110,
            mul: 0.1,
            options: {
                buffer: flock.generate(64, 1)
            }
        }
    });

    fluid.defaults("flock.test.synthGroup.synth2", {
        gradeNames: "flock.test.synthGroup.base",

        synthDef: {
            freq: 220,
            mul: 0.2,
            options: {
                buffer: flock.generate(64, 2)
            }
        }
    });

    QUnit.test("flock.synth.group", function () {
        var synth1 = flock.test.synthGroup.synth1();
        var synth2 = flock.test.synthGroup.synth2();

        var group = flock.synth.group({
            addToEnvironment: false
        });

        group.head(synth1);
        group.tail(synth2);
        QUnit.equal(group.nodeList.nodes.length, 2,
            "Both synths should have been added to the group.");

        var inputVal = group.input("mock.freq");
        QUnit.equal(inputVal, 220,
            "Getting an input on the group with input() should return the tail synth's value.");

        inputVal = group.get("mock.freq");
        QUnit.equal(inputVal, 220,
            "Getting an input on the group with get() should return the tail synth's value.");

        group.input("mock.freq", 440);
        assertNodesHaveInputValue(group.nodeList.nodes, "mock", "freq", 440);

        group.set("mock.mul", 0.5);
        assertNodesHaveInputValue(group.nodeList.nodes, "mock", "mul", 0.5);

        group.genFn(group.nodeList.nodes, group.model);

        QUnit.ok(synth1.model.didGen && synth2.model.didGen,
            "All nodes should recieve the gen() method when it is called on the group.");
    });



    QUnit.module("Polyphonic synth tests");

    var assertVoiceInputValues = function (synth, voiceName, expectedValues, msg) {
        var voice = synth.voiceAllocator.activeVoices[voiceName],
            keys = Object.keys(expectedValues),
            inputVals = voice.input(keys);

        QUnit.deepEqual(inputVals, expectedValues, msg);
    };

    var checkVoicesAndInputValues = function (synth, expectations, msg) {
        var numActive = Object.keys(synth.voiceAllocator.activeVoices).length,
            numExpected = Object.keys(expectations).length;

        QUnit.equal(numActive, numExpected,
            "The expected voices should be playing.");

        fluid.each(expectations, function (expectedValues, voiceName) {
            assertVoiceInputValues(synth, voiceName, expectedValues, msg);
        });
    };

    var polySynthTestSpecs = [
        {
            event: "noteOn",
            args: ["cat"],
            expected: {
                "cat": {
                    "env.gate": 1,
                    "carrier.freq": 440
                }
            },
            msg: "The first voice should be active."
        },
        {
            event: "noteOn",
            args: ["dog", {
                "carrier.freq": 220
            }],
            expected: {
                cat: {
                    "env.gate": 1,
                    "carrier.freq": 440
                },
                dog: {
                    "env.gate": 1,
                    "carrier.freq": 220
                }
            },
            msg: "Both voices should be active"
        },
        {
            event: "noteOff",
            args: ["cat"],
            expected: {
                "dog": {
                    "env.gate": 1,
                    "carrier.freq": 220
                }
            },
            msg: "Only the second voice should still be active."
        },
        {
            event: "noteOff",
            args: ["dog"],
            expected: {},
            msg: "No voices should be active."
        }
    ];

    QUnit.test("flock.synth.polyphonic", function () {
        var def = {
            id: "carrier",
            ugen: "flock.test.ugen.mock",
            freq: 440,
            mul: {
                id: "env",
                ugen: "flock.test.ugen.mock",
                gate: 0
            }
        };

        var poly = flock.synth.polyphonic({
            synthDef: def,
            addToEnvironment: false
        });
        QUnit.equal(Object.keys(poly.voiceAllocator.activeVoices).length, 0,
            "When a polyphonic synth is instantiated, it should have no active voices.");

        fluid.each(polySynthTestSpecs, function (testSpec) {
            var fn = poly[testSpec.event];
            fn.apply(poly, testSpec.args);
            checkVoicesAndInputValues(poly, testSpec.expected, testSpec.msg);
        });
    });
}());
