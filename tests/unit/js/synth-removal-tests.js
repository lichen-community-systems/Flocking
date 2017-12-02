/*
 * Flocking Synth Environment Removal Tests
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
        flock.test.synth.genReporter.assertWasEvaluated(testEnvironment.synth);
    };

    flock.test.synth.environment.removeDestroyTester.synthWasRemoved = function (testEnvironment) {
        jqUnit.assertEquals("The synth should have been removed from the environment.",
        testEnvironment.environment.nodeList.nodes.indexOf(testEnvironment.synth),
        -1);
    };

    flock.test.synth.environment.removeDestroyTester.synthWasNotEvaluated = function (testEnvironment) {
        flock.test.synth.genReporter.assertWasNotEvaluated(testEnvironment.synth);
    };

    fluid.test.runTests("flock.test.synth.environment.removeDestroyTests");
}());
