/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global module, test, expect, ok, equals, deepEqual, Float32Array*/

var flock = flock || {};
flock.test = flock.test || {};

(function () {
    "use strict";

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

    flock.test.mockUGen = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        if (that.options.buffer) {
            that.output = that.options.buffer;
        }
        that.gen = function (numSamps) {}; // No op function--we just pass the output buffer back as-is.
        return that;
    };
    
    var makeMockUGen = function (output) {
        return flock.parse.ugenForDef({
            ugen: "flock.test.mockUGen",
            options: {
                buffer: output
            }
        });
    };
    
    var bufferValueUGen = flock.ugen.value({value: 0}, new Float32Array(1));
    var stereoExpandValueUGen = flock.ugen.value({value: 2}, new Float32Array(1));
    
    // TODO: Create these graphs declaratively!
    
    module("Output tests");
    
    var checkOutput = function (numSamps, chans, outUGen, expectedBuffer, msg) {
        var audioSettings = {
            rates: {
                control: 20
            },
            chans: chans
        };
        
        var evalFn = function () {
            outUGen.gen(numSamps);
        };
        var actual = flock.interleavedDemandWriter(numSamps, evalFn, flock.enviro.shared.buses, audioSettings);
        deepEqual(actual, expectedBuffer, msg);
    };

    test("flock.interleavedDemandWriter() mono input, mono output", function () {
        // Test with a single input buffer being multiplexed by ugen.out.
        var mockLeftUGen = makeMockUGen(mockLeft);
        var out = flock.ugen.out({source: mockLeftUGen, bus: bufferValueUGen}, []);

        // Pull the whole buffer.
        var expected = new Float32Array([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
        ]);
        checkOutput(40, 1, out, expected, 
            "We should receive a mono buffer containing two copies of the original input buffer.");

        // Pull a partial buffer.
        expected = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
        checkOutput(20, 1, out, expected, 
            "We should receive a mono buffer containing the input buffer unmodified.");
    });
    
    test("flock.interleavedDemandWriter() mono input, stereo output", function () {
        // Test with a single mono input buffer.
        var mockLeftUGen = makeMockUGen(mockLeft);
        var out = flock.ugen.out({source: mockLeftUGen, bus: bufferValueUGen, expand: stereoExpandValueUGen}, []);

        // Pull the whole buffer.
        var expected = new Float32Array([
            1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 
            6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 
            12, 12, 13, 13, 14, 14, 15, 15, 16, 16,
            17, 17, 18, 18, 19, 19, 20, 20
        ]);
        checkOutput(20, 2, out, expected, 
            "We should receive a stereo buffer containing two copies of the original input buffer.");
    });

    test("flock.interleavedDemandWriter() stereo input", function () {
        // Test with two input buffers.
        var out = flock.ugen.out({
            source: [
                makeMockUGen(mockLeft), 
                makeMockUGen(mockRight)
            ],
            bus: bufferValueUGen
        }, []);

        // Pull the whole buffer. Expect a stereo interleaved buffer as the result, 
        // containing two copies of the original input buffer.
        var expected = new Float32Array([
            1, 20, 2, 19, 3, 18, 4, 17, 5, 16, 
            6, 15, 7, 14, 8, 13, 9, 12, 10, 11, 11, 10, 
            12, 9, 13, 8, 14, 7, 15, 6, 16, 5,
            17, 4, 18, 3, 19, 2, 20, 1
        ]);
        checkOutput(20, 2, out, expected, "We should receive a stereo buffer, with each buffer interleaved.");
    });
    
    
    module("LFNoise tests");
    
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
        lfNoise.gen(numSamps);
        var outputBuffer = lfNoise.output;
        var slicedOutput = outputBuffer.subarray(0, numSamps);
        checkNoise(slicedOutput, numSamps, {
            numUniqueValues: expectedNumUniqueValues, 
            minValue: 0,
            maxValue: 1.0
        });
    };
    
    test("flock.ugen.lfNoise()", function () {
        var freq = flock.ugen.value({value: 4}, new Float32Array(88200));
        var lfNoise = flock.ugen.lfNoise({freq: freq}, new Float32Array(88200));
        
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
    var genFn = function (numSamps) {
        return testSignal;
    };
    
    var krInput = {
        rate: flock.rates.CONTROL,
        output: testSignal
    };
    var audioInput = {
        rate: flock.rates.AUDIO,
        output: testSignal
    };
    
    var generateTestOutput = function () {
        return [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    };

    var signalTest = function (fn, input, expected, msg) {
        var output = generateTestOutput();
        if (typeof (input.length) === "number") {
            fn(input[0], input[1], output, 10);
        } else {
            fn(input, output, 10);
        }
        deepEqual(output, expected, msg);
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
        var ugen = flock.ugen.mulAdd({mul: mulInput, add: addInput}, generateTestOutput());
        ugen.mulAdd(10);
        deepEqual(ugen.output, expected, msg);
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
    
    module("flock.ugen.osc() tests");
    
    var makeOsc = function (freq, table, bufferSize, sampleRate) {
        var ugenOptions = {
            sampleRate: sampleRate
        };
        
        var inputs = {
            freq: flock.ugen.value({value: freq}, new Float32Array(bufferSize), ugenOptions),
            table: table
        };
        var osc = flock.ugen.osc(inputs, new Float32Array(bufferSize), ugenOptions);
        return osc;
    };
    
    var checkOsc = function (testSpec, expected, msg) {
        var osc = makeOsc(testSpec.freq, testSpec.table, testSpec.numSamps, testSpec.sampleRate);
        osc.gen(testSpec.numSamps);
        deepEqual(osc.output, expected, msg);
    };
    
    test("flock.ugen.osc() simple table lookup", function () {
        var table = new Float32Array([1, 2, 3, 4]);
        
        checkOsc({
            freq: 1,
            sampleRate: 1,
            numSamps: 1,
            table: table
        }, new Float32Array([1]), 
        "At a frequency of 1 and sampling rate of 1, we should only get the first value in the table.");
        
        checkOsc({
            freq: 1,
            sampleRate: 4,
            numSamps: 4,
            table: table
        }, 
        table,
        "At a frequency of 1 and sampling rate of 4, requesting 4 samples should return the whole table.");

        checkOsc({
            freq: 1,
            sampleRate: 4,
            numSamps: 8,
            table: table
        }, 
        new Float32Array([1, 2, 3, 4, 1, 2, 3, 4]),
        "At a frequency of 1 and sampling rate of 4, requesting 8 samples should return the whole table twice.");
        
        checkOsc({
            freq: 2,
            sampleRate: 4,
            numSamps: 4,
            table: table
        }, 
        new Float32Array([1, 3, 1, 3]),
        "At a frequency of 2 and sampling rate of 4, requesting 4 samples should return the first and third samples.");
        
        checkOsc({
            freq: 2,
            sampleRate: 4,
            numSamps: 16,
            table: table
        }, 
        new Float32Array([1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]),
        "At a frequency of 2 and sampling rate of 4, 16 samples should still consist of the first and third samples.");
    });


    module("flock.ugen.osc() tests: specific wave forms");
    
    var basicDef = {
        rate: flock.rates.AUDIO,
        inputs: {
            freq: 2,
            mul: 1.0
        }
    };
     
    var makeAndPrimeOsc = function (ugenType, outputSize) {
        basicDef.ugen = ugenType;
        var ug = flock.parse.ugenForDef(basicDef);
        ug.output = new Float32Array(outputSize);
        ug.gen(outputSize);
        return ug;
    };
    
    var checkUGenShape = function (ug) {
        flock.test.assertNotSilent(ug.output, 
            "1 second of output from the ugen should not be completely silent");
        flock.test.assertUnbroken(ug.output, 
            "The ugen should produce an unbroken audio tone.");
        flock.test.assertContinuous(ug.output, 0.01, 
            "The ugen should produce a continuously changing signal.");
    };
    
    var testBasicWaveformOsc = function (ugenType, otherTests) {
        test(ugenType, function () {
            var ug = makeAndPrimeOsc(ugenType, 44100);
            checkUGenShape(ug);
            if (otherTests) {
                otherTests(ug);
            }
        });
    };
    
    testBasicWaveformOsc("flock.ugen.sinOsc", function (sine) {
        flock.test.assertSineish(sine.output, 1.0, 
            "The sinOsc ugen should continuously rise and fall between 1.0/-1.0.");
    });
    
    testBasicWaveformOsc("flock.ugen.triOsc");

    testBasicWaveformOsc("flock.ugen.squareOsc");

    testBasicWaveformOsc("flock.ugen.sawOsc");

    
    module("flock.ugen.line() tests");
     
    var lineDef = {
        ugen: "flock.ugen.line",
        rate: flock.rates.AUDIO,
        inputs: {
            duration: 0.00146, // 64 samples.
            start: 0,
            end: 64
        }
    };
     
    test("flock.ugen.line()", function () {
        var line = flock.parse.ugenForDef(lineDef);
        
        line.gen(64);
        var expected = flock.test.fillBuffer(0, 63);
        deepEqual(line.output, expected, "Line should generate all samples for its duration but one.");
        
        line.gen(64);
        expected = flock.test.constantBuffer(64, 64);
        deepEqual(line.output, expected, "After the line's duration is finished, it should constantly output the end value.");
    });
    
    test("flock.ugen.line() partial generation.", function () {
        var line = flock.parse.ugenForDef(lineDef);
        
        line.gen(32);
        
        // It's a 64 sample buffer, so split it in half to test it.
        flock.test.assertArrayEquals(line.output.subarray(0, 32), flock.test.fillBuffer(0, 31), 
            "The first half of the line's values should but generated.");
        flock.test.assertArrayEquals(line.output.subarray(32), flock.test.constantBuffer(32, 0),
            "The last 32 samples of the buffer should be empty.");

        line.gen(32);
        flock.test.assertArrayEquals(line.output.subarray(0, 32), flock.test.fillBuffer(32, 63), 
            "The second half of the line's values should be generated.");
        flock.test.assertArrayEquals(line.output.subarray(32), flock.test.constantBuffer(32, 0),
            "The last 32 samples of the buffer should be empty.");
                    
        line.gen(32);
        flock.test.assertArrayEquals(line.output.subarray(0, 32), flock.test.constantBuffer(32, 64),
            "After the line's duration is finished, it should constantly output the end value.");
    });
    
    module("flock.ugen.amplitude() tests");
    
    var ampConstSignalDef = {
        ugen: "flock.ugen.amplitude",
        rate: flock.rates.AUDIO,
        inputs: {
            source: {
                ugen: "flock.test.mockUGen",
                options: {
                    buffer: flock.test.constantBuffer(64, 1.0)
                }
            },
            attack: 0.00001
        }
    };
    
    var generateAndTestContinuousSamples = function (ugen, numSamps) {
        ugen.gen(numSamps);
        flock.test.assertNotNaN(ugen.output, "The unit generator's output should not contain NaN.");
        flock.test.assertNotSilent(ugen.output, 
            "The unit generator's output should not be silent.");
        flock.test.assertContinuous(ugen.output, 0.1,
            "The unit generator's output should not have any major value jumps in it.");
    };
    
    test("flock.ugen.amplitude() with constant value.", function () {
        var tracker = flock.parse.ugenForDef(ampConstSignalDef);
        generateAndTestContinuousSamples(tracker, 64);
        // TODO: Why does an attack time of 0.00001 result in a ramp-up time of three samples, instead of just less than half a sample?
        flock.test.assertArrayEquals(tracker.output.subarray(3, 64), flock.test.constantBuffer(61, 1.0), 
            "With a negligible attack time and a constant input value of 1.0, the amplitude ugen should ramp up quickly to, and remain at, 1.0.");
    });
    
    var ampDescendingLine = {
        ugen: "flock.ugen.amplitude",
        rate: flock.rates.AUDIO,
        inputs: {
            source: {
                ugen: "flock.ugen.line",
                rate: flock.rates.AUDIO,
                start: 1,
                duration: 1.0,
                end: 10
            }
        },
        attack: 0.00001
    };
    
    test("flock.ugen.amplitude() with changing value.", function () {
        var tracker = flock.parse.ugenForDef(ampDescendingLine);

        var controlPeriods = Math.round(44100 / 64),
            i;
        
        for (i = 0; i < controlPeriods; i++) {
            tracker.inputs.source.gen(64);
            generateAndTestContinuousSamples(tracker, 64);
            flock.test.assertClimbing(tracker.output, "The amplitude tracker should follow the contour of its source.");
        }
    });
    
})();
