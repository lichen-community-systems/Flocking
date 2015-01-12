/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2015, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, expect, test*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.registerNamespace("flock.test.blit");

    flock.init();

    module("flock.ugen.blit tests");

    flock.test.blit.testSpecs = [
        {
            name: "440 freq",
            def: {
                ugen: "flock.ugen.blit",
                freq: 440
            }
        },
        {
            name: "10000 freq",
            def: {
                ugen: "flock.ugen.blit",
                freq: 10000
            }
        },
        {
            name: "0 freq",
            def: {
                ugen: "flock.ugen.blit",
                freq: 0
            }
        },
        {
            name: "freq modulated",
            def: {
                ugen: "flock.ugen.blit",
                freq: {
                    ugen: "flock.ugen.sinOsc",
                    freq: 2,
                    mul: 440,
                    add: 444
                }
            }
        }
    ];

    flock.test.blit.runTest = function (testSpec) {
        var numBlocks = testSpec.numBlocks || 750;

        testSpec.def.id = "blit";

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
            expect(2);
            flock.test.arrayNotNaN(actual, "The ugen should never output NaN.");
            flock.test.arrayWithinRange(actual, -1.0, 1.0,
                "The ugen should produce output values ranging between -1 and 1.");
        });
    };

    flock.test.blit.runTests = function (testSpecs) {
        fluid.each(testSpecs, flock.test.blit.runTest);
    };

    flock.test.blit.runTests(flock.test.blit.testSpecs);
}());
