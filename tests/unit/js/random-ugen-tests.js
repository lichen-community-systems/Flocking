/*!
* Flocking Random Unit Generator Unit Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-15, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, Float32Array*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    var environment = flock.silentEnviro(),
        sampleRate = environment.audioSystem.model.rates.audio;

    QUnit.module("LFNoise tests");

    var checkNoise = function (buffer, numSamps, expected) {
        var minFound = Infinity,
            maxFound = 0.0,
            uniqueValues = {},
            i,
            samp;

        for (i = 0; i < numSamps; i++) {
            samp = buffer[i];
            if (samp < minFound) {
                minFound = samp;
            } else if (samp > maxFound) {
                maxFound = samp;
            }
            uniqueValues[samp] = samp;
        }

        QUnit.ok(minFound >= expected.minValue,
            "The buffer should not contain any values smaller than " + expected.minValue);
        QUnit.ok(maxFound <= expected.maxValue,
            "The buffer should not contain any values larger than " + expected.maxValue);
        QUnit.equal(Object.keys(uniqueValues).length, expected.numUniqueValues,
            "The buffer should contain approximately " + expected.numUniqueValues + " unique random values");
    };

    var generateAndCheckNoise = function (lfNoise, numSamps, expectedNumUniqueValues) {
        lfNoise.gen(numSamps);
        var outputBuffer = lfNoise.output;
        var slicedOutput = outputBuffer.subarray(0, numSamps);
        checkNoise(slicedOutput, numSamps, {
            numUniqueValues: expectedNumUniqueValues,
            minValue: 0,
            maxValue: 1.0
        });
    };

    QUnit.test("flock.ugen.lfNoise()", function () {
        var lfNoise = flock.parse.ugenDef({
            ugen: "flock.ugen.lfNoise",
            inputs: {
                freq: 4
            }
        });
        lfNoise.output = new Float32Array(sampleRate * 2);

        // One second worth of samples. The resulting buffer should contain 4 unique values.
        generateAndCheckNoise(lfNoise, sampleRate, 4);

        // Two half second chunks. 2 unique values each.
        generateAndCheckNoise(lfNoise, sampleRate / 2, 2);
        generateAndCheckNoise(lfNoise, sampleRate / 2, 2);

        // Two seconds worth of samples. The resulting buffer should contain double the number of unique values.
        generateAndCheckNoise(lfNoise, sampleRate * 2, 8);
    });

    QUnit.test("flock.ugen.lfNoise() linear interpolation", function () {
        var lfNoise = flock.parse.ugenDef({
            ugen: "flock.ugen.lfNoise",
            inputs: {
                freq: 4
            },
            options: {
                interpolation: "linear"
            }
        });
        lfNoise.output = new Float32Array(sampleRate);

        lfNoise.gen(sampleRate);
        flock.test.unbrokenSignalInRange(lfNoise.output, -1.0, 1.0);
        flock.test.continuousArray(lfNoise.output, 0.0001,
            "The output should be smooth and continuous when interpolated.");
    });


    fluid.registerNamespace("flock.test.noise");

    flock.test.noise.ugenInAudioRange = function (ugenName) {
        var pink = flock.parse.ugenDef({
            ugen: ugenName
        }, undefined, {
            audioSettings: {
                blockSize: 100000
            }
        });
        pink.gen(100000);
        flock.test.unbrokenAudioSignalInRange(pink.output, -1.0, 1.0);
    };


    QUnit.module("flock.ugen.whiteNoise");

    QUnit.test("White noise is in audio signal range", function () {
        flock.test.noise.ugenInAudioRange("flock.ugen.whiteNoise");
    });


    QUnit.module("PinkNoise tests");

    QUnit.test("flock.ugen.pinkNoise() sane output", function () {
        flock.test.noise.ugenInAudioRange("flock.ugen.pinkNoise");
    });


    QUnit.module("Dust tests");

    var checkSampleBoundary = function (buffer, min, max) {
        var aboveMin = true,
            belowMax = true,
            i,
            samp;

        for (i = 0; i < buffer.length; i++) {
            samp = buffer[i];
            aboveMin = (samp >= min);
            belowMax = (samp <= max);
        }

        QUnit.ok(aboveMin, "No samples in the buffer should go below " + min);
        QUnit.ok(belowMax, "No samples in the buffer should exceed " + max);
    };

    var countNonZeroSamples = function (buffer) {
        var numNonZero = 0,
            i,
            samp;
        for (i = 0; i < buffer.length; i++) {
            samp = buffer[i];
            numNonZero = (samp > 0.0) ? numNonZero + 1 : numNonZero;
        }
        return numNonZero;
    };

    var checkDensity = function (dust, density) {
        // Run the algorithm 100x and average the results.
        var nonZeroSum = 0,
            numRuns = 1500,
            buffer = dust.output,
            fuzzFactor = 0.005, // The actual density should be within 0.5% of the expected value.
            samplePadding = density * fuzzFactor,
            highBound = density + samplePadding,
            lowBound = density - samplePadding,
            i,
            avgNumNonZeroSamples;

        for (i = 0; i < numRuns; i++) {
            dust.gen(sampleRate);
            nonZeroSum += countNonZeroSamples(buffer);
        }
        avgNumNonZeroSamples = nonZeroSum / numRuns;
        var roundedAvg = Math.round(avgNumNonZeroSamples);
        QUnit.ok(roundedAvg >= lowBound && roundedAvg <= highBound,
            "There should be roughly " + density + " non-zero samples in a one-second buffer.");
    };

    QUnit.test("flock.ugen.dust", function () {
        var density = 1.0;
        var dust = flock.ugen.dust({
            density: flock.ugen.value({value: density}, new Float32Array(sampleRate))
        }, new Float32Array(sampleRate));
        dust.gen(sampleRate);
        var buffer = dust.output;

        // Check basic details about the buffer: it should be the correct length,
        // and never contain values above 1.0.
        QUnit.ok(buffer, "A buffer should be returned from dust.audio()");
        QUnit.equal(buffer.length, sampleRate, "And it should be the specified length.");
        checkSampleBoundary(buffer, 0.0, 1.0);

        // Check that the buffer contains an avg. density of 1.0 non-zero samples per second.
        checkDensity(dust, density);

        // And now try a density of 200.
        density = 200;
        dust.inputs.density = flock.ugen.value({value: density}, new Float32Array(sampleRate));
        checkDensity(dust, density);
    });

    environment.destroy();
}());
