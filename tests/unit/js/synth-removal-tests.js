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
                type: "flock.test.silentSynth",
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

        modules: [
            {
                name: "Synth environmental tests",
                tests: [
                    {
                        expect: 2,
                        name: "Remove synth from the environment",
                        sequence: [
                            {
                                funcName: "flock.test.synth.environment.removeDestroyTester.assertSynthWasAdded",
                                args: "{testEnvironment}"
                            },
                            {
                                func: "{synth}.pause"
                            },
                            {
                                funcName: "flock.test.synth.environment.removeDestroyTester.assertSynthWasRemoved",
                                args: ["{testEnvironment}"]
                            }
                        ]
                    },
                    {
                        expect: 2,
                        name: "Destroying a synth removes it from the environment",
                        sequence: [
                            {
                                func: "{synth}.play"
                            },
                            {
                                funcName: "flock.test.synth.environment.removeDestroyTester.assertSynthWasAdded",
                                args: "{testEnvironment}"
                            },
                            {
                                func: "{synth}.destroy"
                            },
                            {
                                funcName: "flock.test.synth.environment.removeDestroyTester.assertSynthWasRemoved",
                                args: ["{testEnvironment}"]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    flock.test.synth.environment.removeDestroyTester.assertSynthWasAdded = function (testEnvironment) {
        jqUnit.assertTrue(
            "The synth should have been added to the environment.",
            testEnvironment.environment.nodeList.nodes.includes(testEnvironment.synth));
    };

    flock.test.synth.environment.removeDestroyTester.assertSynthWasRemoved = function (testEnvironment) {
        jqUnit.assertFalse(
            "The synth should have been removed from the environment.",
            testEnvironment.environment.nodeList.nodes.includes(testEnvironment.synth));
    };

    fluid.test.runTests("flock.test.synth.environment.removeDestroyTests");
}());
