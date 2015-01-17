/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2015, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, test*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.registerNamespace("flock.test.blit");

    flock.init();

    flock.test.blit.baseTests = [
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
    ];

    flock.test.blit.impulseAssertions = [
        {
            funcName: "flock.test.arrayNotNaN",
            msg: "There should be no NaN values"
        },
        {
            funcName: "flock.test.arrayWithinRange",
            args: [-1, 1],
            msg: "The array should be within the appropriate amplitude range."
        }
    ];

    flock.test.blit.waveformAssertions = [
        {
            funcName: "flock.test.unbrokenInRangeSignal",
            args: [-1, 1, null],
            msg: "The array should be within the appropriate amplitude range."
        }
    ];

    flock.test.blit.continuousWaveformAssertions = flock.test.blit.waveformAssertions.concat([
        {
            funcName: "flock.test.continuousArray",
            args: [0.5],
            msg: "The array should be continuous."
        }
    ]);

    flock.test.blit.typeSpecificTests = {
        "flock.ugen.blit": {
            assertions: flock.test.blit.impulseAssertions,

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
                            args: [new Float32Array(flock.enviro.shared.audioSettings.blockSize * 2)]
                        }
                    ]
                }
            ]
        },

        "flock.ugen.saw": {
            assertions: flock.test.blit.waveformAssertions
        },
        "flock.ugen.square": {
            assertions: flock.test.blit.waveformAssertions
        },
        "flock.ugen.tri": {
            assertions: flock.test.blit.continuousWaveformAssertions
        }
    };

    flock.test.blit.runTest = function (testSpec, ugenPath) {
        var numBlocks = testSpec.numBlocks || 750;

        testSpec.def.id = "blit";
        testSpec.def.ugen = ugenPath;

        var synth = flock.synth({
            synthDef: testSpec.def
        });

        // Create a buffer that can hold about a second's worth of audio.
        var blockSize = flock.enviro.shared.audioSettings.blockSize,
            fullSize = blockSize * numBlocks,
            actual = new Float32Array(fullSize);

        for (var i = 0; i < numBlocks; i++) {
            synth.gen();
            for (var j = 0; j < blockSize; j++) {
                actual[j + (i * blockSize)] = synth.get("blit").output[j];
            }
        }

        test(testSpec.name, function () {
            fluid.each(testSpec.assertions, function (assertion) {
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
            });
        });
    };

    flock.test.blit.runTests = function (baseTestSpecs, ugens) {
        fluid.each(ugens, function (typeSpecificTestSpecs, ugenPath) {
            var testSpecs = fluid.copy(baseTestSpecs);
            if (typeSpecificTestSpecs.additionalTests) {
                testSpecs = testSpecs.concat(typeSpecificTestSpecs.additionalTests);
            }

            module(ugenPath + " tests");
            fluid.each(testSpecs, function (testSpec) {
                if (!testSpec.assertions) {
                    testSpec.assertions = typeSpecificTestSpecs.assertions;
                }

                flock.test.blit.runTest(testSpec, ugenPath);
            });
        });
    };

    flock.test.blit.runTests(flock.test.blit.baseTests, flock.test.blit.typeSpecificTests);
}());
