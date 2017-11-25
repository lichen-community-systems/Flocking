/*!
* Flocking Band Tests
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

    fluid.defaults("flock.test.band", {
        gradeNames: "flock.band",

        synthDef: {
            ugen: "flock.ugen.sin"
        },

        components: {
            dog: {
                type: "flock.synth",
                options: {
                    synthDef: "{band}.options.synthDef",
                    addToEnvironment: "tail"
                }
            },

            cat: {
                type: "flock.synth",
                options: {
                    synthDef: "{band}.options.synthDef",
                    addToEnvironment: "head"
                }
            },

            hamster: {
                type: "flock.synth",
                options: {
                    synthDef: "{band}.options.synthDef",
                    addToEnvironment: "tail"
                }
            },

            nonSynth: {
                type: "fluid.component"
            }
        }
    });


    fluid.defaults("flock.test.bandTests", {
        gradeNames: "fluid.test.testEnvironment",

        components: {
            enviro: {
                type: "flock.silentEnviro"
            },

            band: {
                type: "flock.test.band"
            },

            tester: {
                type: "flock.test.bandTester"
            }
        }
    });


    fluid.defaults("flock.test.bandTester", {
        gradeNames: "fluid.test.testCaseHolder",

        modules: [
            {
                name: "flock.band tests",
                tests: [
                    {
                        name: "flock.band with multiple addToEnvironment synths",
                        expect: 3,
                        sequence: [
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "Three synth nodes should have been added to the shared environment.",
                                    3,
                                    "{enviro}.nodeList.nodes.length"
                                ]
                            },
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "The first node in the list should be the synth that declared itself at the head.",
                                    "{band}.cat",
                                    "{enviro}.nodeList.nodes.0"
                                ]
                            },
                            // TODO: This test probably doesn't belong here.
                            {
                                funcName: "jqUnit.assertEquals",
                                args: [
                                    "The synths' enviro's audio strategy's node evaluator should share the same node list as the environment itself.",
                                    "{enviro}.nodeList.nodes",
                                    "{band}.cat.enviro.nodeList.nodes"
                                ]
                            }
                        ]
                    },
                    {
                        name: "getSynths",
                        expect: 4,
                        sequence: [
                            {
                                funcName: "flock.test.bandTester.assertNumSynths",
                                args: ["{band}", 3]
                            },
                            {
                                funcName: "flock.test.bandTester.assertGrades",
                                args: ["{band}", "flock.noteTarget"]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    flock.test.bandTester.assertNumSynths = function (band, expected) {
        var synths = band.getSynths();
        jqUnit.assertEquals("The correct number of synths were returned from getSynths().",
            expected, synths.length);
    };

    flock.test.bandTester.assertGrades = function (band, expectedGrade) {
        var synths = band.getSynths();
        fluid.each(synths, function (synth, i) {
            jqUnit.assertTrue("Synth #" + i + "is a " + expectedGrade,
                expectedGrade, fluid.hasGrade(synth, expectedGrade));
        });
    };

    fluid.test.runTests("flock.test.bandTests");
}());
