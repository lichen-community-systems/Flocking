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

    // TODO: Need to add a means by which cases can add
    // additional assertions to the test case.
    // e.g. asserting that all the continuous waveform ugens
    // do in fact produce continuous waveforms.
    flock.test.blit.baseTests = [
        {
            name: "440 freq",
            def: {
                freq: 440
            },
            assertions: [
                {
                    funcName: "flock.test.arrayNotNaN",
                    msg: "There should be no NaN values"
                },
                {
                    funcName: "flock.test.arrayWithinRange",
                    args: [-1, 1],
                    msg: "The array should be within the appropriate amplitude range."
                }
            ]
        },
        {
            name: "10000 freq",
            def: {
                freq: 10000,
                leakRate: 0.15
            },
            assertions: [
                {
                    funcName: "flock.test.arrayNotNaN",
                    msg: "There should be no NaN values"
                },
                {
                    funcName: "flock.test.arrayWithinRange",
                    args: [-1, 1],
                    msg: "The array should be within the appropriate amplitude range."
                }
            ]
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
            },
            assertions: [
                {
                    funcName: "flock.test.arrayNotNaN",
                    msg: "There should be no NaN values"
                },
                {
                    funcName: "flock.test.arrayWithinRange",
                    args: [-1, 1],
                    msg: "The array should be within the appropriate amplitude range."
                }
            ]
        }
    ];

    flock.test.blit.typeSpecificTests = {
        "flock.ugen.blit": [
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
        ],
        "flock.ugen.saw": [],
        "flock.ugen.square": [],
        "flock.ugen.tri": []
    };

    flock.test.blit.runTest = function (testSpec, ugenPath) {
        var numBlocks = testSpec.numBlocks || 750;

        testSpec.def.id = "blit";
        testSpec.def.ugen = ugenPath;

        var synth = flock.synth({
            synthDef: testSpec.def
        });

        // Create a buffer that can hold about a second's worth of audio.
        var actual = new Float32Array(flock.enviro.shared.audioSettings.blockSize * numBlocks);
        for (var i = 0; i < numBlocks; i++) {
            synth.gen();
            actual.set(synth.get("blit").output, i * flock.enviro.shared.audioSettings.blockSize);
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
                fluid.invokeGlobalFunction(assertion.funcName, args);
            });
        });
    };

    flock.test.blit.runTests = function (baseTestSpecs, ugens) {
        fluid.each(ugens, function (typeSpecificTestSpecs, ugenPath) {
            var testSpecs = baseTestSpecs.concat(typeSpecificTestSpecs);

            module(ugenPath + " tests");
            fluid.each(testSpecs, function (testSpec) {
                flock.test.blit.runTest(testSpec, ugenPath);
            });
        });
    };

    flock.test.blit.runTests(flock.test.blit.baseTests, flock.test.blit.typeSpecificTests);
}());
