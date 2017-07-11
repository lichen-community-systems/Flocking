/*
 * Flocking Synth Tests
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

    fluid.defaults("flock.test.synth.tester", {
        gradeNames: "fluid.test.testCaseHolder",

        modules: [
            {
                name: "Synth tests",
                expect: 5,
                tests: [
                    {
                        name: "Synth.isPlaying()",
                        sequence: [
                            {
                                funcName: "flock.test.synth.tester.assertPlayStatus",
                                args: [
                                    "{synth}",
                                    false,
                                    "The synth should not be playing initially."
                                ]
                            },
                            {
                                func: "{synth}.play"
                            },
                            {
                                funcName: "flock.test.synth.tester.assertPlayStatus",
                                args: [
                                    "{synth}",
                                    true,
                                    "The synth should should be playing after invoking the play() method."
                                ]
                            },
                            {
                                funcName: "flock.test.synth.tester.assertInEnvironment",
                                args: [
                                    "{synth}",
                                    "The synth should actually be a member of the environment's node list."
                                ]
                            },
                            {
                                func: "{synth}.pause"
                            },
                            {
                                funcName: "flock.test.synth.tester.assertPlayStatus",
                                args: [
                                    "{synth}",
                                    false,
                                    "The synth should not be playing after pause() has been invoked."
                                ]
                            },
                            {
                                funcName: "flock.test.synth.tester.assertNotInEnvironment",
                                args: [
                                    "{synth}",
                                    "The synth should no longer be a member of the environment's node list."
                                ]
                            }
                        ]
                    },
                    {
                        name: "Get input values",
                        expect: 4,
                        sequence: [
                            {
                                funcName: "flock.test.synth.tester.assertSynthValue",
                                args: [
                                    "{synth}",
                                    "sine.freq",
                                    440,
                                    "Getting 'sine.freq' should return the value set in the synthDef."
                                ]
                            },
                            {
                                funcName: "flock.test.synth.tester.assertSynthValue",
                                args: [
                                    "{synth}",
                                    "sine.freq",
                                    440,
                                    "Getting 'sine.freq' a second time should return the same value."
                                ]
                            },
                            {
                                funcName: "flock.test.synth.tester.assertSynthValue",
                                args: [
                                    "{synth}",
                                    "mod.freq",
                                    1.0,
                                    "Getting 'mod.freq' should also return the initial value."
                                ]
                            },
                            {
                                funcName: "flock.test.synth.testerAssertSynthValueIsUGen",
                                args: [
                                    "{synth}",
                                    "mod",
                                    "A ugen returned from synth.input() should have a gen() method."
                                ]
                            }
                        ]
                    },
                    {
                        name: "Get input values with special segments (e.g. 'options' and 'model')",
                        expect: 4,
                        sequence: [
                            {
                                funcName: "flock.test.synth.tester.assertSynthValue",
                                args: [
                                    "{synth}",
                                    "sine.freq.model.value",
                                    440,
                                    "Getting the sine oscillator's frequency input's model value should return the current frequency."
                                ]
                            },
                            {
                                funcName: "flock.test.synth.tester.assertSynthValue",
                                args: [
                                    "{synth}",
                                    "sine.freq.model",
                                    "{synth}.nodeList.namedNodes.sine.inputs.freq.model",
                                    "Getting the sine oscillator's frequency input's model should return the whole model object."
                                ]
                            },
                            {
                                funcName: "flock.test.synth.tester.assertSynthValue",
                                args: [
                                    "{synth}",
                                    "sine.options",
                                    "{synth}.nodeList.namedNodes.sine.options",
                                    "Getting the sine oscillator's options should return the whole options object."
                                ]
                            },
                            {
                                funcName: "flock.test.synth.tester.assertSynthValue",
                                args: [
                                    "{synth}",
                                    "sine.options.sampleRate",
                                    "{synth}.nodeList.namedNodes.sine.options.sampleRate",
                                    "It should be possible to getting a value within the sine oscillator's options."
                                ]
                            }
                        ]
                    },
                    {
                        name: "Set input values",
                        expect: 15,
                        sequence: [
                            {
                                func: "{synth}.set",
                                args: ["sine.freq", 220]
                            },
                            {
                                funcName: "flock.test.synth.tester.assertSynthValue",
                                args: [
                                    "{synth}",
                                    "sine.freq",
                                    220,
                                    "Setting 'sine.freq' should update the input value accordingly."
                                ]
                            },
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "And the underlying value ugen should also be updated.",
                                    220,
                                    "{synth}.nodeList.namedNodes.sine.inputs.freq.model.value"
                                ]
                            },
                            {
                                func: "{synth}.set",
                                args: [
                                    "sine.freq",
                                    110
                                ]
                            },
                            {
                                funcName: "flock.test.synth.tester.assertSynthValue",
                                args: [
                                    "{synth}",
                                    "sine.freq",
                                    110,
                                    "Setting 'sine.freq' a second time should also work."
                                ]
                            },
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "And the underlying value ugen should also be updated.",
                                    110,
                                    "{synth}.nodeList.namedNodes.sine.inputs.freq.model.value"
                                ]
                            },
                            {
                                func: "{synth}.set",
                                args: ["mod.freq", 2.0]
                            },
                            {
                                funcName: "flock.test.synth.tester.assertSynthValue",
                                args: [
                                    "{synth}",
                                    "mod.freq",
                                    2.0,
                                    "Setting 'mod.freq' should update the input value."
                                ]
                            },
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "And the underlying value ugen should also be updated.",
                                    2.0,
                                    "{synth}.nodeList.namedNodes.mod.inputs.freq.model.value"
                                ]
                            },
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "And the underlying value ugen should also be updated.",
                                    2.0,
                                    "{synth}.nodeList.namedNodes.mod.inputs.freq.model.value"
                                ]
                            },
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "Even the ugen's output buffer should contain the new value.",
                                    2.0,
                                    "{synth}.nodeList.namedNodes.mod.inputs.freq.output.0"
                                ]
                            },
                            {
                                func: "{synth}.set",
                                args: ["mod.freq", null]
                            },
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "Setting an input to null should leave it untouched.",
                                    2.0,
                                    "{synth}.nodeList.namedNodes.mod.inputs.freq.model.value"
                                ]
                            },
                            {
                                func: "{synth}.set",
                                args: ["mod.freq", undefined]
                            },
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "Setting an input to undefined should leave it untouched.",
                                    2.0,
                                    "{synth}.nodeList.namedNodes.mod.inputs.freq.model.value"
                                ]
                            },
                            {
                                func: "{synth}.set",
                                args: ["sine.mul", {
                                    id: "testUGen",
                                    ugen: "flock.ugen.dust",
                                    inputs: {
                                        density: 200
                                    }
                                }]
                            },
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "The 'mul' ugen should be set to our test Dust ugen.",
                                    "{synth}.nodeList.namedNodes.testUGen",
                                    "{synth}.nodeList.namedNodes.sine.inputs.mul"
                                ]
                            },
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "The ugen should be set up correctly.",
                                    200,
                                    "{synth}.nodeList.namedNodes.sine.inputs.mul.inputs.density.model.value"
                                ]
                            },
                            {
                                // Sanity check for the next assertion.
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "The original sine unit generator should be assigned.",
                                    "{synth}.nodeList.namedNodes.sine",
                                    "{testEnvironment}.originalSineUGen"
                                ]
                            },
                            {
                                func: "{synth}.set",
                                args: ["sine", {
                                    ugen: "flock.ugen.lfNoise",
                                    freq: 123
                                }]
                            },
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "Directly setting a named unit generator should cause the previous ugen to be replaced.",
                                    123,
                                    "{synth}.nodeList.namedNodes.sine.inputs.freq.model.value"
                                ]
                            },
                            {
                                funcName: "jqUnit.assertNotEquals",
                                args: [
                                    "The original 'sine' unit generator is not assigned.",
                                    "{synth}.nodeList.namedNodes.sine",
                                    "{testEnvironment}.originalSineUGen"
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    flock.test.synth.tester.assertSynthValue = function (synth, path, expected, msg) {
        var val = synth.get(path);
        jqUnit.assertEquals(msg, expected, val);
    };

    flock.test.synth.testerAssertSynthValueIsUGen = function (synth, path, msg) {
        var val = synth.get(path);
        jqUnit.assertTrue(msg, typeof val.gen === "function");
    };


    flock.test.synth.tester.assertPlayStatus = function (synth, expected, msg) {
        var isPlaying = synth.isPlaying();

        if (expected) {
            jqUnit.assertTrue(msg, isPlaying);
        } else {
            jqUnit.assertFalse(msg, isPlaying);
        }
    };

    flock.test.synth.tester.assertInEnvironment = function (synth, msg) {
        var isInEnvironment = synth.enviro.nodeList.nodes.indexOf(synth) > -1;
        jqUnit.assertTrue(msg, isInEnvironment);
    };

    flock.test.synth.tester.assertNotInEnvironment = function (synth, msg) {
        jqUnit.assertTrue(msg, synth.enviro.nodeList.nodes.indexOf(synth) < 0);
    };

    fluid.defaults("flock.test.synth.testEnvironment", {
        gradeNames: "flock.test.testEnvironment",

        members: {
            originalSineUGen: "@expand:{that}.synth.get(sine)"
        },

        synthDef: {
            ugen: "flock.ugen.out",
            inputs: {
                sources: {
                    id: "sine",
                    ugen: "flock.ugen.sinOsc",
                    inputs: {
                        freq: 440,
                        mul: {
                            id: "mod",
                            ugen: "flock.ugen.sinOsc",
                            inputs: {
                                freq: 1.0
                            }
                        }
                    }
                },
                bus: 0
            }
        },

        components: {
            synth: {
                type: "flock.synth",
                options : {
                    synthDef: "{testEnvironment}.options.synthDef",
                    sampleRate: 1,
                    chans: 1,
                    addToEnvironment: false
                }
            },

            tester: {
                type: "flock.test.synth.tester"
            }
        }
    });

    fluid.test.runTests("flock.test.synth.testEnvironment");

    //
    //
    // QUnit.test("Set input values, onInputChanged event", function () {
    //     flock.tests = {};
    //     flock.tests.ugens = {};
    //
    //     var didOnInputChangedFire = false;
    //     // TODO: Normalize this with the OTHER mock ugen.
    //     flock.tests.ugens.mockUGen = function (inputs, output, options) {
    //         var that = flock.ugen(inputs, output, options);
    //         that.gen = function () {};
    //         that.onInputChanged = function () {
    //             didOnInputChangedFire = true;
    //         };
    //         return that;
    //     };
    //
    //     var synth = createSynth({
    //         id: "mock",
    //         ugen: "flock.tests.ugens.mockUGen",
    //         inputs: {
    //             cat: 12
    //         }
    //     });
    //
    //     synth.input("mock.cat");
    //     QUnit.ok(!didOnInputChangedFire, "The onInputChanged event should not fire when an input is read.");
    //     didOnInputChangedFire = false;
    //     synth.input("mock.cat", 42);
    //     QUnit.ok(didOnInputChangedFire, "The onInputChanged event should fire when an input is changed.");
    // });
    //
    // QUnit.test("Get and set values at array indices", function () {
    //     var def = {
    //         ugen: "flock.ugen.sinOsc",
    //         id: "carrier",
    //         freq: {
    //             ugen: "flock.ugen.sum",
    //             id: "adder",
    //             sources: [
    //                 {
    //                     ugen: "flock.ugen.sin",
    //                     freq: 440
    //                 },
    //                 {
    //                     ugen: "flock.ugen.sin",
    //                     freq: 880
    //                 }
    //             ]
    //         }
    //     };
    //
    //     var synth = flock.synth({
    //         synthDef: def
    //     });
    //     var actual = synth.input("carrier.freq.sources.1"),
    //         expected = synth.nodeList.namedNodes.adder.inputs.sources[1];
    //     QUnit.equal(actual, expected, "Getting a ugen input within an array should return the correct ugen.");
    //
    //     actual = synth.input("adder.sources.1.freq");
    //     expected = 880;
    //     QUnit.equal(actual, expected,
    //         "Getting a value from a ugen within an array should return the correct value.");
    //
    //     synth.input("adder.sources.1.freq", 889);
    //     expected = 889;
    //     actual = synth.nodeList.namedNodes.adder.inputs.sources[1].inputs.freq.model.value;
    //     QUnit.equal(actual, expected,
    //         "Setting a value on a ugen within an array should succeed.");
    //
    //     synth.input("adder.sources.0", {
    //         ugen: "flock.ugen.lfNoise",
    //         freq: 456
    //     });
    //     QUnit.equal(synth.nodeList.namedNodes.adder.inputs.sources[0].inputs.freq.model.value, 456,
    //         "Setting a ugen within an array should succeed.");
    // });
    //
    // var testSetUGenArray = function (synth, path, value, expectedNumNodes, oldUGens, msgPrefix) {
    //     var result = synth.set(path, value);
    //
    //     QUnit.equal(value.length, synth.get("out.sources").length,
    //         msgPrefix + ": " +
    //         "The input should have the correct number of unit generators attached to it.");
    //     QUnit.equal(synth.nodeList.nodes.length, expectedNumNodes,
    //         msgPrefix + ": " +
    //         "The unit generator list should have been updated with the new unit generator count " +
    //         "(i.e. old inputs removed, new ones added).");
    //
    //     var activeOldCount = 0;
    //     for (var i = 0; i < oldUGens.length; i++) {
    //         activeOldCount += synth.nodeList.nodes.indexOf(oldUGens[i]);
    //     }
    //     QUnit.ok(activeOldCount < 0,
    //         msgPrefix + ": " +
    //         "None of the old unit generators should be in the synth's list of active nodes.");
    //
    //     return result;
    // };
    //
    // var runSetArrayValueTest = function (synth, path, testSpecs) {
    //     var oldUGens = synth.get(path);
    //     fluid.each(testSpecs, function (testSpec) {
    //         oldUGens = testSetUGenArray(
    //             synth,
    //             path,
    //             testSpec.value,
    //             testSpec.expectedNumNodes,
    //             oldUGens,
    //             testSpec.msgPrefix
    //         );
    //     });
    // };
    //
    // QUnit.test("Get and set array-valued inputs", function () {
    //     var def = {
    //         ugen: "flock.ugen.out",
    //         id: "out",
    //         bus: 0,
    //         expand: 3,
    //         sources: [
    //             {
    //                 ugen: "flock.ugen.sin",
    //                 freq: 110,
    //                 phase: 1.0
    //             },
    //             {
    //                 ugen: "flock.ugen.lfNoise",
    //                 freq: 220
    //             },
    //             {
    //                 ugen: "flock.ugen.lfSaw",
    //                 freq: 330,
    //                 phase: 0.1
    //             }
    //         ]
    //     };
    //
    //     var synth = flock.synth({
    //         synthDef: def
    //     });
    //
    //     QUnit.equal(synth.nodeList.nodes.length, 11,
    //         "Sanity check: all 11 unit generators should have been added to the synth.");
    //
    //     var result = synth.get("out.sources");
    //     QUnit.equal(result, synth.nodeList.namedNodes.out.inputs.sources,
    //         "Getting an array-valued input should return all values.");
    //
    //     runSetArrayValueTest(synth, "out.sources", [
    //         {
    //             value: [
    //                 {
    //                     ugen: "flock.ugen.lfPulse",
    //                     freq: 440,
    //                     phase: 0.2,
    //                     width: 0.1
    //                 }
    //             ],
    //             expectedNumNodes: 7,
    //             msgPrefix: "Set fewer unit generators than before"
    //         },
    //         {
    //             value:[
    //                 {
    //                     ugen: "flock.ugen.lfNoise",
    //                     freq: 550
    //                 }
    //             ],
    //             expectedNumNodes: 5,
    //             msgPrefix: "Set an equal number of unit generators"
    //
    //         },
    //         {
    //             value: [
    //                 {
    //                     ugen: "flock.ugen.lfNoise",
    //                     freq: 660
    //                 },
    //                 {
    //                     ugen: "flock.ugen.lfNoise",
    //                     freq: 770
    //                 },
    //                 {
    //                     ugen: "flock.ugen.lfNoise",
    //                     freq: 880
    //                 },
    //                 {
    //                     ugen: "flock.ugen.lfNoise",
    //                     freq: 990
    //                 }
    //             ],
    //             expectedNumNodes: 11,
    //             msgPrefix: "Set more unit generators than previously"
    //         }
    //     ]);
    // });
    //
    // QUnit.test("Get multiple input values", function () {
    //     var synth = createSynth(simpleSynthDef),
    //         expected,
    //         actual;
    //
    //     expected = {
    //         "sine.freq": 440,
    //         "sine.mul.freq": 1.0,
    //         "sine.add": undefined
    //     };
    //
    //     // "Fill it in" style of get()
    //     actual = synth.get({
    //         "sine.freq": null,
    //         "sine.mul.freq": null,
    //         "sine.add": null
    //     });
    //     QUnit.deepEqual(actual, expected,
    //         "Synth.get() should fill in the object passed in as its argument.");
    //
    //     // Array style of input()
    //     actual = synth.input([
    //         "sine.freq",
    //         "sine.mul.freq",
    //         "sine.add"
    //     ]);
    //     QUnit.deepEqual(actual, expected,
    //         "Synth.input() should return multiple values when given an array of paths.");
    // });
    //
    // var testSetMultiple = function (methodName) {
    //     var synth = createSynth(simpleSynthDef),
    //         expected,
    //         actual,
    //         direct;
    //
    //     actual = synth[methodName]({
    //         "sine.freq": 880,
    //         "sine.mul.freq": 1.2,
    //         "sine.add": {
    //             id: "add",
    //             ugen: "flock.ugen.sinOsc",
    //             freq: 7.0
    //         }
    //     });
    //
    //     direct = synth.nodeList.namedNodes.sine;
    //
    //     expected = {
    //         "sine.freq": direct.inputs.freq,
    //         "sine.mul.freq": direct.inputs.mul.inputs.freq,
    //         "sine.add": direct.inputs.add
    //     };
    //
    //     // Check that the data structure returned conforms to the contract.
    //     QUnit.deepEqual(actual, expected,
    //         "The return value should contain the actual unit generator instances that were set.");
    //
    //     // And then that the actual ugen graph was modified.
    //     QUnit.equal(direct.inputs.freq.model.value, 880);
    //     flock.test.equalRounded(7, direct.inputs.mul.inputs.freq.model.value, 1.2);
    //     QUnit.equal(direct.inputs.add.inputs.freq.model.value, 7.0);
    //     QUnit.equal(direct.inputs.add.id, "add");
    // };
    //
    // QUnit.test("Set multiple input values", function () {
    //     testSetMultiple("set");
    //     testSetMultiple("input");
    // });
    //
    // var valueExpressionTestSpecs = [
    //     {
    //         name: "Value expression resolving into the model",
    //         change: {
    //             "sine.freq": "${mod.freq.model.value}"
    //         },
    //         targetUGenName: "mod",
    //         expectedPath: "inputs.freq.model.value"
    //     },
    //     {
    //         name: "Value expression resolving to a unit generator instance",
    //         change: {
    //             "sine.freq": "${mod}"
    //         },
    //         targetUGenName: "mod"
    //     }
    // ];
    //
    // var testValueExpressions = function (testSpecs) {
    //     fluid.each(testSpecs, function (testSpec) {
    //         QUnit.test(testSpec.name, function () {
    //             var synth = createSynth(simpleSynthDef);
    //             synth.set(testSpec.change);
    //
    //             var actual = synth.get(Object.keys(testSpec.change)[0]),
    //                 expected = synth.get(testSpec.targetUGenName);
    //
    //             if (testSpec.expectedPath) {
    //                 expected = fluid.get(expected, testSpec.expectedPath);
    //             }
    //
    //             QUnit.equal(actual, expected,
    //                 "The value expression should have been resolved and set at the specified path.");
    //         });
    //     });
    // };
    //
    // testValueExpressions(valueExpressionTestSpecs);
    //
    // QUnit.test("Synth.set(): correct node evaluation order", function () {
    //     var synth = flock.synth({
    //         synthDef: {
    //             id: "pass",
    //             ugen: "flock.ugen.passThrough",
    //             rate: "audio",
    //             source: {
    //                 ugen: "flock.ugen.sequence",
    //                 rate: "audio",
    //                 freq: environment.audioSystem.model.rates.audio,
    //                 values: flock.test.generateSequence(1, 64)
    //             }
    //         }
    //     });
    //
    //     var passThrough = synth.get("pass");
    //     synth.genFn(synth.nodeList.nodes, synth.model);
    //     QUnit.deepEqual(passThrough.output, flock.test.generateSequence(1, 64),
    //         "When first instantiating the synth, a unit generator's inputs should be evaluated first.");
    //
    //     synth.set("pass.source", {
    //         ugen: "flock.ugen.sequence",
    //         rate: "audio",
    //         freq: environment.audioSystem.model.rates.audio,
    //         values: flock.test.generateSequence(64, 127)
    //     });
    //     synth.genFn(synth.nodeList.nodes, synth.model);
    //     QUnit.deepEqual(passThrough.output, flock.test.generateSequence(64, 127),
    //         "After swapping one active unit generator for another, the correct order should be preserved.");
    //
    //     synth.set("pass.source", 1.0);
    //     synth.genFn(synth.nodeList.nodes, synth.model);
    //     var expected = new Float32Array(64);
    //     expected[0] = 1.0; // With a control rate source input, passThrough will only output the first value.
    //     QUnit.deepEqual(passThrough.output, expected,
    //         "Replacing an active ugen with an inactive one.");
    //
    //     synth.set("pass.source", {
    //         ugen: "flock.ugen.sequence",
    //         rate: "audio",
    //         freq: environment.audioSystem.model.rates.audio,
    //         values: flock.test.generateSequence(128, 191)
    //     });
    //     synth.genFn(synth.nodeList.nodes, synth.model);
    //     QUnit.deepEqual(passThrough.output, flock.test.generateSequence(128, 191),
    //         "Replacing an inactive ugen for an active one.");
    // });
    //
    // var setAndTestUGenCount = function (synth, change, expected, msg) {
    //     if (change) {
    //         synth.set(change);
    //     }
    //     QUnit.equal(synth.nodeList.nodes.length, expected, msg);
    // };
    //
    // var runUGenCountTests = function (testSpec) {
    //     var synth = flock.synth({
    //             synthDef: testSpec.synthDef
    //         }),
    //         i,
    //         test;
    //
    //     for (i = 0; i < testSpec.tests.length; i++) {
    //         test = testSpec.tests[i];
    //         setAndTestUGenCount(synth, test.change, test.expected, test.msg);
    //     }
    // };
    //
    // QUnit.test("Synth.set(): replace inputs", function () {
    //     var testSpec = {
    //         synthDef: {
    //             ugen: "flock.ugen.out",         // 5
    //             bus: 0,                         // 3
    //             expand: 2,                      // 4
    //             sources: {
    //                 id: "carrier",
    //                 ugen: "flock.ugen.sin",     // 2
    //                 freq: 440,                  // 0
    //                 phase: 0.0                  // 1
    //             }
    //         },
    //
    //         tests: [
    //             {
    //                 expected: 6,
    //                 msg: "After instantiation, there should be three uugens--the output, the sin, and the freq value ugen."
    //             },
    //
    //             {
    //                 change: {
    //                     "carrier.freq": 27
    //                 },
    //                 expected: 6,
    //                 msg: "After replacing a value ugen with another, there should be the same number of ugens."
    //             },
    //
    //             {
    //                 change: {
    //                     "carrier.freq": {
    //                         id: "modulator",
    //                         ugen: "flock.ugen.lfSaw",
    //                         freq: 22,
    //                         phase: 0.1
    //                     }
    //                 },
    //                 expected: 8,
    //                 msg: "After replacing a value ugen with a two-input oscillator, there should be two more ugens--the saw's freq and phase value ugens."
    //             }
    //         ]
    //     };
    //
    //     runUGenCountTests(testSpec);
    // });
    //
    // var sequenceSynthDef = {
    //     id: "seq",
    //     ugen: "flock.ugen.sequence",
    //     freq: 750,
    //     values: [1, 2, 3, 5]
    // };
    //
    // QUnit.test("Getting and setting ugen-specified special inputs.", function () {
    //     var s = flock.synth({
    //         synthDef: sequenceSynthDef
    //     });
    //
    //     var seqUGen = s.get("seq");
    //     QUnit.deepEqual(seqUGen.inputs.list, s.options.synthDef.list,
    //         "Sanity check: the sequence ugen should be initialized with the same list as specified in the synthDef.");
    //
    //     var newList = [9, 10, 11, 12];
    //     s.set("seq.list", newList);
    //     QUnit.deepEqual(seqUGen.inputs.list, newList,
    //         "After setting a 'special input' on a unit generator, it should have been set correctly.");
    // });
    //
    // var checkModelState = function (synth, genMethodName, numGens) {
    //     for (var i = 1; i <= numGens; i++) {
    //         flock.evaluate.synth(synth);
    //         QUnit.equal(synth.model.value, i,
    //             "The model value should have been correctly updated.");
    //     }
    // };
    //
    // var testSynthModelState = function (testSpecs) {
    //     fluid.each(testSpecs, function (testSpec) {
    //         QUnit.test(testSpec.name, function () {
    //             var s = fluid.getGlobalValue(testSpec.type)({
    //                 synthDef: sequenceSynthDef,
    //                 sampleRate: 48000
    //             });
    //
    //             checkModelState(s, testSpec.genMethodName, testSpec.numGens || 3);
    //         });
    //     });
    // };
    //
    // var modelStateTestSpecs = [
    //     {
    //         name: "flock.synth model state",
    //         type: "flock.synth",
    //         genMethodName: "gen",
    //         numGens: 3
    //     },
    //     {
    //         name: "flock.synth.value",
    //         type: "flock.synth.value",
    //         genMethodName: "value",
    //         numGens: 3
    //     }
    // ];
    //
    // testSynthModelState(modelStateTestSpecs);
    //

}());
