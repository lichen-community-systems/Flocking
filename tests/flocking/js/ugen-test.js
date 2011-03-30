/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global module, test, expect, ok, equals, deepEqual, Float32Array*/

var flock = flock || {};

(function () {
    "use strict";
        
    var countNonZeroSamples = function (buffer) {
        var numNonZero = 0;
        for (var i = 0; i < buffer.length; i++) {
            var samp = buffer[i];
            numNonZero = (samp > 0.0) ? numNonZero + 1 : numNonZero;
        }
        return numNonZero;
    };
    
    var checkSampleBoundary = function (buffer, min, max) {
        var aboveMin = true,
            belowMax = true;
            
        for (var i = 0; i < buffer.length; i++) {
            var samp = buffer[i];
            aboveMin = (samp >= min);
            belowMax = (samp <= max);
        }
        
        ok(aboveMin, "No samples in the buffer should go below " + min);
        ok(belowMax, "No samples in the buffer should exceed " + max);
    };
    
    
    module("UGen tests");

    var checkDensity = function (dust, density) {
        // Run the algorithm 100x and average the results.
        var nonZeroSum = 0,
            numRuns = 1500,
            buffer;
        
        for (var i = 0; i < numRuns; i++) {
            buffer = dust.audio(44100);
            nonZeroSum += countNonZeroSamples(buffer);
        }
        var avgNumNonZeroSamples = nonZeroSum / numRuns;
        equals(Math.round(avgNumNonZeroSamples), density, 
            "There should be roughly " + density + " non-zero samples in a one-second buffer.");
    };

    test("flock.ugen.dust", function () {
        var density = 1.0;
        var dust = flock.ugen.dust({
            density: flock.ugen.value({value: density}, new Float32Array(44100), 44100)
        }, new Float32Array(44100), 44100);
        var buffer = dust.audio(44100);
    
        // Check basic details about the buffer: it should be the correct length,
        // and never contain values above 1.0.
        ok(buffer, "A buffer should be returned from dust.audio()");
        equals(buffer.length, 44100, "And it should be the specified length.");
        checkSampleBoundary(buffer, 0.0, 1.0);
    
        // Check that the buffer contains an avg. density of 1.0 non-zero samples per second.
        checkDensity(dust, density);

        // And now try a density of 200.
        density = 200;
        dust.inputs.density = flock.ugen.value({value: density}, new Float32Array(44100), 44100);
        checkDensity(dust, density); 
    });


    var mockLeft = [
        1, 2, 3, 4, 5,
        6, 7, 8, 9, 10,
        11, 12, 13, 14, 15,
        16, 17, 18, 19, 20
    ];

    var monoMockUGen = {
        gen: function (numSamps) {
            return mockLeft;
        }
    };

    var mockRight = [
        20, 19, 18, 17, 16,
        15, 14, 13, 12, 11,
        10, 9, 8, 7, 6, 
        5, 4, 3, 2, 1
    ];

    var stereoMockUGen = {
        gen: function (numSamps) {
            return [mockLeft, mockRight];
        }
    };

    var checkOutput = function (ugen, numSamps, expectedBuffer, msg) {
        var actual = ugen.audio(numSamps);
        deepEqual(actual, expectedBuffer, msg);
    };

    test("flock.ugen.stereoOut mono input", function () {
        // Test with a single mono input buffer.
        var out = flock.ugen.stereoOut({source: monoMockUGen}, [], 44100);
    
        // Pull the whole buffer.
        var expected = [
            1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 
            6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 
            12, 12, 13, 13, 14, 14, 15, 15, 16, 16,
            17, 17, 18, 18, 19, 19, 20, 20
        ];
        checkOutput(out, 20, expected, 
            "We should receive a stereo buffer containing two copies of the original input buffer.");
     
        // Pull a partial buffer.
        expected = [
            1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
            6, 6, 7, 7, 8, 8, 9, 9, 10, 10
        ];
        out.output = []; // Reset the output buffer so we don't get any spare stuff floating in it.
        checkOutput(out, 10, expected, 
            "We should receive a stereo buffer containing two copies of the first 10 items in the input buffer.");
    });

    test("flock.ugen.stereoOut stereo input", function () {
        // Test with two input buffers.
        var out = flock.ugen.stereoOut({source: stereoMockUGen}, [], 44100);
    
        // Pull the whole buffer. Expect a stereo interleaved buffer as the result, 
        // containing two copies of the original input buffer.
        var expected = [
            1, 20, 2, 19, 3, 18, 4, 17, 5, 16, 
            6, 15, 7, 14, 8, 13, 9, 12, 10, 11, 11, 10, 
            12, 9, 13, 8, 14, 7, 15, 6, 16, 5,
            17, 4, 18, 3, 19, 2, 20, 1
        ];
        checkOutput(out, 20, expected, "We should receive a stereo buffer, with each buffer interleaved.");
    });

    test("flock.ugen.stereoOut.audio() with offset", function () {
        // Test with a single mono input buffer.
        var out = flock.ugen.stereoOut({source: monoMockUGen}, [], 44100);
    
        var expectedFirst = [1, 1, 2, 2];
        var expectedSecond = [1, 1, 2, 2, 1, 1, 2, 2];
        var expectedThird = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 3, 3];
    
        var actual = out.audio(2, 0);
        equals(actual.length, 4, "At the first control period, ",
            "the output buffer should be twice the size of the input buffer.");
        deepEqual(actual, expectedFirst, 
            "At the first control period, ",
            "the output buffer should contain interleaved copies of the first two items, ",
            "at the first four index slots.");
    
        actual = out.audio(2, 4);
        equals(actual.length, 8, "At the second control period, the output buffer contain 8 items.");
        deepEqual(actual, expectedSecond, "The output buffer should match the expected buffer.");
    
        actual = out.audio(3, 8);
        equals(actual.length, 14, "At the third control period, the output buffer should contain 14 items");
        deepEqual(actual, expectedThird, "The output buffer should match the expected buffer.");
    });
    
})();
