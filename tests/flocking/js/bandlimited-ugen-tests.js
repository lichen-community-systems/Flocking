/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2015, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, deepEqual, test*/

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
                freq: 10000
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

    flock.test.blit.typeSpecificTests = {
        "flock.ugen.blit": [
            {
                name: "0 freq",
                def: {
                    freq: 0
                },
                numBlocks: 2,
                expected: new Float32Array(flock.enviro.shared.audioSettings.blockSize * 2),
                msg: "The output should be silent."
            }
        ],
        "flock.ugen.saw": []
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
            flock.test.arrayNotNaN(actual, "The ugen should never output NaN.");
            flock.test.arrayWithinRange(actual, -1.0, 1.0,
                "The ugen should produce output values ranging between -1 and 1.");
            if (testSpec.expected) {
                deepEqual(actual, testSpec.expected, testSpec.msg);
            }
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
