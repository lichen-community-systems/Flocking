/*!
* Flocking Bandlimited Unit Generator Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2015-2017, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    fluid.registerNamespace("flock.test.blit");

    fluid.defaults("flock.tests.blit.tester", {
        gradeNames: "fluid.component",

        baseTests: [
            {
                name: "440 freq",
                def: {
                    freq: 440
                }
            },
            {
                name: "10000 freq",
                def: {
                    freq: 10000,
                    leakRate: 0.15
                }
            },
            {
                name: "freq modulated",
                def: {
                    freq: {
                        ugen: "flock.ugen.sinOsc",
                        freq: 2,
                        mul: 440,
                        add: 444
                    }
                }
            }
        ],

        impulseAssertions: [
            {
                funcName: "flock.test.arrayNotNaN",
                msg: "There should be no NaN values"
            },
            {
                funcName: "flock.test.arrayWithinRange",
                args: [-1, 1],
                msg: "The array should be within the appropriate amplitude range."
            }
        ],

        waveformAssertions: [
            {
                funcName: "flock.test.unbrokenAudioSignalInRange",
                args: [-1, 1, null],
                msg: "The array should be within the appropriate amplitude range."
            }
        ],

        continuousWaveformAssertions: [
            {
                funcName: "flock.test.continuousArray",
                args: [0.5],
                msg: "The array should be continuous."
            }
        ],

        allContinuousWaveformAssertions: {
            expander: {
                "this": "{that}.options.waveformAssertions",
                method: "concat",
                args: ["{that}.options.continuousWaveformAssertions"]
            }
        },

        typeSpecificTests: {
            "flock.ugen.blit": {
                assertions: "{that}.options.impulseAssertions",

                additionalTests: [
                    {
                        name: "0 freq",
                        def: {
                            freq: 0
                        },
                        numBlocks: 2,
                        assertions: [
                            {
                                funcName: "flock.test.arrayNotNaN",
                                msg: "There should be no NaN values"
                            },
                            {
                                funcName: "deepEqual",
                                args: [
                                    {
                                        expander: {
                                            funcName: "flock.test.createStereoBuffer",
                                            args: [64]
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            "flock.ugen.saw": {
                assertions: "{that}.options.waveformAssertions"
            },
            "flock.ugen.square": {
                assertions: "{that}.options.waveformAssertions"
            },
            "flock.ugen.tri": {
                assertions: "{that}.options.waveformAssertions"
            }
        },

        listeners: {
            "onCreate.runTests": {
                funcName: "flock.test.blit.runTests",
                args: ["{that}.options.baseTests", "{that}.options.typeSpecificTests"]
            }
        }
    });


    flock.test.blit.runAssertion = function (assertion, actual) {
        if (typeof assertion === "string") {
            assertion = {
                funcName: assertion
            };
        }

        var args = assertion.args ? fluid.copy(assertion.args) : [];
        args.unshift(actual);
        args.push(assertion.msg);
        var fn = fluid.getGlobalValue(assertion.funcName);
        fn.apply(null, args);
    };

    flock.test.blit.testAssertions = function (testSpec, actual) {
        fluid.each(testSpec.assertions, function (assertion) {
            flock.test.blit.runAssertion(assertion, actual);
        });
    };

    flock.test.blit.generateOutput = function (synth, testSpec, environment) {
        // Create a buffer that can hold about a second's worth of audio.
        var blockSize = environment.audioSystem.model.blockSize,
            fullSize = blockSize * testSpec.numBlocks,
            actual = new Float32Array(fullSize);

        for (var i = 0; i < testSpec.numBlocks; i++) {
            flock.evaluate.synth(synth);
            for (var j = 0; j < blockSize; j++) {
                actual[j + (i * blockSize)] = synth.get("blit").output[j];
            }
        }

        return actual;
    };

    flock.test.blit.runTest = function (testSpec, ugenPath, module) {
        QUnit.test(testSpec.name, function () {
            testSpec = fluid.copy(testSpec);

            testSpec.numBlocks = testSpec.numBlocks || 750;
            testSpec.def.id = "blit";
            testSpec.def.ugen = ugenPath;

            var synth = flock.synth({
                synthDef: testSpec.def
            });
            var actual = flock.test.blit.generateOutput(synth, testSpec, module.environment);
            flock.test.blit.testAssertions(testSpec, actual);
        });
    };

    flock.test.blit.runTestModule = function (testSpecs, typeSpecificTestSpecs, ugenPath) {
        var module = flock.test.module({
            name: ugenPath + " tests"
        });

        fluid.each(testSpecs, function (testSpec) {
            if (!testSpec.assertions) {
                testSpec.assertions = typeSpecificTestSpecs.assertions;
            }

            flock.test.blit.runTest(testSpec, ugenPath, module);
        });
    };

    flock.test.blit.runTests = function (baseTestSpecs, typeSpecificTestSpecs) {
        fluid.each(typeSpecificTestSpecs, function (typeSpecificTestSpec, ugenPath) {
            var testSpecs = fluid.copy(baseTestSpecs);
            if (typeSpecificTestSpec.additionalTests) {
                testSpecs = testSpecs.concat(typeSpecificTestSpec.additionalTests);
            }
            flock.test.blit.runTestModule(testSpecs, typeSpecificTestSpec, ugenPath);
        });
    };

    flock.tests.blit.tester();
}());
