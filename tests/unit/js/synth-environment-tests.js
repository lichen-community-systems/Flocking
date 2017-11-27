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

    fluid.registerNamespace("flock.test.synth.environmental");

    flock.test.synth.environmental.assertSynthWasEvaluated = function (synth) {
        jqUnit.assertTrue("The synth should have been added to the environment.",
        synth.isPlaying());

        jqUnit.assertTrue("The synth should have been evaluated.",
        synth.model.didGen);
    };

    flock.test.synth.environmental.assertSynthWasNotEvaluated = function (synth) {
        jqUnit.assertFalse("The synth should have been added to the environment.",
        synth.isPlaying());

        jqUnit.assertFalse("The synth should have been evaluated.",
        synth.model.didGen);
    };

    fluid.defaults("flock.test.synth.environmental.autoAddTests", {
        gradeNames: "flock.test.module.runOnCreate",

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
                funcName: "flock.test.synth.environmental.autoAddTests.run",
                args: "{that}"
            }
        }
    });

    flock.test.synth.environmental.autoAddTests.run = function (module) {
        jqUnit.asyncTest("Auto add to the environment", function () {
            module.environment.start();

            flock.test.synth.testEnviroGraph(function () {
                flock.test.synth.environmental.assertSynthWasEvaluated(module.autoAddedSynth);
            });

            flock.test.synth.testEnviroGraph(function () {
                flock.test.synth.environmental.assertSynthWasNotEvaluated(module.notAutoAddedSynth);
                jqUnit.start();
            });
        });
    };

    flock.test.synth.environmental.autoAddTests();

    fluid.defaults("flock.test.synth.environment.removeDestroyTests", {
        gradeNames: "flock.test.testEnvironment",

        components: {
            synth: {
                type: "flock.test.synth.genReporter",
                options: {
                    components: {
                        enviro: "{removeDestroyTests}.environment"
                    }
                }
            },

            tester: {
                type: "flock.test.synth.environment.removeDestroyTester"
            }
        }
    });

    fluid.defaults("flock.test.synth.environment.removeDestroyTester", {
        gradeNames: "fluid.test.testCaseHolder",

        invokers: {
            evaluate2Secs: {
                funcName: "flock.test.synth.environment.removeDestroyTester.evaluate2Secs",
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
                                listener: "flock.test.synth.environment.removeDestroyTester.synthWasEvaluated"
                            },
                            {
                                func: "{synth}.pause"
                            },
                            {
                                funcName: "flock.test.synth.environment.removeDestroyTester.synthWasRemoved",
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
                                listener: "flock.test.synth.environment.removeDestroyTester.synthWasNotEvaluated"
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
                                listener: "flock.test.synth.environment.removeDestroyTester.synthWasEvaluated"
                            },
                            {
                                func: "{synth}.destroy"
                            },
                            {
                                funcName: "flock.test.synth.environment.removeDestroyTester.synthWasRemoved",
                                args: ["{testEnvironment}"]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    flock.test.synth.environment.removeDestroyTester.evaluate2Secs = function (testEnvironment, testFn) {
        var audioSettings = testEnvironment.environment.audioSystem.model;
        var waitDur = (audioSettings.bufferSize / audioSettings.rates.audio) * 1000 * 2;

        setTimeout(function () {
            testFn(testEnvironment);
        }, waitDur);
    };

    flock.test.synth.environment.removeDestroyTester.synthWasEvaluated = function (testEnvironment) {
        flock.test.synth.environmental.assertSynthWasEvaluated(testEnvironment.synth);
    };

    flock.test.synth.environment.removeDestroyTester.synthWasRemoved = function (testEnvironment) {
        jqUnit.assertEquals("The synth should have been removed from the environment.",
        testEnvironment.environment.nodeList.nodes.indexOf(testEnvironment.synth),
        -1);
    };

    flock.test.synth.environment.removeDestroyTester.synthWasNotEvaluated = function (testEnvironment) {
        flock.test.synth.environmental.assertSynthWasNotEvaluated(testEnvironment.synth);
    };

    // TODO: These tests irregularly cause exceptions on Node.js
    // in node-speaker and are not viable.
    // We either need to 1) replace node-speaker; 2) mock out the
    // audio backend; or both.
    if (flock.platform.isBrowser) {
        fluid.test.runTests("flock.test.synth.environment.removeDestroyTests");
    }

    fluid.defaults("flock.test.synth.environment.orderTests", {
        gradeNames: "flock.test.module.runOnCreate",

        name: "Synth addToEnviro order tests",

        synthOptions: {
            synthDef: {
                ugen: "flock.ugen.sinOsc"
            }
        },

        invokers: {
            run: {
                funcName: "flock.test.synth.environment.orderTests.run",
                args: [
                    "{that}",
                    "{that}.options.synthOptions",
                    "{that}.options.testSpecs"
                ]
            }
        },

        testSpecs: [
            {
                addToEnvironment: [false],
                expectedOrder: [-1],
                msg: "The synth should not have been added to the environment " +
                    "when its addToEnvironment option was false."
            },
            {
                addToEnvironment: [undefined],
                expectedOrder: [0],
                msg: "The synth should have been added to the environment " +
                    "when its addToEnvironment option was undefined, because flock.synth's default " +
                    "behaviour is to add itself to the environment at the tail."
            },
            {
                addToEnvironment: [null],
                expectedOrder: [-1],
                msg: "The synth should not have been added to the environment " +
                    "when its addToEnvironment option was null."
            },
            {
                addToEnvironment: [true],
                expectedOrder: [0],
                msg: "The synth should have been added to the environment " +
                    "when its addToEnvironment option was set to true."
            },
            {
                addToEnvironment: ["tail", "tail", "head"],
                expectedOrder: [1, 2, 0],
                msg: "The synth should have been added to the head of the environment when its " +
                    "addToEnvironment option is set to 'head'."
            },
            {
                addToEnvironment: ["head", "head", "head", 2],
                expectedOrder: [3, 1, 0, 2],
                msg: "The synth should have been added to the environment at the correct index " +
                    "when its addToEnvironment option was set to an integer."
            },
            {
                addToEnvironment: [true, "head", 2, "tail"],
                expectedOrder: [1, 0, 2, 3],
                msg: "The node order should be correct when specifying a variety of types of " +
                    "addToEnvironment options."
            },
            {
                addToEnvironment: ["tail", "cat"],
                expectedOrder: [0, 1],
                msg: "The synth should be added to tail of the environment " +
                    "when its addToEnvironment option was invalid."
            }
        ]
    });

    flock.test.synth.environment.orderTests.testEnvironmentOrder = function (environment, synthOptions, testSpec) {
        var synths = fluid.transform(synthOptions, function (synthOption) {
            return flock.synth(synthOption);
        });

        var actualOrder = fluid.transform(synths, function (synth) {
            return environment.nodeList.nodes.indexOf(synth);
        });

        jqUnit.assertDeepEq(testSpec.msg, testSpec.expectedOrder, actualOrder);
    };

    flock.test.synth.environment.orderTests.prepareSynthOptions = function (synthOptionsTemplate, testSpec) {
        var addToEnvironmentOptions = testSpec.addToEnvironment;

        return fluid.transform(addToEnvironmentOptions, function (addToEnvironment) {
            var synthOptions = fluid.copy(synthOptionsTemplate);
            synthOptions.addToEnvironment = addToEnvironment;

            return synthOptions;
        });
    };

    flock.test.synth.environment.orderTests.runTest = function (environment, synthOptionsTemplate, testSpec) {
        flock.nodeList.clearAll(environment.nodeList);

        var synthOptions = flock.test.synth.environment.orderTests.prepareSynthOptions(synthOptionsTemplate, testSpec);

        flock.test.synth.environment.orderTests.testEnvironmentOrder(environment, synthOptions, testSpec);

    };

    flock.test.synth.environment.orderTests.run = function (that, synthOptionsTemplate, testSpecs) {
        jqUnit.test("addToEnvironment results in the correct node order", function () {
            jqUnit.expect(8);

            fluid.each(testSpecs, function (testSpec) {
                flock.test.synth.environment.orderTests.runTest(that.environment, synthOptionsTemplate, testSpec);
            });
        });
    };

    flock.test.synth.environment.orderTests();
}());
