/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global module, test, expect, ok, equals, deepEqual, Float32Array*/
/*jslint white: true, vars: true, plusplus: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

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
    
    var bufferValueUGen = flock.ugen.value({value: 0}, new Float32Array(1));
    var stereoExpandValueUGen = flock.ugen.value({value: 2}, new Float32Array(1));
    
    module("ugen.input() tests");
    
    var setAndCheckInput = function (ugen, inputName, val) {
        var returnVal = ugen.input(inputName, val);
        ok(returnVal, "Setting a new input should return the input unit generator.");
        ok(ugen.inputs[inputName], "Setting a new input should create a new unit generator with the appropriate name.");
        equals(ugen.inputs[inputName], returnVal, "The return value when setting an input should be the input unit generator.");
        
        var valType = typeof (val);
        if (valType !== "number" && valType !== "string") {
            equals(ugen.inputs[inputName], ugen.input(inputName), "The value returned from input() should be the same as the actual input value.");
        }
    };
    
    var setAndCheckArrayInput = function (ugen, inputName, vals, comparisonFn) {
        setAndCheckInput(ugen, inputName, vals);
        ok(flock.isIterable(ugen.input(inputName)), "The input should be set to an array of unit generators.");
        equals(ugen.input(inputName).length, vals.length, "There should be " + vals.length + " unit generators in the array.");
        $.each(vals, comparisonFn);
    };
    
    test("input() data type tests", function () {
        var mockUGen = flock.test.makeMockUGen(new Float32Array(64));
        
        // Non-existent input.
        var val = mockUGen.input("cat");
        equals(val, undefined, "Getting a non-existent input should return undefined.");
        ok(!mockUGen.inputs.cat, "When getting a non-existent input, it should not be created.");
        
        // Setting a previously non-existent input.
        setAndCheckInput(mockUGen, "cat", {
            ugen: "flock.test.mockUGen"
        });
        
        // Replacing an existing input with an ugenDef.
        setAndCheckInput(mockUGen, "cat", {
            id: "new-cat",
            ugen: "flock.test.mockUGen"
        });
        equals(mockUGen.input("cat").id, "new-cat", "The new input should have the appropriate ID.");
        
        // And with an array of ugenDefs.
        var defs = [
            {
                id: "first-cat",
                ugen: "flock.test.mockUGen"
            },
            {
                id: "second-cat",
                ugen: "flock.test.mockUGen"
            }
        ];
        setAndCheckArrayInput(mockUGen, "cat", defs, function (i, def) {
            equals(mockUGen.input("cat")[i].id, def.id);
        });

        // And with a scalar.
        setAndCheckInput(mockUGen, "cat", 500);
        equals(mockUGen.inputs.cat.model.value, 500, "The input ugen should be a value ugen with the correct model value.");
        
        // And an array of scalars.
        var vals = [100, 200, 300];
        setAndCheckArrayInput(mockUGen, "fish", vals, function (i, val) {
            equals(mockUGen.input("fish")[i].model.value, val);
        });
    });
    
    
    // TODO: Create these graphs declaratively!
    
    module("Output tests");
    
    var checkOutput = function (numSamps, chans, outUGen, expectedBuffer, msg) {
        var audioSettings = {
            rates: {
                control: 20
            },
            chans: chans,
            bufferSize: 40
        };
        
        var evalFn = function () {
            flock.enviro.shared.clearBuses();
            outUGen.gen(numSamps);
        };
        var actual = flock.interleavedWriter(new Float32Array(numSamps * chans), 
            evalFn, flock.enviro.shared.buses, audioSettings);
        deepEqual(actual, expectedBuffer, msg);
    };

    test("flock.interleavedWriter() mono input, mono output", function () {
        // Test with a single input buffer being multiplexed by ugen.out.
        var mockLeftUGen = flock.test.makeMockUGen(mockLeft);
        var out = flock.ugen.out({sources: mockLeftUGen, bus: bufferValueUGen}, []);
        out.input("expand", 1);
        
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
    
    test("flock.interleavedWriter() mono input, stereo output", function () {
        // Test with a single mono input buffer.
        var mockLeftUGen = flock.test.makeMockUGen(mockLeft);
        var out = flock.ugen.out({sources: mockLeftUGen, bus: bufferValueUGen, expand: stereoExpandValueUGen}, []);
        
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

    test("flock.interleavedWriter() stereo input", function () {
        // Test with two input buffers.
        var out = flock.ugen.out({
            sources: [
                flock.test.makeMockUGen(mockLeft), 
                flock.test.makeMockUGen(mockRight)
            ],
            bus: bufferValueUGen
        }, []);
        out.input("expand", 1);
        
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
    
    var simpleOutDef = {
        ugen: "flock.ugen.out",
        bus: 0,
        sources: {
            ugen: "flock.ugen.value",
            value: 1
        }
    };
    
    var testOutputs = function (numRuns, defs, bus, expectedOutput, msg) {
        var synths = [],
            i;
        defs = $.makeArray(defs);
        
        $.each(defs, function (i, def) {
            var synth = flock.synth(def);
            synths.push(synth);
        });
        
        for (i = 0; i < numRuns; i++) {
            flock.enviro.shared.gen();
            flock.test.assertArrayEquals(flock.enviro.shared.buses[bus], expectedOutput, i + ": " + msg);
        }
        
        $.each(synths, function (i, synth) {
            flock.enviro.shared.remove(synth);
        });
                
        return synths;
    };
    
    test("flock.ugen.out()", function () {
        testOutputs(2, simpleOutDef, 0, flock.generate(64, 1),
            "The output should be written to the appropriate environment bus.");
    });
    
    test("flock.ugen.out(): multiple out ugens writing to the same bus", function () {
        var outDefs = [simpleOutDef, simpleOutDef];
        testOutputs(2, outDefs, 0, flock.generate(64, 2),
            "Multiple outputs to the same buffer should be summed.");
    });
    
    
    module("LFNoise tests");
    
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
    
    var krInput = {
        rate: flock.rates.CONTROL,
        output: testSignal
    };
    
    var audioInput = {
        rate: flock.rates.AUDIO,
        output: testSignal
    };
    
    flock.test.mulAdderUGen = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        
        that.gen = function (numSamps) {
            that.mulAdd(that.inputs.mul, that.inputs.add, that.output, numSamps);
        };
        
        flock.onMulAddInputChanged(that);
        return that;
    };
    
    var generateTestOutput = function () {
        return [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    };

    var signalTest = function (fn, inputs, expected, msg) {
        var output = generateTestOutput(),
            args = [10, output].concat(inputs);
        fn.apply(null, args);
        deepEqual(output, expected, msg);
    };
    
    test("flock.krMul()", function () {
        var expected = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20];
        signalTest(flock.krMul, [krInput, undefined], expected, 
            "krMul() should use only the first value of the signal as a multiplier.");
    });
    
    test("flock.mul()", function () {
        var expected = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110];
        signalTest(flock.mul, [audioInput, undefined], expected, 
            "mul() should use each value in the signal as a multiplier.");
    });
    
    test("flock.krAdd()", function () {
        var expected = [12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
        signalTest(flock.krAdd, [undefined, krInput], expected, 
            "krAdd() should use only the first value of the signal for addition.");
    });
    
    test("flock.add()", function () {
        var expected = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
        signalTest(flock.add, [undefined, audioInput], expected, 
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
        var ugen = flock.test.mulAdderUGen({mul: mulInput, add: addInput}, generateTestOutput());
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
    
    
    module("flock.ugen.sum() tests");
     
    test("flock.ugen.sum()", function () {
        var addBuffer = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
            one = flock.test.makeMockUGen(addBuffer),
            two = flock.test.makeMockUGen(addBuffer),
            three = flock.test.makeMockUGen(addBuffer);

        var inputs = {
            sources: [one]
        };
        var summer = flock.ugen.sum(inputs, new Float32Array(addBuffer.length));
        summer.gen(32);
        deepEqual(summer.output, new Float32Array(addBuffer), "With a single source, the output should be identical to the source input.");
        
        inputs.sources = [one, two, three];
        var expected = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93];
        summer.inputs = inputs;
        summer.gen(32);
        deepEqual(summer.output, new Float32Array(expected), "With three sources, the output consist of the inputs added together.");
    });
    
    
    module("flock.ugen.osc() tests");
    
    var makeOsc = function (freq, table, bufferSize, sampleRate) {
        return flock.parse.ugenForDef({
            ugen: "flock.ugen.osc",
            inputs: {
                freq: {
                    ugen: "flock.ugen.value",
                    value: freq
                },
                table: table
            },
            options: {
                sampleRate: sampleRate
            }
        });
    };
    
    var checkOsc = function (testSpec, expected, msg) {
        var osc = makeOsc(testSpec.freq, testSpec.table, testSpec.numSamps, testSpec.sampleRate);
        expected = paddedBuffer(expected, osc.output.length);
        osc.gen(testSpec.numSamps);
        deepEqual(osc.output, expected, msg);
    };
    
    var paddedBuffer = function (values, length) {
        var buf = new Float32Array(length),
            i;
        for (i = 0; i < values.length; i++) {
            buf[i] = values[i];
        }
        return buf;
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
            mul: 0.75
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
        flock.test.assertNotNaN(ug.output, 
            "The ugen should never output NaN.");
        flock.test.assertNotSilent(ug.output, 
            "1 second of output from the ugen should not be completely silent");
        flock.test.assertUnbroken(ug.output, 
            "The ugen should produce an unbroken audio tone.");
        flock.test.assertWithinRange(ug.output, -0.75, 0.75, 
            "The ugen should produce output values ranging between -0.75 and 075.");
    };
    
    var testOsc = function (ugenType, otherTests) {
        test(ugenType, function () {
            var ug = makeAndPrimeOsc(ugenType, 44100);
            checkUGenShape(ug);
            if (otherTests) {
                otherTests(ug);
            }
        });
    };
    
    var testContinuousWaveformOsc = function (ugenType, otherTests) {
        testOsc(ugenType, function (ug) {
            flock.test.assertContinuous(ug.output, 0.01, 
                "The ugen should produce a continuously changing signal.");
            if (otherTests) {
                otherTests(ug);
            }
        });
    };
    
    var testSineishWaveformOsc = function (ugenType) {
        testContinuousWaveformOsc(ugenType, function (sine) {
            flock.test.assertSineish(sine.output, 0.75, 
                "The " + ugenType + " ugen should continuously rise and fall between 0.75/-0.75.");
        });
    };
    
    var testDroppingWaveformOsc = function (ugenType) {
        testOsc(ugenType);
    };
    
    testSineishWaveformOsc("flock.ugen.sinOsc");
    testContinuousWaveformOsc("flock.ugen.triOsc");
    testContinuousWaveformOsc("flock.ugen.squareOsc");
    testContinuousWaveformOsc("flock.ugen.sawOsc");
    
    testSineishWaveformOsc("flock.ugen.sin");
    testDroppingWaveformOsc("flock.ugen.lfPulse");
    testDroppingWaveformOsc("flock.ugen.lfSaw");
    
    
    module("flock.ugen.impulse() tests");
    
    var genOneSecondImpulse = function (freq, phase) {
        var impulseDef = {
            ugen: "flock.ugen.impulse",
            freq: freq,
            phase: phase
        };
        var imp = flock.parse.ugenForDef(impulseDef),
            numSamps = 44100;
        
        imp.output = new Float32Array(numSamps);
        imp.gen(numSamps);
        
        return imp.output;
    };
    
    var testImpulses = function (buffer, impulseLocations, msg) {
        var i;
        
        flock.test.assertValueCount(buffer, 1.0, impulseLocations.length, msg + " should contain the expected number of impulses.");
        flock.test.assertOnlyValues(buffer, [0.0, 1.0], msg + " should only contain zeros and ones.");
        
        for (i = 0; i < buffer.length; i++) {
            if (impulseLocations.indexOf(i) !== -1) {
                equal(buffer[i], 1.0, msg + ", the sample at index " + i + " should contain an impulse.");
            } else {
                if (buffer[i] !== 0.0) {
                    equal(buffer[i], 0.0, msg + ", the sample at index " + i + " should be silent.");
                }
            }
        }
    };
    
    test("flock.ugen.impulse()", function () {
        // TODO: Why are we always one sample late?
        var actual = genOneSecondImpulse(1.0, 0.0);
        testImpulses(actual, [], "With a frequency of 1 Hz and phase of 0.0");
        
        actual = genOneSecondImpulse(1.0, 1.0);
        testImpulses(actual, [0], "With a frequency of 1 Hz and phase of 1.0");
        
        actual = genOneSecondImpulse(1.0, 0.5);
        testImpulses(actual, [22050], "With a frequency of 1 Hz and phase of 0.5");

        actual = genOneSecondImpulse(1.0, 0.01);
        testImpulses(actual, [44100 - (44100 / 100) + 1], "With a frequency of 1 Hz and phase of 0.01");
        
        actual = genOneSecondImpulse(2.0, 0.0);
        testImpulses(actual, [22050], "With a frequency of 2 Hz and phase of 0");

        actual = genOneSecondImpulse(2.0, 0.5);
        testImpulses(actual, [11025, 33075], "With a frequency of 2 Hz and phase of 0.5");

        actual = genOneSecondImpulse(2.0, 1.0);
        testImpulses(actual, [0, 22050], "With a frequency of 2 Hz and phase of 1");
    });
    
    
    module("flock.ugen.playBuffer() tests");
    
    var playbackDef = {
        ugen: "flock.ugen.playBuffer",
        inputs: {
            buffer: {
                id: "playBuffer-unit-tests"
            },
            
            speed: 1.0
        }
    };

    // Register the buffer ourselves. Buffers are multichannel, so need to be wrapped in an array.
    flock.enviro.shared.buffers[playbackDef.inputs.buffer.id] = [flock.test.fillBuffer(1, 64)];

    test("flock.ugen.playBuffer, speed: 1.0", function () {
        var player = flock.parse.ugenForDef(playbackDef);
        
        player.gen(64);
        var expected = flock.enviro.shared.buffers[playbackDef.inputs.buffer.id][0];
        deepEqual(player.output, expected, "With a playback speed of 1.0, the output buffer should be identical to the source buffer.");
        
        player.gen(64);
        expected = flock.test.constantBuffer(64, 0.0);
        deepEqual(player.output, expected, "With looping turned off, the output buffer should be silent once we hit the end of the source buffer.");
        
        player.input("loop", 1.0);
        player.gen(64);
        expected = flock.enviro.shared.buffers[playbackDef.inputs.buffer.id][0];
        deepEqual(player.output, expected, "With looping turned on, the output buffer should repeat the source buffer from the beginning.");
    });
    
    test("flock.ugen.playBuffer, speed: 2.0", function () {
        var player = flock.parse.ugenForDef(playbackDef),
            expected = new Float32Array(64),
            expectedFirst = new Float32Array([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63]),
            expectedSecond = flock.test.constantBuffer(32, 0);
            
        player.input("speed", 2.0);
        
        player.gen(64);
        expected.set(expectedFirst);
        expected.set(expectedSecond, 32);
        deepEqual(player.output, expected, 
            "At double speed, the output buffer contain odd values from the source buffer, padded with zeros.");
        
        player.gen(64);
        expected = flock.test.constantBuffer(64, 0.0);
        deepEqual(player.output, expected, "With looping turned off, the output buffer should be silent once we hit the end of the source buffer.");
        
        player.input("loop", 1.0);
        player.gen(64);
        expected.set(expectedFirst);
        expected.set(expectedFirst, 32);
        deepEqual(player.output, expected,
            "At double speed with looping on, the output buffer should contain two repetitions of the odd values from the source buffer.");
    });
    
    
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
    
    
    module("flock.ugen.env.simpleASR tests");
    
    var simpleASRDef = {
        ugen: "flock.ugen.env.simpleASR",
        rate: flock.rates.AUDIO,
        inputs: {
            start: 0.0,
            attack: 1 / (44100 / 63), // 64 Samples, in seconds
            sustain: 1.0,
            release: 1 / (44100 / 63) // 128 Samples
        }
    };
    
    var testEnvelopeStage = function (buffer, numSamps, expectedStart, expectedEnd, stageName) {
        equal(buffer[0], expectedStart, 
            "During the " + stageName + " stage, the starting level should be " + expectedStart + ".");
        equal(buffer[numSamps - 1], expectedEnd, 
            "At the end of the " + stageName + " stage, the expected end level should have been reached.");
        flock.test.assertUnbroken(buffer, "The output should not contain any dropouts.");
        flock.test.assertWithinRange(buffer, 0.0, 1.0, 
            "The output should always remain within the range between " + expectedStart + " and " + expectedEnd + ".");
        flock.test.assertContinuous(buffer, 0.02, "The buffer should move continuously within its range.");
        
        var isClimbing = expectedStart < expectedEnd;
        var directionText = isClimbing ? "climb" : "fall";
        flock.test.assertRamping(buffer, isClimbing, 
            "The buffer should " + directionText + " steadily from " + expectedStart + " to " + expectedEnd + ".");
    };
    
    test("simpleASR constant values for all inputs", function () {
        var asr = flock.parse.ugenForDef(simpleASRDef);
        
        // Until the gate is closed, the ugen should just output silence.
        asr.gen(64);
        flock.test.assertArrayEquals(asr.output, flock.test.constantBuffer(64, 0.0),
            "When the gate is open at the beginning, the envelope's output should be 0.0.");
        
        // Trigger the attack stage.
        asr.input("gate", 1.0);
        asr.gen(64);
        testEnvelopeStage(asr.output, 64, 0.0, 1.0, "attack");
        
        // Output a full control period of the sustain value.
        asr.gen(64);
        flock.test.assertArrayEquals(asr.output, flock.test.constantBuffer(64, 1.0), 
            "While the gate is open, the envelope should hold at the sustain level.");
        
        // Release the gate and test the release stage.
        asr.input("gate", 0.0);
        asr.gen(64);
        testEnvelopeStage(asr.output, 64, 1.0, 0.0, "release");
        
        // Test a full control period of the end value.
        asr.gen(64);
        flock.test.assertArrayEquals(asr.output, flock.test.constantBuffer(64, 0.0),
            "When the gate is closed and the release stage has completed, the envelope's output should be 0.0.");
         
         // Trigger the attack stage again.
         asr.input("gate", 1.0);
         asr.gen(64);
         testEnvelopeStage(asr.output, 64, 0.0, 1.0, "second attack");
         
         // And the release stage again.
         asr.input("gate", 0.0);
         asr.gen(64);
         testEnvelopeStage(asr.output, 64, 1.0, 0.0, "second release");
    });
    
    test("simpleASR release midway through attack", function () {
        var asr = flock.parse.ugenForDef(simpleASRDef);
        asr.input("gate", 1.0);
        asr.gen(32);
        testEnvelopeStage(asr.output.subarray(0, 32), 32, 0.0, 0.4920634925365448, "halfway through the attack");
        
        // If the gate closes during the attack stage, the remaining portion of the attack stage should be output before the release stage starts.
        asr.input("gate", 0.0);
        asr.gen(32);
        testEnvelopeStage(asr.output.subarray(0, 32), 32, 0.5079365372657776, 1.0, "rest of the attack");
        
        // After the attack stage has hit 1.0, it should immediately start the release phase.
        asr.gen(64);
        testEnvelopeStage(asr.output, 64, 1.0, 0.0, "release");
    });
    
    test("simpleASR attack midway through release", function () {
        var asr = flock.parse.ugenForDef(simpleASRDef);
        
        // Trigger the attack stage, then the release stage immediately.
        asr.input("gate", 1.0);
        asr.gen(64);
        testEnvelopeStage(asr.output, 64, 0.0, 1.0, "attack");
        asr.input("gate", 0.0);
        asr.gen(32);
        testEnvelopeStage(asr.output.subarray(0, 32), 32, 1.0, 0.5079365372657776, "halfway release");
        
        // Then trigger a new attack halfway through the release stage.
        // The envelope should immediately pick up the attack phase from the current level
        // TODO: Note that there will be a one-increment lag before turning direction to the attack phase in this case. Is this a noteworthy bug?
        asr.input("gate", 1.0);
        asr.gen(32);
        testEnvelopeStage(asr.output.subarray(0, 32), 32, 0.4920634925365448, 0.7420005202293396, "attack after halfway release");
        
        // Generate another control period of samples, which should be at the sustain level.
        asr.gen(64);
        testEnvelopeStage(asr.output.subarray(0, 32), 32, 0.7500630021095276, 1.0, "second half of the attack after halfway release second half.");
        flock.test.assertArrayEquals(asr.output.subarray(32), flock.test.constantBuffer(32, 1.0), 
            "While the gate remains open after a mid-release attack, the envelope should hold at the sustain level.");
        
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
            flock.test.assertRamping(tracker.output, true, "The amplitude tracker should follow the contour of its source.");
        }
    });
    
    var outSynthDef = {
        ugen: "flock.ugen.out",
        rate: "audio",
        inputs: {
            bus: 3,
            sources: {
                ugen: "flock.test.mockUGen",
                options: {
                    buffer: flock.test.ascendingBuffer(64, 1)
                }
            }
        }
    };
    
    var inSynthDef = {
        id: "in",
        ugen: "flock.ugen.in",
        rate: "audio",
        inputs: {
            bus: 3
        }
    };
    
    test("flock.ugen.in() single bus input", function () {
        flock.enviro.shared = flock.enviro();
        
        var outSynth = flock.synth(outSynthDef);
        var inSynth = flock.synth(inSynthDef);
        inSynth.enviro.gen();
        var actual = inSynth.ugens.named["in"].output;
        equals(actual, inSynth.enviro.buses[3],
            "With a single source intput, the output of flock.ugen.in should be the actual bus referenced.");
        deepEqual(actual, outSynthDef.inputs.sources.options.buffer,
            "And it should reflect exactly the output of the flock.ugen.out that is writing to the buffer.");
    });
    
    test("flock.ugen.in() multiple bus input", function () {
        flock.enviro.shared = flock.enviro();
        
        var bus3Synth = flock.synth(outSynthDef);
        var bus4Def = $.extend(true, {}, outSynthDef, {
            inputs: {
                bus: 4
            }
        });
        var bus4Synth = flock.synth(bus4Def);
        var multiInDef = $.extend(true, {}, inSynthDef);
        multiInDef.inputs.bus = [3, 4];
        var inSynth = flock.synth(multiInDef);
        
        inSynth.enviro.gen();
        var actual = inSynth.ugens.named["in"].output;
        var expected = flock.generate(64, function (i) {
            return (i + 1) * 2;
        });
        deepEqual(actual, expected,
            "flock.ugen.in should sum the output of each bus when mutiple buses are specified.");
    });
    
    test("flock.ugen.normalize()", function () {
        var testBuffer = flock.test.ascendingBuffer(64, -31),
            mock = {
                ugen: "flock.test.mockUGen",
                options: {
                    buffer: testBuffer
                }
            };
            
        var normalizerSynth = flock.synth({
            id: "normalizer",
            ugen: "flock.ugen.normalize",
            inputs: {
                source: {
                    ugen: "flock.ugen.sum",
                    inputs: {
                        sources: [mock, mock]
                    }
                },
                max: 1.0
            }
        });
        
        var normalizer = normalizerSynth.ugens.named.normalizer;
        normalizerSynth.gen();
        var expected = flock.normalize(flock.test.ascendingBuffer(64, -31), 1.0);
        deepEqual(normalizer.output, expected,
            "The signal should be normalized to 1.0.");
        
        normalizer.input("max", 0.5);
        normalizer.gen(64);
        expected = flock.normalize(flock.test.ascendingBuffer(64, -31), 0.5);
        deepEqual(normalizer.output, expected,
            "When the 'max' input is changed to 0.5, the signal should be normalized to 0.5");
    });
    
    test("flock.ugen.delay", function () {
        var sourceBuffer = flock.test.ascendingBuffer(64, 1),
            sampGenCount = 0,
            incrementingMock = {
                ugen: "flock.test.mockUGen",
                options: {
                    buffer: sourceBuffer,
                    gen: function (that, numSamps) {
                        var i;
                        for (i = 0; i < numSamps; i++) {
                            that.output[i] = that.output[i] + sampGenCount;
                        }
                        sampGenCount += numSamps;
                    }
                }
            },
            delayLineDef = {
                id: "delay",
                ugen: "flock.ugen.delay",
                inputs: {
                    source: incrementingMock,
                    time: 64 / 44100
                }
            };
        
        var delaySynth = flock.synth(delayLineDef);
        var delay = delaySynth.ugens.named.delay;
        delaySynth.gen();
        
        // First block should be silent.
        var expected = new Float32Array(64);
        deepEqual(delay.output, expected,
            "With a delay time equal to the length of a block, the first output block should be silent.");
        
        // Second should contain the first block's contents.
        delaySynth.gen();
        expected = flock.test.ascendingBuffer(64, 1);
        deepEqual(delay.output, expected,
            "The delay's second block should contain the source's first block of samples.");
        
        // Third block should be similarly delayed.
        delaySynth.gen();
        expected = flock.test.ascendingBuffer(64, 65);
        deepEqual(delay.output, expected,
            "The delay's third block should contain the source's second block of samples.");
    });
}());
