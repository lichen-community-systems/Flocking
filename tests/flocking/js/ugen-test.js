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

    var mockRight = [
        20, 19, 18, 17, 16,
        15, 14, 13, 12, 11,
        10, 9, 8, 7, 6, 
        5, 4, 3, 2, 1
    ];

    var makeMockUGen = function (output) {
        return {
            gen: function (numSamps) {
                return output;
            }
        };
    };
    
    var checkOutput = function (ugen, numSamps, expectedBuffer, msg) {
        var actual = ugen.audio(numSamps);
        deepEqual(actual, expectedBuffer, msg);
    };

    test("flock.ugen.stereoOut mono input", function () {
        // Test with a single mono input buffer.
        var out = flock.ugen.stereoOut({source: makeMockUGen(mockLeft)}, [], 44100);
    
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
        var out = flock.ugen.stereoOut({
            source: [
                makeMockUGen(mockLeft), 
                makeMockUGen(mockRight)
            ]
        }, [], 44100);
    
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
        var out = flock.ugen.stereoOut({source: makeMockUGen(mockLeft)}, [], 44100);
    
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
    
    var checkNoise = function (buffer, numSamps, expected) {
        var minFound = Infinity;
        var maxFound = 0.0;
        var uniqueValues = {};
        
        for (var i = 0; i < numSamps; i++) {
            var samp = buffer[i];
            if (samp < minFound) {
                minFound = samp;
            } else if (samp > maxFound) {
                maxFound = samp;
            }
            uniqueValues[samp] = samp;
        }
        
        ok(minFound >= expected.minValue, 
            "The buffer should not contain any values smaller than " + expected.minValue);
        ok(maxFound <= expected.maxValue, 
            "The buffer should not contain any values larger than " + expected.maxValue);
        equals(flock.test.countKeys(uniqueValues), expected.numUniqueValues, 
            "The buffer should contain approximately " + expected.numUniqueValues + " unique random values");
    };
    
    var generateAndCheckNoise = function (lfNoise, numSamps, expectedNumUniqueValues) {
        var outputBuffer = lfNoise.gen(numSamps);
        var slicer = typeof (Float32Array.prototype.slice) ? outputBuffer.slice : outputBuffer.subarray;
        var slicedOutput = slicer.apply(outputBuffer, [0, numSamps]);
        checkNoise(slicedOutput, numSamps, {
            numUniqueValues: expectedNumUniqueValues, 
            minValue: 0,
            maxValue: 1.0
        });
    };
    
    test("flock.ugen.lfNoise()", function () {
        var freq = flock.ugen.value({value: 4}, new Float32Array(88200), 44100);
        var lfNoise = flock.ugen.lfNoise({freq: freq}, new Float32Array(88200), 44100);
        
        // One second worth of samples. The resulting buffer should contain 4 unique values.
        generateAndCheckNoise(lfNoise, 44100, 4);
        
        // Two half second chunks. 2 unique values each.
        generateAndCheckNoise(lfNoise, 22050, 2);
        generateAndCheckNoise(lfNoise, 22050, 2);
        
        // Two seconds worth of samples. The resulting buffer should contain double the number of unique values.
        generateAndCheckNoise(lfNoise, 88200, 8);
    });
    
    
    module("mul & add tests");
    
    var testSignal = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    var krInput = {
        rate: flock.rates.CONTROL,
        control: function (numSamps) {
            return testSignal;
        }
    };
    var audioInput = {
        rate: flock.rates.AUDIO,
        audio: function (numSamps) {
            return testSignal;
        }
    };
    
    var generateTestOutput = function () {
        return [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    };

    var signalTest = function (fn, input, expected, msg) {
        var output = generateTestOutput(),
            actual;
        if (typeof (input.length) === "number") {
            actual = fn(input[0], input[1], output, 10);
        } else {
            actual = fn(input, output, 10);
        }
        deepEqual(actual, expected, msg);
    };
    
    test("flock.krMul()", function () {
        var expected = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20];
        signalTest(flock.krMul, krInput, expected, 
            "krMul() should use only the first value of the signal as a multiplier.");
    });
    
    test("flock.mul()", function () {
        var expected = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110];
        signalTest(flock.mul, audioInput, expected, 
            "mul() should use each value in the signal as a multiplier.");
    });
    
    test("flock.krAdd()", function () {
        var expected = [12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
        signalTest(flock.krAdd, krInput, expected, 
            "krAdd() should use only the first value of the signal for addition.");
    });
    
    test("flock.add()", function () {
        var expected = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
        signalTest(flock.add, audioInput, expected, 
            "add() should use each value in the signal for addition.");
    });
    
    test("flock.krMulKrAdd()", function () {
        var expected = [22, 22, 22, 22, 22, 22, 22, 22, 22, 22];
        signalTest(flock.krMulKrAdd, [krInput, krInput], expected,
            "krMulKrAdd() should use the first value of both the mul and add signals.");
    });
    
    test("flock.krMulAdd()", function () {
        var expected = [22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
        signalTest(flock.krMulAdd, [krInput, audioInput], expected,
            "krMulAdd() should use the first value of the mul signal and all values of the add signal.");
    });
    
    test("flock.mulKrAdd()", function () {
        var expected = [22, 32, 42, 52, 62, 72, 82, 92, 102, 112];
        signalTest(flock.mulKrAdd, [audioInput, krInput], expected,
            "mulKrAdd() should use all values of the mul signal and the first value of the add signal.");
    });
    
    test("flock.mulAdd()", function () {
        var expected = [22, 33, 44, 55, 66, 77, 88, 99, 110, 121];
        signalTest(flock.mulAdd, [audioInput, audioInput], expected,
            "mulKrAdd() should useall values of both the mul and add signals.");
    });
    
    var mulAddUGenTest = function (mulInput, addInput, expected, msg) {
        var ugen = flock.ugen.mulAdd({mul: mulInput, add: addInput}, generateTestOutput(), 44100);
        var actual = ugen.mulAdd(10);
        deepEqual(actual, expected, msg);
    };
    
    test("flock.ugen.mulAdd()", function () {
        // kr mul
        var expected = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20];
        mulAddUGenTest(krInput, undefined, expected, 
            "flock.ugen.mulAdd() with control rate mul should use the first value of the mul signal.");
            
        // ar mul
        expected = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110];
        mulAddUGenTest(audioInput, undefined, expected, 
            "flock.ugen.mulAdd() with audio rate mul should use alll values of the mul signal.");
            
        // kr add
        expected = [12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
        mulAddUGenTest(undefined, krInput, expected, 
            "flock.ugen.mulAdd() with control rate add should use the first value of the add signal.");

        // ar add
        expected = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
        mulAddUGenTest(undefined, audioInput, expected, 
            "flock.ugen.mulAdd() with audio rate add shoudl use all values of the mul signal.");
            
        // kr mul, kr add
        expected = [22, 22, 22, 22, 22, 22, 22, 22, 22, 22];
        mulAddUGenTest(krInput, krInput, expected, 
            "flock.ugen.mulAdd() with control rate mul and add inputs should use the first value of both signals.");
            
        // kr mul, audio add
        expected = [22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
        mulAddUGenTest(krInput, audioInput, expected, 
            "flock.ugen.mulAdd(), kr mul, audio add: should use the first value of the mul signal and all add values.");
        
        // ar mul, kr add
        expected = [22, 32, 42, 52, 62, 72, 82, 92, 102, 112];
        mulAddUGenTest(audioInput, krInput, expected, 
            "flock.ugen.mulAdd(), ar mul, kr add: should use all values of the mul signal and the first add value.");
                
        // audio mul, audio add
        expected = [22, 33, 44, 55, 66, 77, 88, 99, 110, 121];
        mulAddUGenTest(audioInput, audioInput, expected, 
            "flock.ugen.mulAdd() with audio rate mul and add inputs should use all values of both signals.");
    });
    
})();
