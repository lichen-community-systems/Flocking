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

    fluid.defaults("flock.test.synth.genReporter", {
        gradeNames: ["flock.synth"],

        model: {
            didGen: false
        },

        members: {
            genFn: "{that}.gen"
        },

        synthDef: {
            ugen: "flock.ugen.silence"
        },

        invokers: {
            gen: {
                changePath: "didGen",
                value: true
            },

            reset: {
                changePath: "didGen",
                value: false
            }
        }
    });

    flock.test.synth.testEnviroGraph = function (fn) {
        setTimeout(function () {
            fn();
        }, 2000);
    };

    fluid.defaults("flock.test.synth.environmental.tests", {
        gradeNames: "flock.test.module",
        name: "Synth autoAddToEnviro tests",

        components: {
            autoAddedSynth: {
                createOnEvent: "afterEnvironmentCreated",
                type: "flock.test.synth.genReporter"
            },

            notAutoAddedSynth: {
                createOnEvent: "afterEnvironmentCreated",
                type: "flock.test.synth.genReporter",
                options: {
                    addToEnvironment: false
                }
            }
        },

        invokers: {
            run: {
                funcName: "flock.test.synth.environmental.tests.run",
                args: "{that}"
            }
        },

        listeners: {
            "onCreate.runTests": "{that}.run()"
        }
    });

    flock.test.synth.environmental.tests.run = function (module) {
        jqUnit.asyncTest("Auto add to the environment", function () {
            module.environment.start();

            flock.test.synth.testEnviroGraph(function () {
                jqUnit.assertTrue("The synth with default options should have been automatically added to the environment.",
                    module.autoAddedSynth.isPlaying());
                jqUnit.assertTrue("The synth with default options should have been evaluated.",
                    module.autoAddedSynth.model.didGen);
            });

            flock.test.synth.testEnviroGraph(function () {
                jqUnit.assertTrue("The synth with autoAddToEnvironment: false should not have been automatically added to the environment.",
                    !module.notAutoAddedSynth.isPlaying());
                jqUnit.assertTrue("The synth with autoAddToEnvironment: false should not have been evaluated.",
                    !module.notAutoAddedSynth.model.didGen);
                jqUnit.start();
            });
        });
    };

    flock.test.synth.environmental.tests();

    fluid.defaults("flock.test.synthEnvironmentTests", {
        gradeNames: "flock.test.testEnvironment",

        components: {
            synth: {
                type: "flock.test.synth.genReporter",
                options: {
                    components: {
                        enviro: "{synthEnvironmentTests}.environment"
                    }
                }
            },

            tester: {
                type: "flock.test.synthEnvironmentTester"
            }
        }
    });

    fluid.defaults("flock.test.synthEnvironmentTester", {
        gradeNames: "fluid.test.testCaseHolder",

        invokers: {
            evaluate2Secs: {
                funcName: "flock.test.synthEnvironmentTester.evaluate2Secs",
                args: ["{testEnvironment}", "{that}.events.afterTwoSeconds.fire"]
            }
        },

        events: {
            afterTwoSeconds: null
        },

        modules: [
            {
                name: "Synth environmental tests",
                tests: [
                    {
                        expect: 5,
                        name: "Remove synth from the environment",
                        sequence: [
                            {
                                func: "{environment}.play"
                            },
                            {
                                func: "{that}.evaluate2Secs"
                            },
                            {
                                event: "{that}.events.afterTwoSeconds",
                                listener: "flock.test.synthEnvironmentTester.synthWasEvaluated"
                            },
                            {
                                func: "{synth}.pause"
                            },
                            {
                                funcName: "flock.test.synthEnvironmentTester.synthWasRemoved",
                                args: ["{testEnvironment}"]
                            },
                            {
                                func: "{synth}.reset"
                            },
                            {
                                func: "{that}.evaluate2Secs"
                            },
                            {
                                event: "{that}.events.afterTwoSeconds",
                                listener: "flock.test.synthEnvironmentTester.synthWasNotEvaluated"
                            }
                        ]
                    },
                    {
                        expect: 3,
                        name: "Destroying a synth removes it from the environment",
                        sequence: [
                            {
                                func: "{synth}.play"
                            },
                            {
                                func: "{that}.evaluate2Secs"
                            },
                            {
                                event: "{that}.events.afterTwoSeconds",
                                listener: "flock.test.synthEnvironmentTester.synthWasEvaluated"
                            },
                            {
                                func: "{synth}.destroy"
                            },
                            {
                                funcName: "flock.test.synthEnvironmentTester.synthWasRemoved",
                                args: ["{testEnvironment}"]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    flock.test.synthEnvironmentTester.evaluate2Secs = function (testEnvironment, testFn) {
        var audioSettings = testEnvironment.environment.audioSystem.model;
        var waitDur = (audioSettings.bufferSize / audioSettings.rates.audio) * 1000 * 2;

        setTimeout(function () {
            testFn(testEnvironment);
        }, waitDur);
    };

    // TODO: Remove duplication with tests above.
    flock.test.synthEnvironmentTester.synthWasEvaluated = function (testEnvironment) {
        jqUnit.assertTrue("The synth should have been added to the environment.",
        testEnvironment.synth.isPlaying());

        jqUnit.assertTrue("The synth should have been evaluated.",
        testEnvironment.synth.model.didGen);
    };

    flock.test.synthEnvironmentTester.synthWasRemoved = function (testEnvironment) {
        jqUnit.assertEquals("The synth should have been removed from the environment.",
        testEnvironment.environment.nodeList.nodes.indexOf(testEnvironment.synth),
        -1);
    };

    flock.test.synthEnvironmentTester.synthWasNotEvaluated = function (testEnvironment) {
        jqUnit.assertTrue("The synth, after having been paused, should not be playing.",
        !testEnvironment.synth.isPlaying());
        jqUnit.assertTrue("The synth, after having been paused, should not have been evaluated.",
        !testEnvironment.synth.model.didGen);
    };

    fluid.test.runTests("flock.test.synthEnvironmentTests");

    // var testAddToEnvironment = function (synthOptions, expectedOrder, message) {
    //     flock.nodeList.clearAll(environment.nodeList);

    //     var synths = [];
    //     fluid.each(synthOptions, function (synthOption) {
    //         synths.push(flock.synth(synthOption));
    //     });

    //     var actualOrder = fluid.transform(synths, function (synth) {
    //         return environment.nodeList.nodes.indexOf(synth);
    //     });

    //     QUnit.deepEqual(actualOrder, expectedOrder, message);
    // };

    // var runAddToEnvironmentTest = function (testSpec) {
    //     var def = {
    //         ugen: "flock.ugen.sinOsc"
    //     };

    //     var synthOptions = [];

    //     var addToEnvironmentOptions = fluid.makeArray(testSpec.addToEnvironment);
    //     fluid.each(addToEnvironmentOptions, function (addToEnvironment) {
    //         synthOptions.push({
    //             synthDef: def,
    //             addToEnvironment: addToEnvironment
    //         });
    //     });

    //     testAddToEnvironment(synthOptions, testSpec.expectedOrder, testSpec.msg);
    // };

    // var runAddToEnvironmentTests = function (testSpecs) {
    //     fluid.each(testSpecs, function (testSpec) {
    //         runAddToEnvironmentTest(testSpec);
    //     });
    // };

    // QUnit.test("addToEnvironment", function () {

    //     var testSpecs = [
    //         {
    //             addToEnvironment: [false],
    //             expectedOrder: [-1],
    //             msg: "The synth should not have been added to the environment " +
    //                 "when its addToEnvironment option was false."
    //         },
    //         {
    //             addToEnvironment: [undefined],
    //             expectedOrder: [0],
    //             msg: "The synth should have been added to the environment " +
    //                 "when its addToEnvironment option was undefined, because flock.synth's default " +
    //                 "behaviour is to add itself to the environment at the tail."
    //         },
    //         {
    //             addToEnvironment: [null],
    //             expectedOrder: [-1],
    //             msg: "The synth should not have been added to the environment " +
    //                 "when its addToEnvironment option was null."
    //         },
    //         {
    //             addToEnvironment: [true],
    //             expectedOrder: [0],
    //             msg: "The synth should have been added to the environment " +
    //                 "when its addToEnvironment option was set to true."
    //         },
    //         {
    //             addToEnvironment: ["tail", "tail", "head"],
    //             expectedOrder: [1, 2, 0],
    //             msg: "The synth should have been added to the head of the environment when its " +
    //                 "addToEnvironment option is set to 'head'."
    //         },
    //         {
    //             addToEnvironment: ["head", "head", "head", 2],
    //             expectedOrder: [3, 1, 0, 2],
    //             msg: "The synth should have been added to the environment at the correct index " +
    //                 "when its addToEnvironment option was set to an integer."
    //         },
    //         {
    //             addToEnvironment: [true, "head", 2, "tail"],
    //             expectedOrder: [1, 0, 2, 3],
    //             msg: "The node order should be correct when specifying a variety of types of " +
    //                 "addToEnvironment options."
    //         },
    //         {
    //             addToEnvironment: ["tail", "cat"],
    //             expectedOrder: [0, 1],
    //             msg: "The synth should be added to tail of the environment " +
    //                 "when its addToEnvironment option was invalid."
    //         }
    //     ];

    //     runAddToEnvironmentTests(testSpecs);
    // });

}());
