/*
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
    
    module("Dust tests");

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
    
    var countNonZeroSamples = function (buffer) {
        var numNonZero = 0;
        for (var i = 0; i < buffer.length; i++) {
            var samp = buffer[i];
            numNonZero = (samp > 0.0) ? numNonZero + 1 : numNonZero;
        }
        return numNonZero;
    };
        
    var checkDensity = function (dust, density) {
        // Run the algorithm 100x and average the results.
        var nonZeroSum = 0,
            numRuns = 1500,
            buffer;
    
        for (var i = 0; i < numRuns; i++) {
            buffer = dust.gen(44100);
            nonZeroSum += countNonZeroSamples(buffer);
        }
        var avgNumNonZeroSamples = nonZeroSum / numRuns;
        equals(Math.round(avgNumNonZeroSamples), density, 
            "There should be roughly " + density + " non-zero samples in a one-second buffer.");
    };

    test("flock.ugen.dust", function () {
        var density = 1.0;
        var dust = flock.ugen.dust({
            density: flock.ugen.value({value: density}, new Float32Array(44100))
        }, new Float32Array(44100));
        var buffer = dust.gen(44100);

        // Check basic details about the buffer: it should be the correct length,
        // and never contain values above 1.0.
        ok(buffer, "A buffer should be returned from dust.audio()");
        equals(buffer.length, 44100, "And it should be the specified length.");
        checkSampleBoundary(buffer, 0.0, 1.0);

        // Check that the buffer contains an avg. density of 1.0 non-zero samples per second.
        checkDensity(dust, density);

        // And now try a density of 200.
        density = 200;
        dust.inputs.density = flock.ugen.value({value: density}, new Float32Array(44100));
        checkDensity(dust, density); 
    });

}());