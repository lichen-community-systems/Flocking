/*!
* Flocking Unit Generator Unit Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2015, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, Float32Array*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit"),
        $ = fluid.registerNamespace("jQuery");

    fluid.registerNamespace("flock.test");

    var environment;
    QUnit.testStart(function () {
        environment = flock.silentEnviro({
            components: {
                audioSystem: {
                    options: {
                        model: {
                            audioSettings: {
                                numBuses: 16
                            }
                        }
                    }
                }
            }
        });
    });

    QUnit.testDone(function () {
        environment.destroy();
    });

    QUnit.module("UGen interpolation configuration tests");

    fluid.registerNamespace("flock.test.ugen.interpolation");

    flock.test.ugen.interpolation.runTests = function (testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            QUnit.test(testSpec.interpolator, function () {
                var ugen = flock.test.ugen.mock.make(new Float32Array(64), undefined, {
                    interpolation: testSpec.interpolator
                });

                QUnit.equal(ugen.interpolate, testSpec.expected,
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


    QUnit.module("ugen get/set tests");

    var setAndCheckInput = function (ugen, inputName, val) {
        var returnVal = ugen.input(inputName, val);
        QUnit.ok(returnVal, "Setting a new input should return the input unit generator.");
        QUnit.ok(ugen.inputs[inputName], "Setting a new input should create a new unit generator with the appropriate name.");
        QUnit.equal(returnVal, ugen.inputs[inputName], "The return value when setting an input should be the input unit generator.");

        var valType = typeof (val);
        if (valType !== "number" && valType !== "string") {
            QUnit.equal(ugen.input(inputName), ugen.inputs[inputName], "The value returned from input() should be the same as the actual input value.");
        }
    };

    var setAndCheckArrayInput = function (ugen, inputName, vals, comparisonFn) {
        setAndCheckInput(ugen, inputName, vals);
        QUnit.ok(flock.isIterable(ugen.input(inputName)), "The input should be set to an array of unit generators.");
        QUnit.equal(ugen.input(inputName).length, vals.length, "There should be " + vals.length + " unit generators in the array.");
        fluid.each(vals, comparisonFn);
    };

    QUnit.test("Get special path segments", function () {
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

        QUnit.expect(2);
        QUnit.equal(actual, ugen.inputs.freq.inputs.start.options,
            "The options object should be correctly returned");
        QUnit.equal(ugen.get("freq.start.freq.model.value"),
            ugen.inputs.freq.inputs.start.inputs.freq.model.value,
            "The options object should be correctly returned");

    });

    QUnit.test("input() data type tests", function () {
        var mockUGen = flock.test.ugen.mock.make(new Float32Array(64));

        // Non-existent input.
        var val = mockUGen.input("cat");
        QUnit.equal(val, undefined, "Getting a non-existent input should return undefined.");
        QUnit.ok(!mockUGen.inputs.cat, "When getting a non-existent input, it should not be created.");

        // Setting a previously non-existent input.
        setAndCheckInput(mockUGen, "cat", {
            ugen: "flock.test.ugen.mock"
        });

        // Replacing an existing input with an ugenDef.
        setAndCheckInput(mockUGen, "cat", {
            id: "new-cat",
            ugen: "flock.test.ugen.mock"
        });
        QUnit.equal(mockUGen.input("cat").id, "new-cat", "The new input should have the appropriate ID.");

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
        setAndCheckArrayInput(mockUGen, "cat", defs, function (def, i) {
            QUnit.equal(mockUGen.input("cat")[i].id, def.id);
        });

        // And with a scalar.
        setAndCheckInput(mockUGen, "cat", 500);
        QUnit.equal(mockUGen.inputs.cat.model.value, 500, "The input ugen should be a value ugen with the correct model value.");

        // And an array of scalars.
        var vals = [100, 200, 300];
        setAndCheckArrayInput(mockUGen, "fish", vals, function (val, i) {
            QUnit.equal(mockUGen.input("fish")[i].model.value, val);
        });
    });


    QUnit.module("mul & add tests");

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
        QUnit.deepEqual(output, expected, msg);
    };

    QUnit.test("flock.krMul()", function () {
        var expected = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20];
        signalTest(flock.krMul, [krInput, undefined], expected,
            "krMul() should use only the first value of the signal as a multiplier.");
    });

    QUnit.test("flock.mul()", function () {
        var expected = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110];
        signalTest(flock.mul, [audioInput, undefined], expected,
            "mul() should use each value in the signal as a multiplier.");
    });

    QUnit.test("flock.krAdd()", function () {
        var expected = [12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
        signalTest(flock.krAdd, [undefined, krInput], expected,
            "krAdd() should use only the first value of the signal for addition.");
    });

    QUnit.test("flock.add()", function () {
        var expected = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
        signalTest(flock.add, [undefined, audioInput], expected,
            "add() should use each value in the signal for addition.");
    });

    QUnit.test("flock.krMulKrAdd()", function () {
        var expected = [22, 22, 22, 22, 22, 22, 22, 22, 22, 22];
        signalTest(flock.krMulKrAdd, [krInput, krInput], expected,
            "krMulKrAdd() should use the first value of both the mul and add signals.");
    });

    QUnit.test("flock.krMulAdd()", function () {
        var expected = [22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
        signalTest(flock.krMulAdd, [krInput, audioInput], expected,
            "krMulAdd() should use the first value of the mul signal and all values of the add signal.");
    });

    QUnit.test("flock.mulKrAdd()", function () {
        var expected = [22, 32, 42, 52, 62, 72, 82, 92, 102, 112];
        signalTest(flock.mulKrAdd, [audioInput, krInput], expected,
            "mulKrAdd() should use all values of the mul signal and the first value of the add signal.");
    });

    QUnit.test("flock.mulAdd()", function () {
        var expected = [22, 33, 44, 55, 66, 77, 88, 99, 110, 121];
        signalTest(flock.mulAdd, [audioInput, audioInput], expected,
            "mulKrAdd() should useall values of both the mul and add signals.");
    });

    var mulAddUGenTest = function (mulInput, addInput, expected, msg) {
        var ugen = flock.test.mulAdderUGen({mul: mulInput, add: addInput}, generateTestOutput());
        ugen.mulAdd(10);
        QUnit.deepEqual(ugen.output, expected, msg);
    };

    QUnit.test("flock.ugen.mulAdd()", function () {
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


    // TODO: Create these graphs declaratively!
    QUnit.module("Output tests");

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

        defs = fluid.makeArray(defs);
        fluid.each(defs, function (def) {
            var synth = flock.synth({
                synthDef: def
            });
            synths.push(synth);
        });

        for (i = 0; i < numRuns; i++) {
            environment.gen();
            QUnit.deepEqual(environment.busManager.buses[bus], expectedOutput, i + ": " + msg);
        }

        fluid.each(synths, function (synth) {
            synth.removeFromEnvironment();
        });

        return synths;
    };

    QUnit.test("flock.ugen.out()", function () {
        testOutputs(2, simpleOutDef, 0, flock.generateBufferWithValue(64, 1),
            "The output should be written to the appropriate environment bus.");
    });

    QUnit.test("flock.ugen.out(): multiple out ugens writing to the same bus", function () {
        var outDefs = [simpleOutDef, simpleOutDef];
        testOutputs(2, outDefs, 0, flock.generateBufferWithValue(64, 2),
            "Multiple outputs to the same buffer should be summed.");
    });


    QUnit.module("flock.ugen.in");

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

    QUnit.test("flock.ugen.in() single bus input", function () {
        // TODO: We're using 64 buses here so we don't run into
        // legitimate output buses when running tests while plugged into a multichannel
        // audio interface. This illustrates why we should have some kind of separation between
        // interconnect buses and output buses.
        flock.init({
            numBuses: 64
        });

        var outSynth = flock.synth({
            synthDef: outSynthDef
        });
        var inSynth = flock.synth({
            synthDef: inSynthDef
        });

        inSynth.enviro.gen();
        var actual = inSynth.nodeList.namedNodes["in"].output;
        QUnit.deepEqual(actual, inSynth.enviro.busManager.buses[62],
            "With a single source input, the output of flock.ugen.in should make a copy of the bus referenced.");
        QUnit.deepEqual(actual, outSynth.get("bufferMock").options.buffer,
            "And it should reflect exactly the output of the flock.ugen.out that is writing to the buffer.");
    });

    QUnit.test("flock.ugen.in() multiple bus input", function () {
        flock.init({
            numBuses: 64
        });

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
        var actual = inSynth.nodeList.namedNodes["in"].output;
        var expected = flock.generateBuffer(64, function (i) {
            return (i + 1) * 2;
        });
        QUnit.deepEqual(actual, expected,
            "flock.ugen.in should sum the output of each bus when mutiple buses are specified.");
    });


    QUnit.module("flock.ugen.passThrough");

    var passThroughDef = {
        id: "pass",
        ugen: "flock.ugen.passThrough",
        source: {
            ugen: "flock.ugen.sequence",
            rate: "control",
            values: flock.test.generateSequence(1, 64)
        }
    };

    QUnit.test("control rate source, audio rate output", function () {
        var synth = flock.synth({
            synthDef: passThroughDef
        });

        var passThrough = synth.get("pass");
        flock.evaluate.synth(synth);

        var expected = new Float32Array(64);
        expected[0] = 1;
        QUnit.deepEqual(passThrough.output, expected,
            "The control rate value of the source should be passed through to the first index of an otherwise silent buffer.");

    });

    QUnit.test("audio rate source, audio rate output", function () {
        var synth = flock.synth({
            synthDef: $.extend(true, {}, passThroughDef, {
                source: {
                    rate: "audio"
                }
            })
        });

        var passThrough = synth.get("pass");
        flock.evaluate.synth(synth);
        QUnit.deepEqual(passThrough.output, passThrough.inputs.source.output,
            "The entire source should be passed through as-is.");
    });


    QUnit.test("audio rate source, control rate output", function () {
        var synth = flock.synth({
            synthDef: $.extend(true, {}, passThroughDef, {
                rate: "control",
                source: {
                    rate: "audio"
                }
            })
        });

        var passThrough = synth.get("pass");
        flock.evaluate.synth(synth);
        QUnit.deepEqual(passThrough.output, new Float32Array([1]),
            "The first value of the source buffer should be passed through as-is.");
    });
}());
