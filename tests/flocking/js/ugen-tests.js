/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, test, ok, equal, deepEqual, expect, Float32Array*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");
    fluid.registerNamespace("flock.test");


    flock.init();

    var sampleRate = flock.enviro.shared.audioSettings.rates.audio;

    module("UGen interpolation configuration tests");

    fluid.registerNamespace("flock.test.ugen.interpolation");

    flock.test.ugen.interpolation.runTests = function (testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            test(testSpec.interpolator, function () {
                var ugen = flock.test.ugen.mock.make(new Float32Array(64), undefined, {
                    interpolation: testSpec.interpolator
                });

                equal(ugen.interpolate, testSpec.expected,
                    "The ugen should have been assigned the " + testSpec.interpolator + " interpolator.");

            });
        });
    };

    flock.test.ugen.interpolation.testSpecs = [
        {
            interpolator: "cubic",
            expected: flock.interpolate.cubic
        },
        {
            interpolator: "linear",
            expected: flock.interpolate.linear
        },
        {
            interpolator: "none",
            expected: flock.interpolate.none
        },
        {
            interpolator: "nonExistent",
            expected: flock.interpolate.none
        }
    ];

    flock.test.ugen.interpolation.runTests(flock.test.ugen.interpolation.testSpecs);


    module("ugen get/set tests");

    var setAndCheckInput = function (ugen, inputName, val) {
        var returnVal = ugen.input(inputName, val);
        ok(returnVal, "Setting a new input should return the input unit generator.");
        ok(ugen.inputs[inputName], "Setting a new input should create a new unit generator with the appropriate name.");
        equal(returnVal, ugen.inputs[inputName], "The return value when setting an input should be the input unit generator.");

        var valType = typeof (val);
        if (valType !== "number" && valType !== "string") {
            equal(ugen.input(inputName), ugen.inputs[inputName], "The value returned from input() should be the same as the actual input value.");
        }
    };

    var setAndCheckArrayInput = function (ugen, inputName, vals, comparisonFn) {
        setAndCheckInput(ugen, inputName, vals);
        ok(flock.isIterable(ugen.input(inputName)), "The input should be set to an array of unit generators.");
        equal(ugen.input(inputName).length, vals.length, "There should be " + vals.length + " unit generators in the array.");
        $.each(vals, comparisonFn);
    };

    test("Get special path segments", function () {
        var s = flock.synth({
            synthDef: {
                id: "carrier",
                ugen: "flock.ugen.sinOsc",
                freq: {
                    ugen: "flock.ugen.xLine",
                    start: {
                        ugen: "flock.ugen.lfNoise",
                        freq: 1/10
                    }
                }
            }
        });

        var ugen = s.get("carrier"),
            actual = ugen.get("freq.start.options");

        expect(2);
        equal(actual, ugen.inputs.freq.inputs.start.options,
            "The options object should be correctly returned");
        equal(ugen.get("freq.start.freq.model.value"),
            ugen.inputs.freq.inputs.start.inputs.freq.model.value,
            "The options object should be correctly returned");

    });

    test("input() data type tests", function () {
        var mockUGen = flock.test.ugen.mock.make(new Float32Array(64));

        // Non-existent input.
        var val = mockUGen.input("cat");
        equal(val, undefined, "Getting a non-existent input should return undefined.");
        ok(!mockUGen.inputs.cat, "When getting a non-existent input, it should not be created.");

        // Setting a previously non-existent input.
        setAndCheckInput(mockUGen, "cat", {
            ugen: "flock.test.ugen.mock"
        });

        // Replacing an existing input with an ugenDef.
        setAndCheckInput(mockUGen, "cat", {
            id: "new-cat",
            ugen: "flock.test.ugen.mock"
        });
        equal(mockUGen.input("cat").id, "new-cat", "The new input should have the appropriate ID.");

        // And with an array of ugenDefs.
        var defs = [
            {
                id: "first-cat",
                ugen: "flock.test.ugen.mock"
            },
            {
                id: "second-cat",
                ugen: "flock.test.ugen.mock"
            }
        ];
        setAndCheckArrayInput(mockUGen, "cat", defs, function (i, def) {
            equal(mockUGen.input("cat")[i].id, def.id);
        });

        // And with a scalar.
        setAndCheckInput(mockUGen, "cat", 500);
        equal(mockUGen.inputs.cat.model.value, 500, "The input ugen should be a value ugen with the correct model value.");

        // And an array of scalars.
        var vals = [100, 200, 300];
        setAndCheckArrayInput(mockUGen, "fish", vals, function (i, val) {
            equal(mockUGen.input("fish")[i].model.value, val);
        });
    });


    // TODO: Create these graphs declaratively!
    module("Output tests", {
        setup: function () {
            flock.enviro.shared = flock.enviro();
        }
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
            i,
            env = flock.enviro.shared;

        defs = $.makeArray(defs);
        $.each(defs, function (i, def) {
            var synth = flock.synth({
                synthDef: def
            });
            synths.push(synth);
        });

        for (i = 0; i < numRuns; i++) {
            env.gen();
            deepEqual(env.buses[bus], expectedOutput, i + ": " + msg);
        }

        $.each(synths, function (i, synth) {
            env.remove(synth);
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


    (function () {
        module("Multichannel tests");

        var testMultichannelUGen = function (ugen, expectedNumOutputs, expectedBlockSize) {
            expect(2 + (2 * expectedNumOutputs));
            equal(ugen.options.numOutputs, expectedNumOutputs,
                "The unit generator should declare that it has two output channels");
            equal(ugen.output.length, expectedNumOutputs,
                "The unit generator should actually have two output channels.");

            for (var i = 0; i < expectedNumOutputs; i++) {
                ok(ugen.output[i] instanceof Float32Array, "Channel #" + i + " should be a Float32Array");
                equal(ugen.output[i].length, expectedBlockSize, "Channel #" + i + " should be block sized.");
            }
        };

        fluid.registerNamespace("flock.tests");

        var genericUGenCreatorFn = function (inputs, outputs, options) {
            var that = flock.ugen(inputs, outputs, options);
            that.onInputChanged();
            return that;
        };

        flock.tests.mockStereoUGen = genericUGenCreatorFn;

        fluid.defaults("flock.tests.mockStereoUGen", {
            ugenOptions: {
                numOutputs: 2,
                tags: ["flock.ugen.multiChannelOutput"]
            }
        });

        test("Multichannel unit generator creation", function () {
            var synth = flock.synth({
                synthDef: {
                    id: "actual",
                    ugen: "flock.tests.mockStereoUGen"
                }
            });

            testMultichannelUGen(synth.get("actual"), 2, synth.audioSettings.blockSize);
        });

        flock.tests.mockMultiInputUGen = genericUGenCreatorFn;

        fluid.defaults("flock.tests.mockMultiInputUGen", {
            ugenOptions: {
                multiInputNames: ["cats"]
            }
        });

        var testMultInputUGen = function (synth, ugenName, multiInputName, expectedProxyUGens) {
            var ugen = synth.get(ugenName);
            equal(Object.keys(ugen.multiInputs).length, 1,
                "The unit generator should have one multiInput configured for it.");
            deepEqual(ugen.multiInputs[multiInputName], expectedProxyUGens,
                "The multinput should have the correct proxy ugens with appropriate rates and buffers configured.");
        };

        test("Multichannel input creation: multiple ugens connected to one input.", function () {
            var s = flock.synth({
                synthDef: {
                    id: "multiIn",
                    ugen: "flock.tests.mockMultiInputUGen",
                    cats: [
                        {
                            ugen: "flock.test.ugen.mock",
                            rate: "audio"
                        },
                        {
                            ugen: "flock.test.ugen.mock",
                            rate: "control"
                        },
                        {
                            ugen: "flock.test.ugen.mock",
                            rate: "audio"
                        }
                    ]
                }
            });

            testMultInputUGen(s, "multiIn", "cats", [
                {
                    rate: "audio",
                    output: new Float32Array(64)
                },
                {
                    rate: "control",
                    output: new Float32Array(1)
                },
                {
                    rate: "audio",
                    output: new Float32Array(64)
                }
            ]);
        });

        test("Multichannel input creation: a single multichannel ugen connected to one input.", function () {
            var s = flock.synth({
                synthDef: {
                    id: "multiIn",
                    ugen: "flock.tests.mockMultiInputUGen",
                    cats: {
                        id: "stereo",
                        ugen: "flock.tests.mockStereoUGen",
                        rate: "audio"
                    }
                }
            });

            var stereo = s.get("multiIn.cats");

            testMultInputUGen(s, "multiIn", "cats", [
                {
                    rate: "audio",
                    output: stereo.output[0]
                },
                {
                    rate: "audio",
                    output: stereo.output[1]
                }
            ]);
        });

        test("Multichannel input creation: a single unichannel ugen connected to a multi-input.", function () {
            var s = flock.synth({
                synthDef: {
                    id: "multiIn",
                    ugen: "flock.tests.mockMultiInputUGen",
                    cats: {
                        id: "mono",
                        ugen: "flock.test.ugen.mock",
                        rate: "audio"
                    }
                }
            });

            var mono = s.get("multiIn.cats");

            testMultInputUGen(s, "multiIn", "cats", [
                {
                    rate: "audio",
                    output: mono.output
                }
            ]);
        });

        test("Multichannel input creation: no ugen connected to a multi-input.", function () {
            var s = flock.synth({
                synthDef: {
                    id: "multiIn",
                    ugen: "flock.tests.mockMultiInputUGen"
                }
            });

            testMultInputUGen(s, "multiIn", "cats", []);
        });
    }());


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
        equal(Object.keys(uniqueValues).length, expected.numUniqueValues,
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

    test("flock.ugen.lfNoise() linear interpolation", function () {
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
        flock.test.unbrokenInRangeSignal(lfNoise.output, -1.0, 1.0);
        flock.test.continuousArray(lfNoise.output, 0.0001,
            "The output should be smooth and continuous when interpolated.");
    });


    module("PinkNoise tests");

    test("flock.ugen.pinkNoise() sane output", function () {
        var pink = flock.parse.ugenDef({
            ugen: "flock.ugen.pinkNoise"
        });
        pink.gen(64);
        flock.test.unbrokenInRangeSignal(pink.output, -1.0, 1.0);
    });


    module("Dust tests");

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

        ok(aboveMin, "No samples in the buffer should go below " + min);
        ok(belowMax, "No samples in the buffer should exceed " + max);
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
        ok(roundedAvg >= lowBound && roundedAvg <= highBound,
            "There should be roughly " + density + " non-zero samples in a one-second buffer.");
    };

    test("flock.ugen.dust", function () {
        var density = 1.0;
        var dust = flock.ugen.dust({
            density: flock.ugen.value({value: density}, new Float32Array(sampleRate))
        }, new Float32Array(sampleRate));
        dust.gen(sampleRate);
        var buffer = dust.output;

        // Check basic details about the buffer: it should be the correct length,
        // and never contain values above 1.0.
        ok(buffer, "A buffer should be returned from dust.audio()");
        equal(buffer.length, sampleRate, "And it should be the specified length.");
        checkSampleBoundary(buffer, 0.0, 1.0);

        // Check that the buffer contains an avg. density of 1.0 non-zero samples per second.
        checkDensity(dust, density);

        // And now try a density of 200.
        density = 200;
        dust.inputs.density = flock.ugen.value({value: density}, new Float32Array(sampleRate));
        checkDensity(dust, density);
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
            one = flock.test.ugen.mock.make(addBuffer),
            two = flock.test.ugen.mock.make(addBuffer),
            three = flock.test.ugen.mock.make(addBuffer);

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

    test("flock.ugen.osc() empty table", function () {
        checkOsc({
            freq: 440,
            sampleRate: 44100,
            numSamps: 64,
            table: []
        }, new Float32Array(64), "With an empty table input, osc should output silence.");
    });

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

    var testOsc = function (ugenType, otherTests) {
        test(ugenType, function () {
            var ug = makeAndPrimeOsc(ugenType, sampleRate);
            flock.test.unbrokenInRangeSignal(ug.output, -0.75, 0.75);
            if (otherTests) {
                otherTests(ug);
            }
        });
    };

    var testContinuousWaveformOsc = function (ugenType, otherTests) {
        testOsc(ugenType, function (ug) {
            flock.test.continuousArray(ug.output, 0.01,
                "The ugen should produce a continuously changing signal.");
            if (otherTests) {
                otherTests(ug);
            }
        });
    };

    var testSineishWaveformOsc = function (ugenType) {
        testContinuousWaveformOsc(ugenType, function (sine) {
            flock.test.sineishArray(sine.output, 0.75, true,
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
            numSamps = sampleRate;

        imp.output = new Float32Array(numSamps);
        imp.gen(numSamps);

        return imp.output;
    };

    var testImpulses = function (buffer, impulseLocations, msg) {
        var i;

        flock.test.valueCount(buffer, 1.0, impulseLocations.length, msg + " should contain the expected number of impulses.");
        flock.test.arrayContainsOnlyValues(buffer, [0.0, 1.0], msg + " should only contain zeros and ones.");

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
        testImpulses(actual, [sampleRate / 2], "With a frequency of 1 Hz and phase of 0.5");

        actual = genOneSecondImpulse(1.0, 0.01);
        testImpulses(actual, [sampleRate - (sampleRate / 100) + 1], "With a frequency of 1 Hz and phase of 0.01");

        actual = genOneSecondImpulse(2.0, 0.0);
        testImpulses(actual, [sampleRate / 2], "With a frequency of 2 Hz and phase of 0");

        actual = genOneSecondImpulse(2.0, 0.5);
        testImpulses(actual, [sampleRate / 4, sampleRate - sampleRate / 4], "With a frequency of 2 Hz and phase of 0.5");

        actual = genOneSecondImpulse(2.0, 1.0);
        testImpulses(actual, [0, sampleRate / 2], "With a frequency of 2 Hz and phase of 1");
    });


    module("flock.ugen.playBuffer", {
        setup: function () {
            var bufDesc = flock.bufferDesc({
                id: flock.test.ugen.playBuffer.playbackDef.inputs.buffer.id,
                format: {
                    sampleRate: sampleRate
                },
                data: {
                    channels: [flock.test.fillBuffer(1, 64)]
                }
            });
            flock.parse.bufferForDef.resolveBuffer(bufDesc, undefined, flock.enviro.shared);
        }
    });

    fluid.registerNamespace("flock.test.ugen.playBuffer");

    flock.test.ugen.playBuffer.playbackDef = {
        ugen: "flock.ugen.playBuffer",
        inputs: {
            buffer: {
                id: "playBuffer-unit-tests"
            },

            speed: 1.0
        }
    };

    fluid.each(["audio", "control", "constant"], function (rate) {
        test("Normal speed, " + rate + " rate", function () {
            var def = fluid.copy(flock.test.ugen.playBuffer.playbackDef);
            def.inputs.speed = {
                ugen: "flock.ugen.value",
                value: 1.0,
                rate: rate
            };

            var player = flock.parse.ugenForDef(def);

            // Make sure to generate the input's signal if necessary.
            if (player.inputs.speed.rate !== flock.rates.CONSTANT) {
                player.inputs.speed.gen(64);
            }

            player.gen(64);
            var expected = flock.enviro.shared.buffers[def.inputs.buffer.id].data.channels[0];
            deepEqual(player.output, expected, "With a playback speed of 1.0, the output buffer should be identical to the source buffer.");

            player.gen(64);
            expected = flock.generate(64, 0.0);
            deepEqual(player.output, expected, "With looping turned off, the output buffer should be silent once we hit the end of the source buffer.");

            player.input("loop", 1.0);
            player.gen(64);
            expected = flock.enviro.shared.buffers[def.inputs.buffer.id].data.channels[0];
            deepEqual(player.output, expected, "With looping turned on, the output buffer should repeat the source buffer from the beginning.");
        });

        test("Double speed, " + rate + " rate", function () {
            var def = fluid.copy(flock.test.ugen.playBuffer.playbackDef);
            def.inputs.speed = {
                ugen: "flock.ugen.value",
                value: 2.0,
                rate: rate
            };

            var player = flock.parse.ugenForDef(def),
                expected = new Float32Array(64),
                expectedFirst = new Float32Array([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63]),
                expectedSecond = flock.generate(32, 0);

            // Make sure to generate the input's signal if necessary.
            if (player.inputs.speed.rate !== flock.rates.CONSTANT) {
                player.inputs.speed.gen(64);
            }

            player.gen(64);
            expected.set(expectedFirst);
            expected.set(expectedSecond, 32);
            deepEqual(player.output, expected,
                "At double speed, the output buffer contain odd values from the source buffer, padded with zeros.");

            player.gen(64);
            expected = flock.generate(64, 0.0);
            deepEqual(player.output, expected, "With looping turned off, the output buffer should be silent once we hit the end of the source buffer.");

            player.input("loop", 1.0);
            player.gen(64);
            expected.set(expectedFirst);
            expected.set(expectedFirst, 32);
            deepEqual(player.output, expected,
                "At double speed with looping on, the output buffer should contain two repetitions of the odd values from the source buffer.");
        });

        test("backward speed at " + rate + " rate", function () {
            var player = flock.parse.ugenForDef(flock.test.ugen.playBuffer.playbackDef),
                expected = flock.test.fillBuffer(64, 1);

            player.input("speed", {
                ugen: "flock.ugen.value",
                value: -1.0,
                rate: rate
            });

            // Make sure to generate the input's signal if necessary.
            if (player.inputs.speed.rate !== flock.rates.CONSTANT) {
                player.inputs.speed.gen(64);
            }

            player.gen(64);
            deepEqual(player.output, expected, "The buffer should be read in reverse");

            player.gen(64);
            deepEqual(player.output, flock.test.silentBlock64, "Playback should not loop.");

            player.input("loop", 1.0);
            player.gen(64);
            deepEqual(player.output, expected,
                "With looping turned on, the buffer should again be read in reverse");
        });

        test("trigger " + rate + " rate, initially closed", function () {
            var player = flock.parse.ugenForDef(flock.test.ugen.playBuffer.playbackDef);

            player.set("trigger", {
                ugen: "flock.ugen.value",
                value: 0.0,
                rate: rate
            });
            player.gen(64);

            deepEqual(player.output, flock.test.silentBlock64,
                "When not looping, and before the trigger has fired, the unit generator should output silence.");

            player.set("loop", {
                ugen: "flock.ugen.value",
                value: 1.0,
                rate: rate
            });
            player.gen(64);

            deepEqual(player.output, flock.test.silentBlock64,
                "When looping, but before the trigger has fired, the unit generator should output silence.");
        });
    });


    flock.test.ugen.playBuffer.rawBufferArray = new Float32Array([
        0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
        0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0,
        -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0,
        -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, -0.0
    ]);

    flock.test.ugen.playBuffer.bufDefTestSpecs = [
        {
            name: "Raw buffer specified as the buffer input",
            buffer: flock.test.ugen.playBuffer.rawBufferArray
        },
        {
            name: "BufferDesc specified as the buffer input",
            buffer: {
                data: {
                    channels: [flock.test.ugen.playBuffer.rawBufferArray]
                },
                format: {
                    numChannels: 1
                }
            }
        }
    ];

    flock.test.ugen.playBuffer.testBufferInput = function (testSpec) {
        test(testSpec.name, function () {
            var s = flock.synth({
                synthDef: {
                    id: "player",
                    ugen: "flock.ugen.playBuffer",
                    trigger: 1.0,
                    loop: 1.0,
                    buffer: testSpec.buffer
                }
            });

            s.gen();
            flock.test.unbrokenInRangeSignal(s.get("player").output, -1.0, 1.0);
        });
    };

    fluid.each(flock.test.ugen.playBuffer.bufDefTestSpecs,
        flock.test.ugen.playBuffer.testBufferInput);


    module("flock.ugen.amplitude() tests");

    var ampConstSignalDef = {
        ugen: "flock.ugen.amplitude",
        rate: flock.rates.AUDIO,
        inputs: {
            source: {
                ugen: "flock.test.ugen.mock",
                options: {
                    buffer: flock.generate(64, 1.0)
                }
            },
            attack: 0.00001
        }
    };

    var generateAndTestContinuousSamples = function (ugen, numSamps) {
        ugen.gen(numSamps);
        flock.test.arrayNotNaN(ugen.output, "The unit generator's output should not contain NaN.");
        flock.test.arrayNotSilent(ugen.output,
            "The unit generator's output should not be silent.");
        flock.test.continuousArray(ugen.output, 0.1,
            "The unit generator's output should not have any major value jumps in it.");
    };

    test("Constant value source input.", function () {
        var tracker = flock.parse.ugenForDef(ampConstSignalDef);
        generateAndTestContinuousSamples(tracker, 64);
        // TODO: Why does an attack time of 0.00001 result in a ramp-up time of three samples, instead of just less than half a sample?
        deepEqual(flock.copyBuffer(tracker.output, 3, 64), flock.generate(61, 1.0),
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

    test("Changing value source input.", function () {
        var tracker = flock.parse.ugenForDef(ampDescendingLine);

        var controlPeriods = Math.round(sampleRate / 64),
            i;

        for (i = 0; i < controlPeriods; i++) {
            tracker.inputs.source.gen(64);
            generateAndTestContinuousSamples(tracker, 64);
            flock.test.rampingArray(tracker.output, true,
                "The amplitude tracker should follow the contour of its source.");
        }
    });

    (function () {
        module("flock.ugen.gate() tests");

        fluid.defaults("flock.test.gateSynth", {
            gradeNames: ["flock.synth", "autoInit"],
            synthDef: {
                id: "gate",
                ugen: "flock.ugen.gate",
                source: {
                    ugen: "flock.test.ugen.mock",
                    options: {
                        buffer: flock.test.ascendingBuffer(64, 1)
                    }
                },
                threshold: 32
            }
        });

        var testGate = function (expectedOutput, synthOptions) {
            var gateSynth = flock.test.gateSynth(synthOptions),
                gateUGen = gateSynth.get("gate");

            gateSynth.gen();
            deepEqual(gateUGen.output, expectedOutput,
                "The gate should open and remain open when the source signal hits the threshold.");
        };

        var runGateTests = function (testSpecs) {
            fluid.each(testSpecs, function (testSpec) {
                test(testSpec.name, function () {
                    testGate(testSpec.expectedOutput, testSpec.synthOptions);
                });
            });
        };

        var gateTestSpecs = [
            {
                name: "without a separate sideChain input",
                expectedOutput: flock.generate(64, function (i) {
                    return i > 30 ? i + 1 : 0;
                })
            },
            {
                name: "with a separate sideChain input",
                expectedOutput: flock.generate(64, function (i) {
                    return i > 9 ? i + 1 : 0;
                }),
                synthOptions:{
                    synthDef: {
                        threshold: 0.5,
                        sideChain: {
                            ugen: "flock.test.ugen.mock",
                            options: {
                                buffer: flock.test.ascendingBuffer(64, 0, 0.05)
                            }
                        }
                    }
                }
            },
            {
                name: "with holdLastValue enabled",
                expectedOutput: flock.generate(64, function (i) {
                    return i % 2 ? i + 1 : i;
                }),
                synthOptions: {
                    synthDef: {
                        threshold: 1,
                        sideChain: {
                            ugen: "flock.test.ugen.mock",
                            options: {
                                buffer: flock.generate(64, function (i) {
                                    return i % 2 ? 1.0 : 0.0;
                                })
                            }
                        },
                        options: {
                            holdLastValue: true
                        }
                    }
                }
            }
        ];

        runGateTests(gateTestSpecs);

    }());


    var outSynthDef = {
        ugen: "flock.ugen.out",
        rate: "audio",
        inputs: {
            bus: 62,
            expand: 1,
            sources: {
                ugen: "flock.test.ugen.mock",
                id: "bufferMock",
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
            bus: 62
        }
    };

    // TODO: We're using 64 buses here so we don't run into
    // legitimate output buses when running tests while plugged into a multichannel
    // audio interface. This illustrates why we should have some kind of separation between
    // interconnect buses and output buses.
    var inEnviroOptions = {
        audioSettings: {
            numBuses: 64
        }
    };

    test("flock.ugen.in() single bus input", function () {
        flock.enviro.shared = flock.enviro(inEnviroOptions);
        var outSynth = flock.synth({
            synthDef: outSynthDef
        });
        var inSynth = flock.synth({
            synthDef: inSynthDef
        });

        flock.enviro.shared.gen();
        var actual = inSynth.namedNodes["in"].output;
        deepEqual(actual, inSynth.enviro.buses[62],
            "With a single source input, the output of flock.ugen.in should a copy of the bus referenced.");
        deepEqual(actual, outSynth.get("bufferMock").options.buffer,
            "And it should reflect exactly the output of the flock.ugen.out that is writing to the buffer.");
    });

    test("flock.ugen.in() multiple bus input", function () {
        flock.enviro.shared = flock.enviro(inEnviroOptions);


        var bus4Def = $.extend(true, {}, outSynthDef, {
            inputs: {
                bus: 63
            }
        });

        var multiInDef = $.extend(true, {}, inSynthDef);
        multiInDef.inputs.bus = [62, 63];

        flock.synth({
            synthDef: outSynthDef
        });

        flock.synth({
            synthDef: bus4Def
        });

        var inSynth = flock.synth({
            synthDef: multiInDef
        });

        inSynth.enviro.gen();
        var actual = inSynth.namedNodes["in"].output;
        var expected = flock.generate(64, function (i) {
            return (i + 1) * 2;
        });
        deepEqual(actual, expected,
            "flock.ugen.in should sum the output of each bus when mutiple buses are specified.");
    });

    test("flock.ugen.normalize()", function () {
        var testBuffer = flock.test.ascendingBuffer(64, -31),
            mock = {
                ugen: "flock.test.ugen.mock",
                options: {
                    buffer: testBuffer
                }
            };

        var normalizerSynth = flock.synth({
            synthDef: {
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
            }
        });

        var normalizer = normalizerSynth.namedNodes.normalizer;
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


    module("flock.ugen.math() tests");

    var testMath = function (synthDef, expected, msg) {
        synthDef.id = "math";
        var synth = flock.synth({
            synthDef: synthDef
        });
        synth.gen();
        var math = synth.namedNodes.math;
        deepEqual(math.output, expected, msg);
    };

    test("flock.ugen.math() value inputs", function () {
        testMath({
            ugen: "flock.ugen.math",
            inputs: {
                source: 2,
                add: 5
            }
        }, flock.generate(64, 7), "Value add");

        testMath({
            ugen: "flock.ugen.math",
            inputs: {
                source: 3,
                sub: 2
            }
        }, flock.generate(64, 1), "Value subtract");

        testMath({
            ugen: "flock.ugen.math",
            inputs: {
                source: 3,
                mul: 2
            }
        }, flock.generate(64, 6), "Value multiply");

        testMath({
            ugen: "flock.ugen.math",
            inputs: {
                source: 3,
                div: 2
            }
        }, flock.generate(64, 1.5), "Value divide");
    });

    test("flock.ugen.math() audio and control rate inputs", function () {
        var incBuffer = flock.generate(64, function (i) {
            return i + 1;
        });

        var expected = flock.generate(64, function (i) {
            return i + 4;
        });

        var krArUGenDef = {
            ugen: "flock.ugen.math",
            inputs: {
                source: {
                    ugen: "flock.ugen.sequence",
                    rate: "audio",
                    list: incBuffer,
                    freq: sampleRate
                },
                add: 3
            }
        };

        testMath(krArUGenDef, expected, "Audio rate source, value add");

        krArUGenDef.inputs.source.rate = "control";
        testMath(krArUGenDef, flock.generate(64, 4), "Control rate source, value add");

        krArUGenDef.inputs.add = {
            ugen: "flock.ugen.sequence",
            rate: "control",
            list: incBuffer,
            freq: sampleRate
        };
        testMath(krArUGenDef, flock.generate(64, 2), "Control rate source, control rate add.");

        krArUGenDef.inputs.source.rate = "audio";
        krArUGenDef.inputs.add.rate = "audio";
        testMath(krArUGenDef, flock.generate(64, function (i) {
            var j = i + 1;
            return j + j;
        }), "Audio rate source, audio rate add.");
    });


    (function () {
        module("flock.ugen.filter tests");

        var filterInputValues = [
            {
                freq: 440,
                q: 1.0
            },
            {
                freq: 880,
                q: 0.5
            },
            {
                freq: 22050,
                q: 0.1
            },
            {
                freq: 440,
                q: 10
            },
            {
                freq: 880,
                q: 20
            },
            {
                freq: 22050,
                q: 100
            }
        ];

        var checkCoefficient = function (coefficient) {
            ok(!isNaN(coefficient), "The coefficient should never be NaN");
            ok(coefficient !== Infinity, "The coefficient should never be Infinity");
            ok(coefficient !== Number.NEGATIVE_INFINITY, "The coefficient should never be negative Infinity");
            //ok(coefficient >= -1.0 && coefficient <= 1.0, "The coefficient should be in the range of -1.0 to 1.0");
        };

        var checkCoefficients = function (model) {
            $.each(model.coeffs, function (i, coefficientArray) {
                $.each(coefficientArray, function (i, coefficient) {
                    checkCoefficient(coefficient);
                });
            });
        };

        var forEachFilterType = function (fn) {
            $.each(flock.coefficients, function (recipeName, recipe) {
                $.each(recipe, function (filterType, calculator) {
                    // TODO: This suggests that the payload for filter recipes isn't quite right.
                    if (filterType === "sizes") {
                        return;
                    }
                    fn(recipeName, recipe, filterType, calculator);
                });
            });
        };

        var testEachFilterInputValue = function (name, fn) {
            test(name, function () {
                $.each(filterInputValues, function (i, inputs) {
                    fn(inputs);
                });
            });
        };

        // Test all coefficient recipes.
        forEachFilterType(function (recipeName, receipe, filterType, fn) {
            var name = "flock.coefficients." + recipeName + "." + filterType;

            testEachFilterInputValue(name, function (inputs) {
                var model = {
                    coeffs: {
                        a: new Float32Array(2),
                        b: new Float32Array(3)
                    },
                    sampleRate: sampleRate
                };

                fn(model, inputs.freq, inputs.q);
                checkCoefficients(model);
            });
        });

        // Test the flock.ugen.filter unit generator with all filter types and a set of generic input values.
        /*
        forEachFilterType(function (recipeName, recipe, filterType) {
            var name = "flock.ugen.filter() " + recipeName + "." + filterType;
            testEachFilterInputValue(name, function (inputs) {
                var ugen = {
                    id: "filter",
                    ugen: "flock.ugen.filter",
                    inputs: inputs,
                    options: {
                        // TODO: API bug. I should just be able to specify a type (as a key path) without a recipe if I want.
                        recipe: recipe,
                        type: filterType
                    }
                };
                ugen.inputs.source = {
                    ugen: "flock.ugen.lfNoise",
                    inputs: {
                        freq: 440,
                        mul: 0.95
                    }
                };

                var filterSynth = flock.synth(ugen);
                filterSynth.gen(64);
                flock.test.arrayUnbrokenSignal(filterSynth.get("filter"), -1.0, 1.0);
            });
        });
        */
    }());

    test("flock.ugen.delay", function () {
        var sourceBuffer = flock.test.ascendingBuffer(64, 1),
            sampGenCount = 0,
            incrementingMock = {
                ugen: "flock.test.ugen.mock",
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
                    time: 64 / sampleRate
                }
            };

        var delaySynth = flock.synth({
            synthDef:delayLineDef
        });
        var delay = delaySynth.namedNodes.delay;
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


    module("flock.ugen.bufferDuration tests", {
        setup: function () {
            var bufDesc = flock.bufferDesc({
                id: "bufferDurationTests",
                format: {
                    sampleRate: sampleRate
                },
                data: {
                    channels: [flock.test.ascendingBuffer(sampleRate * 2.5, 0)] // 2.5 second buffer
                }
            });
            flock.parse.bufferForDef.resolveBuffer(bufDesc, undefined, flock.enviro.shared);
        }
    });

    var testBufferDuration = function (rate) {
        test(rate + " rate", function () {
            var durationDef = {
                id: "dur",
                rate: rate,
                ugen: "flock.ugen.bufferDuration",
                buffer: {
                    id: "bufferDurationTests"
                }
            };

            var synth = flock.synth({
                synthDef: durationDef
            });
            var durUGen = synth.namedNodes.dur;

            synth.gen();
            equal(durUGen.output[0], 2.5,
                "The buffer's length in seconds should be returned");
        });
    };

    var testBufferDurationAtAllRates = function () {
        var supportedRates = ["constant", "control"];
        $.each(supportedRates, function (i, rate) {
            testBufferDuration(rate);
        });
    };

    testBufferDurationAtAllRates();


    module("flock.ugen.sequence tests");

    var testSequenceDemand = function (ugen, expectedSequence) {
        for (var i = 0; i < expectedSequence.length; i++) {
            ugen.gen(1);
            equal(ugen.output[0], expectedSequence[i]);
        }
    };


    var testSequenceAudio = function (ugen, expectedSequence) {
        ugen.gen(64);
        deepEqual(ugen.output, expectedSequence);
    };

    var testSequences = function (testSpec) {
        var ugen = testSpec.ugen;
        var fn = ugen.rate === "audio" ? testSequenceAudio : testSequenceDemand;

        fluid.each(testSpec.tests, function (test) {
            if (test.inputs) {
                ugen.set(test.inputs);
            }

            fn(ugen, test.expectedSequence);
        });
    };

    var seqUGenDef = {
        ugen: "flock.ugen.sequence",
        inputs: {
            freq: (sampleRate / 64) * 4,
            start: 0.0,
            loop: 0.0,
            list: [12, 24, 48]
        }
    };

    test("Demand rate", function () {
        seqUGenDef.rate = "demand";
        var seq = flock.parse.ugenDef(seqUGenDef);

        testSequences({
            ugen: seq,
            tests: [
                {
                    expectedSequence: new Float32Array([12, 24, 48, 48, 48])
                },
                {
                    inputs: {
                        loop: 1.0
                    },
                    expectedSequence: new Float32Array([12, 24, 48, 12, 24, 48, 12])
                },
                {
                    inputs: {
                        start: 1,
                        end: 2
                    },
                    expectedSequence: new Float32Array([24, 24, 24, 24])
                },
                {
                    inputs: {
                        start: 0,
                        end: null
                    },
                    expectedSequence: new Float32Array([48, 12, 24, 48])
                }
            ]
        });
    });

    test("Audio rate", function () {
        seqUGenDef.rate = "audio";
        var seq = flock.parse.ugenDef(seqUGenDef);

        testSequences({
            ugen: seq,
            tests: [
                {
                    expectedSequence: new Float32Array([
                        12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
                        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48
                    ])
                },

                // Looping.
                {
                    inputs: {
                        "loop": 0.5
                    },
                    expectedSequence: new Float32Array([
                        12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
                        12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12
                    ])
                },

                // With start/end boundaries.
                {
                    inputs: {
                        start: 1,
                        end: 2
                    },
                    expectedSequence: new Float32Array([
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24
                    ])
                },

                // Back to no boundaries.
                {
                    inputs: {
                        start: 0,
                        end: null
                    },
                    expectedSequence: new Float32Array([
                        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
                        12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12,
                        24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
                        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48
                    ])
                }
            ]
        });
    });

    module("flock.ugen.midiFreq tests");

    var testNoteControl = function (ugen, midiNote, expected, msg) {
        if (midiNote) {
            ugen.set("source", midiNote);
        }

        if (ugen.get("source").gen) {
            ugen.get("source").gen(1);
        }
        ugen.gen(1);
        flock.test.equalRounded(2, ugen.output[0], expected, msg);
    };

    var testNotesControl = function (ugen, testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            testNoteControl(ugen, testSpec.midiNote, testSpec.expectedFreq, testSpec.msg);
        });
    };

    test("12TET/A440, constant rate input", function () {
        var midiFreq = flock.parse.ugenDef({
            ugen: "flock.ugen.midiFreq",
            source: 60
        });

        testNotesControl(midiFreq, [
            {
                midiNote: 60,
                expectedFreq: 261.63,
                msg: "C4 (MIDI 60) should be converted to 261.64 Hz."
            },
            {
                midiNote: 21,
                expectedFreq: 27.50,
                msg: "A0 (MIDI 21) should be converted to 27.5 Hz."
            },
            {
                midiNote: 108,
                expectedFreq: 4186.01,
                msg: "C8 (MIDI 108) should be converted to 4186 Hz."
            }
        ]);
    });

    test("12TET/A440, control rate input", function () {
        var midiFreq = flock.parse.ugenDef({
            ugen: "flock.ugen.midiFreq",
            source: {
                ugen: "flock.ugen.sequence",
                rate: "control",
                list: [21, 22, 23],
                freq: 10000
            }
        });

        testNotesControl(midiFreq, [
            {
                expectedFreq: 27.50,
                msg: "The frequency value of the first item in the sequence should be returned (MIDI 21)."
            },
            {
                expectedFreq: 29.14,
                msg: "The frequency value of the next item in the sequence should be returned (MIDI 22)."
            },
            {
                expectedFreq: 30.87,
                msg: "The frequency value of the last item in the sequence should be returned (MIDI 23)."
            }
        ]);
    });

    module("flock.ugen.latch");

    var testLatch = function (latchSynth, trigger, expectedOutput, expectedRate, msg) {
        if (trigger !== undefined) {
            latchSynth.set("latcher.trigger", trigger);
        }

        latchSynth.gen();
        var latch = latchSynth.get("latcher");
        equal(latch.gen, expectedRate === "audio" ? latch.arGen : latch.krGen,
            "The unit generator should be generating samples at " + expectedRate + " rate.");
        deepEqual(latch.output, expectedOutput, msg);
    };

    var runLatchTests = function (testSpec) {
        var latchSynth = flock.synth({
            synthDef: testSpec.synthDef
        });

        fluid.each(testSpec.tests, function (test) {
            testLatch(latchSynth, test.trigger, test.expected, test.rate, test.msg);
        });
    };


    test("Trigger running at control rate", function () {
        var oneBuffer = flock.generate(64, 1);
        var twoBuffer = flock.generate(64, 2);

        var testSpec = {
            synthDef: {
                id: "latcher",
                ugen: "flock.ugen.latch",
                source: {
                    ugen: "flock.ugen.sequence",
                    loop: 1.0,
                    rate: "control",
                    list: [1, 2, 3, 4],
                    freq: sampleRate / 64
                },
                trigger: 0.0
            },

            tests: [
                {
                    expected: oneBuffer, // Source is 1, latch is 1.
                    rate: "control",
                    msg: "When the trigger is closed, latch should output the first value."
                },
                {
                    trigger: 1.0,
                    expected: twoBuffer, // Source is 2, latch is 2.
                    rate: "control",
                    msg: "When the trigger opens at control rate, the latch should output the next value."
                },
                {
                    expected: twoBuffer, // Source is 3, latch is 2.
                    rate: "control",
                    msg: "With the trigger still open, the latch's output should not change until the trigger crosses zero into the positive again."
                },
                {
                    trigger: 0.0, // Source is 4, latch is 2.
                    expected: twoBuffer,
                    rate: "control",
                    msg: "With the trigger closed again, the latch's output still shouldn't have changed."
                },
                {
                    trigger: 0.01, // Source is 1, latch is 1.
                    expected: oneBuffer,
                    rate: "control",
                    msg: "Once the trigger has crossed zero again, the latch's output should sample and hold the source's output again."
                }
            ]
        };

        runLatchTests(testSpec);
    });

    test("Trigger running at audio rate", function () {
        var outputBuffer =  flock.generate(64, function (i) {
            return i + 1;
        });

        var secondTrig = flock.generate(64, 0.0);
        secondTrig[1] = 1.0;

        var secondExpected = flock.generate(64, 2);
        secondExpected[0] = 1;

        var thirdTrig = flock.generate(64, 0.0);
        thirdTrig[2] = 1.0;
        thirdTrig[3] = 0.0;
        thirdTrig[4] = 0.001;

        var thirdExpected = flock.generate(64, 5);
        thirdExpected[0] = 2; // Hold value is at 2
        thirdExpected[1] = 2;
        thirdExpected[2] = 3; // Two samples have gone by, value will be 3.
        thirdExpected[3] = 3; // Hold value is 3.

        var testSpec = {
            synthDef: {
                id: "latcher",
                ugen: "flock.ugen.latch",
                rate: "audio",
                source: {
                    ugen: "flock.ugen.sequence",
                    loop: 1.0,
                    rate: "audio",
                    list: outputBuffer,
                    freq: sampleRate
                },
                trigger: {
                    ugen: "flock.test.ugen.mock",
                    rate: "audio",
                    options: {
                        buffer: flock.generate(64, 0.0)
                    }
                }
            },

            tests: [
                {
                    expected: flock.generate(64, 1), // First value from the source; trigger is closed.
                    rate: "audio",
                    msg: "When the trigger is closed for an entire control period, latch should output only the first value."
                },
                {
                    trigger: {
                        ugen: "flock.test.ugen.mock",
                        rate: "audio",
                        options: {
                            buffer: secondTrig
                        }
                    },
                    expected: secondExpected,
                    rate: "audio",
                    msg: "When the trigger opens for one sample the latch should output only the next value."
                },
                {
                    trigger: {
                        ugen: "flock.test.ugen.mock",
                        rate: "audio",
                        options: {
                            buffer: thirdTrig
                        }
                    },
                    expected: thirdExpected,
                    rate: "audio",
                    msg: "When the trigger opens, then closes, then opens again, the next two samples should be output."
                }
            ]
        };

        runLatchTests(testSpec);
    });

    module("flock.ugen.passThrough");

    var passThroughDef = {
        id: "pass",
        ugen: "flock.ugen.passThrough",
        source: {
            ugen: "flock.ugen.sequence",
            rate: "control",
            list: flock.test.fillBuffer(1, 64)
        }
    };

    test("control rate source, audio rate output", function () {
        var synth = flock.synth({
            synthDef: passThroughDef
        });

        var passThrough = synth.get("pass");
        synth.gen();

        var expected = new Float32Array(64);
        expected[0] = 1;
        deepEqual(passThrough.output, expected,
            "The control rate value of the source should be passed through to the first index of an otherwise silent buffer.");

    });

    test("audio rate source, audio rate output", function () {
        var synth = flock.synth({
            synthDef: $.extend(true, {}, passThroughDef, {
                source: {
                    rate: "audio"
                }
            })
        });

        var passThrough = synth.get("pass");
        synth.gen();
        deepEqual(passThrough.output, passThrough.inputs.source.output,
            "The entire source should be passed through as-is.");
    });


    test("audio rate source, control rate output", function () {
        var synth = flock.synth({
            synthDef: $.extend(true, {}, passThroughDef, {
                rate: "control",
                source: {
                    rate: "audio"
                }
            })
        });

        var passThrough = synth.get("pass");
        synth.gen();
        deepEqual(passThrough.output, new Float32Array([1]),
            "The first value of the source buffer should be passed through as-is.");
    });

    (function () {
        module("flock.ugen.change");

        var changeDef = {
            id: "changer",
            ugen: "flock.ugen.change",
            initial: 1.0,
            target: 2.0,
            time: 1/750
        };

        function makeChangeSynth(synthDef) {
            return flock.synth({
                audioSettings: {
                    rates: {
                        audio: 48000
                    }
                },

                synthDef: synthDef
            });
        }

        test("Change at specified time", function () {
            var synth = makeChangeSynth(changeDef),
                changer = synth.get("changer");

            synth.gen();
            deepEqual(changer.output, flock.generate(64, 1),
                "For the first sample block, the output should be the initial input's output.");
            synth.gen();
            deepEqual(changer.output, flock.generate(64, 2),
                "For the second sample block, the output should be the target input's output.");
        });

        test("Crossfade", function () {
            var crossFadeDef = $.extend(true, {}, changeDef, {
                crossfade: 1/750
            });

            var synth = makeChangeSynth(crossFadeDef),
                changer = synth.get("changer"),
                crossfadeBuffer = flock.generate(64, function (i) {
                    var targetLevel = i / 64,
                        initialLevel = 1 - targetLevel;
                    return (1 * initialLevel) + (2 * targetLevel);
                });

            synth.gen();
            deepEqual(changer.output, flock.generate(64, 1),
                "For the first sample block, the output should be the initial input's output.");
            synth.gen();
            deepEqual(changer.output, crossfadeBuffer,
                "For the second sample block, the output should crossfade from the initial to the target input.");
            synth.gen();
            deepEqual(changer.output, flock.generate(64, 2),
                "For the third sample block, the output should be the target input's output.");
        });

    }());



    module("flock.ugen.t2a");

    test("t2a Tests", function () {
        var silence = new Float32Array(64);
        var synthDef = {
            id: "converter",
            ugen: "flock.ugen.t2a",
            source: {
                ugen: "flock.ugen.impulse",
                rate: "control",
                freq: sampleRate,
                phase: 1.0
            }
        };
        var synth = flock.synth({
            synthDef: synthDef
        });

        var t2a = synth.get("converter");
        ok(t2a.rate === flock.rates.AUDIO,
            "The unit generator should be running at audio rate.");

        synth.gen();
        var expected = new Float32Array(64);
        expected[0] = 1.0;
        deepEqual(t2a.output, expected,
            "The control rate trigger value should output at the first index in audio rate output stream.");

        synth.set("converter.offset", 27);
        synth.gen();
        deepEqual(t2a.output, silence,
            "If the trigger hasn't reset and fired again, the output should be silent.");

        synth.set("converter.source", {
            ugen: "flock.ugen.sequence",
            list: new Float32Array(64),
            freq: sampleRate
        });
        synth.gen();
        deepEqual(t2a.output, silence,
            "If the trigger has reset but hasn't fired again, the output should be silent.");

        synth.set("converter.source", synthDef.source);
        synth.gen();
        expected = new Float32Array(64);
        expected[27] = 1.0;
        deepEqual(t2a.output, expected,
            "The control rate trigger value should have been shifted to index 27 in the audio rate output stream.");
    });

    (function () {
        module("flock.ugen.triggerCallback");
        flock.test.CallbackCounter = function () {
            this.callbackRecords = [];
        };

        flock.test.CallbackCounter.prototype.callback = function () {
            this.callbackRecords.push(arguments);
        };

        flock.test.CallbackCounter.prototype.clear = function () {
            this.callbackRecords = [];
        };

        var makeCallbackCounter = function () {
            var counter = new flock.test.CallbackCounter();
            counter.boundCallback = counter.callback.bind(counter);
            flock.test.CallbackCounter.singleton = counter;
            return counter;
        };

        fluid.defaults("flock.test.triggerCallbackSynth", {
            gradeNames: ["flock.synth", "autoInit"],
            synthDef: {
                ugen: "flock.ugen.triggerCallback",
                source: {
                    ugen: "flock.test.ugen.mock",
                    options: {
                        buffer: flock.generate(64, function (i) {
                            return i;
                        })
                    }
                },
                trigger: {
                    ugen: "flock.test.ugen.mock",
                    options: {
                        buffer: flock.generate(64, function (i) {
                            return i === 31 ? 1.0 : 0.0;
                        })
                    }
                },
                options: {}
            }
        });

        var testTriggerCallback = function (testSpec) {
            var counter = makeCallbackCounter();
            var synthDefSpec = {
                options: {
                    callback: {}
                }
            };

            if (testSpec.type === "func" || testSpec.type === "funcName") {
                synthDefSpec.options.callback[testSpec.type] = counter.boundCallback;
            }

            var synth = flock.test.triggerCallbackSynth({
                synthDef: $.extend(true, synthDefSpec, testSpec.synthDefOverrides)
            });
            synth.gen();

            var expectedNumCalls = testSpec.expectedCallbackArgs.length;
            equal(counter.callbackRecords.length, expectedNumCalls, "The callback should have been invoked " +
                expectedNumCalls + " times.");

            for (var i = 0; i < expectedNumCalls; i++) {
                var expectedCallbackRecord = fluid.makeArray(testSpec.expectedCallbackArgs[i]);
                var actualCallbackRecord = counter.callbackRecords[i];
                equal(actualCallbackRecord.length, expectedCallbackRecord.length,
                    expectedCallbackRecord.length + " arguments should have been passed to the callback.");
                for (var j = 0; j < expectedCallbackRecord.length; j++) {
                    equal(actualCallbackRecord[j], expectedCallbackRecord[j],
                        "The expected argument at position " + j + " should have been passed to the callback.");
                }
            }
        };

        var runTriggerCallbackTests = function (testSpecs) {
            fluid.each(testSpecs, function (testSpec) {
                test(testSpec.name, function () {
                    testTriggerCallback(testSpec);
                });
            });
        };

        var triggerCallbackTestSpecs = [
            {
                name: "Raw function",
                type: "func",
                expectedCallbackArgs: [
                    [31]
                ]
            },
            {
                name: "Raw function, multiple triggers",
                type: "func",
                synthDefOverrides: {
                    trigger: {
                        options: {
                            buffer: flock.generate(64, function (i) {
                                return (i === 31 || i === 62) ? 1.0 : 0.0;
                            })
                        }
                    }
                },

                expectedCallbackArgs: [
                    [31],
                    [62]
                ]
            },
            {
                name: "Raw function with arguments",
                type: "func",
                synthDefOverrides: {
                    options: {
                        callback: {
                            args: ["cat"]
                        }
                    }
                },
                expectedCallbackArgs: [
                    ["cat", 31]
                ]
            },
            {
                name: "Function EL path",
                type: "funcName",
                synthDefOverrides: {
                    options: {
                        callback: {
                            funcName: "flock.test.CallbackCounter.singleton.boundCallback"
                        }
                    }
                },
                expectedCallbackArgs: [
                    [31]
                ]
            },
            {
                name: "this/method pair",
                synthDefOverrides: {
                    options: {
                        callback: {
                            "this": "flock.test.CallbackCounter.singleton",
                            method: "callback"
                        }
                    }
                },
                expectedCallbackArgs: [
                    [31]
                ]
            }
        ];

        runTriggerCallbackTests(triggerCallbackTestSpecs);

    }());


    (function () {
        module("flock.ugen.pan2");

        var makePannerSynth = function (panVal) {
            var ones = flock.generate(64, 1);
            var panSynthDef = {
                id: "panner",
                ugen: "flock.ugen.pan2",
                pan: panVal,
                source: {
                    id: "mock",
                    ugen: "flock.test.ugen.mock",
                    options: {
                        buffer: ones
                    }
                }
            };

            return flock.synth({
                synthDef: panSynthDef
            });
        };

        var testPanner = function (panTestSpec) {
            var synth = makePannerSynth(panTestSpec.pan),
                panner = synth.get("panner"),
                assertionMap = {
                    "equal": deepEqual,
                    "silent": flock.test.arraySilent,
                    "extremelyQuiet": flock.test.arrayExtremelyQuiet
                },
                i,
                channelAssertion,
                fn;

            synth.gen();

            for (i = 0; i < panTestSpec.channelAssertions.length; i++) {
                channelAssertion = panTestSpec.channelAssertions[i];
                fn = assertionMap[channelAssertion.assertion];

                if (channelAssertion.expected) {
                    fn(panner.output[i], channelAssertion.expected, channelAssertion.msg);
                } else {
                    fn(panner.output[i], channelAssertion.msg);
                }
            }
        };

        test("Audio rate pan2 tests", function () {
            var fullPower = flock.generate(64, 1),
                equalPower = flock.generate(64, Math.sqrt(0.5));

            var pannerTestSpecs = [
                {
                    pan: -1,
                    channelAssertions: [
                        {
                            assertion: "equal",
                            expected: fullPower,
                            msg: "When the panner is hard left, the signal should be present at full amplitude " +
                                "in the first output buffer."
                        },
                        {
                            assertion: "silent",
                            msg: "When the panner is hard left, the second output buffer should be silent."
                        }
                    ]
                },
                {
                    pan: 1,
                    channelAssertions: [
                        {
                            assertion: "extremelyQuiet",
                            msg: "When the panner is hard right, the first output buffer should be silent."
                        },
                        {
                            assertion: "equal",
                            expected: fullPower,
                            msg: "When the panner is hard right, the signal should be present at full amplitude " +
                                "in the second output buffer."
                        }
                    ]

                },
                {
                    pan: 0,
                    channelAssertions: [
                        {
                            assertion: "equal",
                            expected: equalPower,
                            msg: "When the panner is centred, the signal should be present at 0.707 " +
                                "in the first output buffer."
                        },
                        {
                            assertion: "equal",
                            expected: equalPower,
                            msg: "When the panner is centred, the signal should be present at 0.707 " +
                                "in the second output buffer."
                        }
                    ]
                }
            ];

            for (var i = 0; i < pannerTestSpecs.length; i++) {
                testPanner(pannerTestSpecs[i]);
            }
        });
    }());
}());
