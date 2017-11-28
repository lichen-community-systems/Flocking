/*
 * Flocking Synth Environment Tests
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

    fluid.defaults("flock.test.synth.evaluationTestEnvironment", {
        gradeNames: "flock.test.testEnvironment",

        sequence64: "@expand:flock.test.generateSequence(1, 64)",
        sequence127: "@expand:flock.test.generateSequence(64, 127)",
        sequence191: "@expand:flock.test.generateSequence(128, 191)",
        firstSampleImpulse: {
            expander: {
                funcName: "flock.test.synth.evaluationTestEnvironment.generateImpulse",
                args: [0, 64]
            }
        },

        synthDef: {
            id: "pass",
            ugen: "flock.ugen.passThrough",
            rate: "audio",
            source: {
                ugen: "flock.ugen.sequence",
                rate: "audio",
                freq: "{environment}.audioSystem.model.rates.audio",
                values: "{that}.options.sequence64"
            }
        },

        components: {
            synth: {
                type: "flock.synth",
                options: {
                    synthDef: "{testEnvironment}.options.synthDef"
                }
            },

            tester: {
                type: "flock.test.synth.evaluation.tester"
            }
        }
    });

    fluid.defaults("flock.test.synth.evaluation.tester", {
        gradeNames: "fluid.test.testCaseHolder",

        modules: [
            {
                name: "Synth evaluation tests",
                expect: 4,
                tests: [
                    {
                        name: "Synth.set(): correct node evaluation order",
                        sequence: [
                            {
                                func: "{synth}.genFn",
                                args: [
                                    "{synth}.nodeList.nodes",
                                    "{synth}.model"
                                ]
                            },
                            {
                                funcName: "flock.test.synth.evaluation.tester.assertSynthUGenOutput",
                                args: [
                                    "When first instantiating the synth, a unit generator's inputs should be evaluated first.",
                                    "{synth}",
                                    "pass",
                                    "{evaluationTestEnvironment}.options.sequence64"
                                ]
                            },
                            {
                                func: "{synth}.set",
                                args: ["pass.source", {
                                    ugen: "flock.ugen.sequence",
                                    rate: "audio",
                                    freq: "{environment}.audioSystem.model.rates.audio",
                                    values: "{evaluationTestEnvironment}.options.sequence127"
                                }]
                            },
                            {
                                func: "{synth}.genFn",
                                args: [
                                    "{synth}.nodeList.nodes",
                                    "{synth}.model"
                                ]
                            },
                            {
                                funcName: "flock.test.synth.evaluation.tester.assertSynthUGenOutput",
                                args: [
                                    "After swapping one active unit generator for another, the correct order should be preserved.",
                                    "{synth}",
                                    "pass",
                                    "{evaluationTestEnvironment}.options.sequence127"
                                ]
                            },
                            {
                                func: "{synth}.set",
                                args: ["pass.source", 1.0]
                            },
                            {
                                func: "{synth}.genFn",
                                args: [
                                    "{synth}.nodeList.nodes",
                                    "{synth}.model"
                                ]
                            },
                            {
                                funcName: "flock.test.synth.evaluation.tester.assertSynthUGenOutput",
                                args: [
                                    "Replacing an active ugen with an inactive one.",
                                    "{synth}",
                                    "pass",
                                    "{evaluationTestEnvironment}.options.firstSampleImpulse"
                                ]
                            },
                            {
                                func: "{synth}.set",
                                args: ["pass.source", {
                                    ugen: "flock.ugen.sequence",
                                    rate: "audio",
                                    freq: "{environment}.audioSystem.model.rates.audio",
                                    values: "{evaluationTestEnvironment}.options.sequence191"
                                }]
                            },
                            {
                                func: "{synth}.genFn",
                                args: [
                                    "{synth}.nodeList.nodes",
                                    "{synth}.model"
                                ]
                            },
                            {
                                funcName: "flock.test.synth.evaluation.tester.assertSynthUGenOutput",
                                args: [
                                    "Replacing an inactive ugen for an active one.",
                                    "{synth}",
                                    "pass",
                                    "{evaluationTestEnvironment}.options.sequence191"
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    flock.test.synth.evaluationTestEnvironment.generateImpulse = function (index, blockSize) {
        var buffer = new Float32Array(blockSize);
        buffer[index] = 1.0;
        return buffer;
    };

    flock.test.synth.evaluation.tester.assertSynthUGenOutput = function (msg, synth, ugenName, expected) {
        jqUnit.assertDeepEq(msg,
         expected, synth.get(ugenName).output);
    };

    fluid.test.runTests("flock.test.synth.evaluationTestEnvironment");


    fluid.registerNamespace("flock.test.synth.modelEvaluation");

    jqUnit.module("Synth evaluation - model values are updated");

    jqUnit.test("flock.synth 'model' updates", function () {
        var synth = flock.synth({
            synthDef: flock.test.synthDefs.sequencer
        });

        flock.test.synth.modelEvaluation.test(synth, 3);
    });

    jqUnit.test("flock.synth.value 'model' updates", function () {
        var synth = flock.synth.value({
            synthDef: flock.test.synthDefs.sequencer
        });

        flock.test.synth.modelEvaluation.test(synth, 3);
    });

    flock.test.synth.modelEvaluation.test = function (synth, numBlocksToGen) {
        for (var i = 1; i <= numBlocksToGen; i++) {
            flock.evaluate.synth(synth);
            jqUnit.assertEquals("The model value should have been correctly updated.", i, synth.model.value);
        }
    };
}());
