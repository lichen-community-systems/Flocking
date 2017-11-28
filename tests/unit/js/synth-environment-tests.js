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

    flock.test.synth.testEnviroGraph = function (fn) {
        setTimeout(function () {
            fn();
        }, 2000);
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
                flock.test.synth.genReporter.assertWasEvaluated(module.autoAddedSynth);
            });

            flock.test.synth.testEnviroGraph(function () {
                flock.test.synth.genReporter.assertWasNotEvaluated(module.notAutoAddedSynth);
                jqUnit.start();
            });
        });
    };

    flock.test.synth.environmental.autoAddTests();


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
