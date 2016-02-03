/*
 * Flocking Synth Tests
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2015, Colin Clark
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

/*global require, module, test, asyncTest, expect, ok, equal, deepEqual, start*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    var environment = flock.silentEnviro();

    var simpleSynthDef = {
        ugen: "flock.ugen.out",
        inputs: {
            sources: {
                id: "sine",
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: 440,
                    mul: {
                        id: "mod",
                        ugen: "flock.ugen.sinOsc",
                        inputs: {
                            freq: 1.0
                        }
                    }
                }
            },
            bus: 0
        }
    };

    var createSynth = function (synthDef) {
        return flock.synth({
            synthDef: synthDef,
            sampleRate: 1,
            chans: 1
        });
    };

    fluid.registerNamespace("flock.test.synth");

    module("Synth tests", {
        teardown: function () {
            environment.reset();
        }
    });

    fluid.defaults("flock.test.genReportSynth", {
        gradeNames: ["flock.synth"],

        model: {
            didGen: false
        },

        members: {
            genFn: "{that}.gen"
        },

        synthDef: {
            ugen: "flock.ugen.silence"
        },

        invokers: {
            gen: {
                funcName: "flock.test.genReportSynth.gen",
                args: "{that}.applier"
            },

            reset: {
                func: "{that}.applier.change",
                args: ["didGen", false]
            }
        }
    });

    flock.test.genReportSynth.gen = function (applier) {
        applier.change("didGen", true);
    };

    var testEnviroGraph = function (fn) {
        setTimeout(function () {
            fn();
            start();
        }, 2000);
    };

    test("Synth.isPlaying()", function () {
        var s = flock.synth({
            synthDef: {
                ugen: "flock.ugen.sin"
            },

            addToEnvironment: false
        });

        ok(!s.isPlaying(), "The synth should not be playing initially.");

        s.play();
        ok(s.isPlaying(),
            "The synth should should be playing after invoking the play() method.");
        ok(s.enviro.nodeList.nodes.indexOf(s) > -1,
            "The synth should actually be a member of the environment's node list.");

        s.pause();
        ok(!s.isPlaying(),
            "The synth should not be playing after pause() has been invoked.");
        ok(s.enviro.nodeList.nodes.indexOf(s) < 0,
            "The synth should no longer be a member of the environment's node list.");
    });

    asyncTest("Auto add to the environment", function () {
        var synth = flock.test.genReportSynth();
        environment.play();

        testEnviroGraph(function () {
            ok(synth.isPlaying(),
                "The synth should have been automatically added to the environment.");
            ok(synth.model.didGen,
                "The synth should have been evaluated.");
        });
    });

    asyncTest("Don't auto add to the environment", function () {
        var synth = flock.test.genReportSynth({
            addToEnvironment: false
        });
        environment.play();

        testEnviroGraph(function () {
            ok(!synth.isPlaying(),
                "The synth should not have been automatically added to the environment.");
            ok(!synth.model.didGen,
                "The synth should not have been evaluated.");
        });
    });

    asyncTest("Remove from the environment", function () {
        var synth = flock.test.genReportSynth();
        environment.play();

        var audioSettings = environment.audioSystem.model,
            waitDur = (audioSettings.bufferSize / audioSettings.rates.audio) * 1000 * 2;

        setTimeout(function () {
            ok(synth.isPlaying(),
                "The synth should have been automatically added to the environment.");
            ok(synth.model.didGen,
                "The synth should have been evaluated.");

            synth.pause();

            ok(environment.nodeList.nodes.indexOf(synth) === -1,
                "The synth should have been removed from the environment.");

            synth.reset();
            setTimeout(function () {
                ok(!synth.model.didGen,
                    "The synth should not have been evaluated after being removed from the environment.");
                start();
            }, waitDur);
        }, waitDur);
    });

    asyncTest("destroy() removes a synth from the environment", function () {
        var synth = flock.test.genReportSynth();
        var audioSettings = environment.audioSystem.model,
            waitDur = (audioSettings.bufferSize / audioSettings.rates.audio) * 1000 * 2;

        environment.play();

        setTimeout(function () {
            ok(synth.isPlaying(),
                "The synth should have been automatically added to the environment.");
            ok(synth.model.didGen,
                "The synth should have been evaluated.");

            synth.reset();
            synth.destroy();
            ok(environment.nodeList.nodes.indexOf(synth) === -1,
                "The synth should have been removed from the environment.");

            setTimeout(function () {
                ok(!synth.model.didGen,
                    "The synth should not have been evaluated after being destroyed.");
                start();
            }, waitDur);
        }, waitDur);
    });

    test("Get input values", function () {
        var synth = createSynth(simpleSynthDef);

        expect(5);

        // Getting simple values.
        equal(synth.get("sine.freq"), 440,
            "Getting 'sine.freq' should return the value set in the synthDef.");
        equal(synth.get("sine.freq"), 440,
            "Getting 'sine.freq' a second time should return the same value.");
        equal(synth.get("mod.freq"), 1.0,
            "Getting 'carrier.freq' should also return the initial value.");

        // Get a ugen.
        var ugen = synth.input("mod");
        ok(ugen.gen, "A ugen returned from synth.input() should have a gen() property...");
        equal(typeof (ugen.gen), "function", "...of type function");
    });

    test("Get input values with special segments (e.g. 'options' and 'model')", function () {
        var synth = createSynth(simpleSynthDef);

        expect(4);
        equal(synth.get("sine.freq.model.value"), 440,
            "Getting the sine oscillator's frequency input's model value should return the current frequency.");
        equal(synth.get("sine.freq.model"), synth.get("sine").inputs.freq.model,
            "Getting the sine oscillator's frequency input's model should return the whole model object.");
        equal(synth.get("sine.options"), synth.get("sine").options,
            "Getting the sine oscillator's options should return the whole options object.");
        equal(synth.get("sine.options.sampleRate"), synth.get("sine").options.sampleRate,
            "Getting the sine oscillator's options should return the whole options object.");
    });

    test("Set input values", function () {
        var synth = createSynth(simpleSynthDef),
            sineUGen = synth.nodeList.namedNodes.sine,
            modUGen = synth.nodeList.namedNodes.mod;

        // Setting simple values.
        synth.input("sine.freq", 220);
        equal(synth.input("sine.freq"), 220,
            "Setting 'sine.freq' should update the input value accordingly.");
        equal(sineUGen.inputs.freq.model.value, 220,
            "And the underlying value ugen should also be updated.");
        synth.input("sine.freq", 110);
        equal(synth.input("sine.freq"), 110,
            "Setting 'sine.freq' a second time should also work.");
        equal(sineUGen.inputs.freq.model.value, 110,
            "And the underlying value ugen should also be updated.");
        synth.input("mod.freq", 2.0);
        equal(synth.input("mod.freq"), 2.0,
        "Setting 'mod.freq' should update the input value.");
        equal(modUGen.inputs.freq.model.value, 2.0,
            "And the underlying value ugen should also be updated.");
        equal(modUGen.inputs.freq.output[0], 2.0,
            "Even the ugen's output buffer should contain the new value.");

        // Set a null value.
        synth.set("mod.freq", null);
        equal(synth.get("mod.freq"), 2.0, "Setting an input to null should leave it untouched.");

        // Set a undefined value.
        synth.set("mod.freq", undefined);
        equal(synth.input("mod.freq"), 2.0, "Setting an input to undefined should leave it untouched.");

        // Set a ugen def.
        var testUGenDef = {
            ugen: "flock.ugen.dust",
            inputs: {
                density: 200
            }
        };
        var dust = synth.input("sine.mul", testUGenDef);
        equal(synth.nodeList.namedNodes.sine.inputs.mul, dust,
            "The 'mul' ugen should be set to our test Dust ugen.");
        equal(synth.nodeList.namedNodes.sine.inputs.mul.inputs.density.model.value, 200,
            "The ugen should be set up correctly.");

        // Set a named ugen directly.
        synth = createSynth(simpleSynthDef);
        synth.input("sine", {
            ugen: "flock.ugen.lfNoise",
            freq: 123
        });
        equal(synth.nodeList.namedNodes.sine.inputs.freq.model.value, 123,
            "Directly setting a named unit generator should cause the previous ugen to be replaced.");
        ok(sineUGen !== synth.nodeList.namedNodes.sine);
    });

    test("Set input values, onInputChanged event", function () {
        flock.tests = {};
        flock.tests.ugens = {};

        var didOnInputChangedFire = false;
        // TODO: Normalize this with the OTHER mock ugen.
        flock.tests.ugens.mockUGen = function (inputs, output, options) {
            var that = flock.ugen(inputs, output, options);
            that.gen = function () {};
            that.onInputChanged = function () {
                didOnInputChangedFire = true;
            };
            return that;
        };

        var synth = createSynth({
            id: "mock",
            ugen: "flock.tests.ugens.mockUGen",
            inputs: {
                cat: 12
            }
        });

        synth.input("mock.cat");
        ok(!didOnInputChangedFire, "The onInputChanged event should not fire when an input is read.");
        didOnInputChangedFire = false;
        synth.input("mock.cat", 42);
        ok(didOnInputChangedFire, "The onInputChanged event should fire when an input is changed.");
    });

    test("Get and set values at array indices", function () {
        var def = {
            ugen: "flock.ugen.sinOsc",
            id: "carrier",
            freq: {
                ugen: "flock.ugen.sum",
                id: "adder",
                sources: [
                    {
                        ugen: "flock.ugen.sin",
                        freq: 440
                    },
                    {
                        ugen: "flock.ugen.sin",
                        freq: 880
                    }
                ]
            }
        };

        var synth = flock.synth({
            synthDef: def
        });
        var actual = synth.input("carrier.freq.sources.1"),
            expected = synth.nodeList.namedNodes.adder.inputs.sources[1];
        equal(actual, expected, "Getting a ugen input within an array should return the correct ugen.");

        actual = synth.input("adder.sources.1.freq");
        expected = 880;
        equal(actual, expected,
            "Getting a value from a ugen within an array should return the correct value.");

        synth.input("adder.sources.1.freq", 889);
        expected = 889;
        actual = synth.nodeList.namedNodes.adder.inputs.sources[1].inputs.freq.model.value;
        equal(actual, expected,
            "Setting a value on a ugen within an array should succeed.");

        synth.input("adder.sources.0", {
            ugen: "flock.ugen.lfNoise",
            freq: 456
        });
        equal(synth.nodeList.namedNodes.adder.inputs.sources[0].inputs.freq.model.value, 456,
            "Setting a ugen within an array should succeed.");
    });

    var testSetUGenArray = function (synth, path, value, expectedNumNodes, oldUGens, msgPrefix) {
        var result = synth.set(path, value);

        equal(value.length, synth.get("out.sources").length,
            msgPrefix + ": " +
            "The input should have the correct number of unit generators attached to it.");
        equal(synth.nodeList.nodes.length, expectedNumNodes,
            msgPrefix + ": " +
            "The unit generator list should have been updated with the new unit generator count " +
            "(i.e. old inputs removed, new ones added).");

        var activeOldCount = 0;
        for (var i = 0; i < oldUGens.length; i++) {
            activeOldCount += synth.nodeList.nodes.indexOf(oldUGens[i]);
        }
        ok(activeOldCount < 0,
            msgPrefix + ": " +
            "None of the old unit generators should be in the synth's list of active nodes.");

        return result;
    };

    var runSetArrayValueTest = function (synth, path, testSpecs) {
        var oldUGens = synth.get(path);
        fluid.each(testSpecs, function (testSpec) {
            oldUGens = testSetUGenArray(
                synth,
                path,
                testSpec.value,
                testSpec.expectedNumNodes,
                oldUGens,
                testSpec.msgPrefix
            );
        });
    };

    test("Get and set array-valued inputs", function () {
        var def = {
            ugen: "flock.ugen.out",
            id: "out",
            bus: 0,
            expand: 3,
            sources: [
                {
                    ugen: "flock.ugen.sin",
                    freq: 110,
                    phase: 1.0
                },
                {
                    ugen: "flock.ugen.lfNoise",
                    freq: 220
                },
                {
                    ugen: "flock.ugen.lfSaw",
                    freq: 330,
                    phase: 0.1
                }
            ]
        };

        var synth = flock.synth({
            synthDef: def
        });

        equal(synth.nodeList.nodes.length, 11,
            "Sanity check: all 11 unit generators should have been added to the synth.");

        var result = synth.get("out.sources");
        equal(result, synth.nodeList.namedNodes.out.inputs.sources,
            "Getting an array-valued input should return all values.");

        runSetArrayValueTest(synth, "out.sources", [
            {
                value: [
                    {
                        ugen: "flock.ugen.lfPulse",
                        freq: 440,
                        phase: 0.2,
                        width: 0.1
                    }
                ],
                expectedNumNodes: 7,
                msgPrefix: "Set fewer unit generators than before"
            },
            {
                value:[
                    {
                        ugen: "flock.ugen.lfNoise",
                        freq: 550
                    }
                ],
                expectedNumNodes: 5,
                msgPrefix: "Set an equal number of unit generators"

            },
            {
                value: [
                    {
                        ugen: "flock.ugen.lfNoise",
                        freq: 660
                    },
                    {
                        ugen: "flock.ugen.lfNoise",
                        freq: 770
                    },
                    {
                        ugen: "flock.ugen.lfNoise",
                        freq: 880
                    },
                    {
                        ugen: "flock.ugen.lfNoise",
                        freq: 990
                    }
                ],
                expectedNumNodes: 11,
                msgPrefix: "Set more unit generators than previously"
            }
        ]);
    });

    test("Get multiple input values", function () {
        var synth = createSynth(simpleSynthDef),
            expected,
            actual;

        expected = {
            "sine.freq": 440,
            "sine.mul.freq": 1.0,
            "sine.add": undefined
        };

        // "Fill it in" style of get()
        actual = synth.get({
            "sine.freq": null,
            "sine.mul.freq": null,
            "sine.add": null
        });
        deepEqual(actual, expected,
            "Synth.get() should fill in the object passed in as its argument.");

        // Array style of input()
        actual = synth.input([
            "sine.freq",
            "sine.mul.freq",
            "sine.add"
        ]);
        deepEqual(actual, expected,
            "Synth.input() should return multiple values when given an array of paths.");
    });

    var testSetMultiple = function (methodName) {
        var synth = createSynth(simpleSynthDef),
            expected,
            actual,
            direct;

        actual = synth[methodName]({
            "sine.freq": 880,
            "sine.mul.freq": 1.2,
            "sine.add": {
                id: "add",
                ugen: "flock.ugen.sinOsc",
                freq: 7.0
            }
        });

        direct = synth.nodeList.namedNodes.sine;

        expected = {
            "sine.freq": direct.inputs.freq,
            "sine.mul.freq": direct.inputs.mul.inputs.freq,
            "sine.add": direct.inputs.add
        };

        // Check that the data structure returned conforms to the contract.
        deepEqual(actual, expected,
            "The return value should contain the actual unit generator instances that were set.");

        // And then that the actual ugen graph was modified.
        equal(direct.inputs.freq.model.value, 880);
        flock.test.equalRounded(7, direct.inputs.mul.inputs.freq.model.value, 1.2);
        equal(direct.inputs.add.inputs.freq.model.value, 7.0);
        equal(direct.inputs.add.id, "add");
    };

    test("Set multiple input values", function () {
        testSetMultiple("set");
        testSetMultiple("input");
    });

    var valueExpressionTestSpecs = [
        {
            name: "Value expression resolving into the model",
            change: {
                "sine.freq": "${mod.freq.model.value}"
            },
            targetUGenName: "mod",
            expectedPath: "inputs.freq.model.value"
        },
        {
            name: "Value expression resolving to a unit generator instance",
            change: {
                "sine.freq": "${mod}"
            },
            targetUGenName: "mod"
        }
    ];

    var testValueExpressions = function (testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            test(testSpec.name, function () {
                var synth = createSynth(simpleSynthDef);
                synth.set(testSpec.change);

                var actual = synth.get(Object.keys(testSpec.change)[0]),
                    expected = synth.get(testSpec.targetUGenName);

                if (testSpec.expectedPath) {
                    expected = fluid.get(expected, testSpec.expectedPath);
                }

                equal(actual, expected,
                    "The value expression should have been resolved and set at the specified path.");
            });
        });
    };

    testValueExpressions(valueExpressionTestSpecs);

    test("Synth.set(): correct node evaluation order", function () {
        var synth = flock.synth({
            synthDef: {
                id: "pass",
                ugen: "flock.ugen.passThrough",
                rate: "audio",
                source: {
                    ugen: "flock.ugen.sequence",
                    rate: "audio",
                    freq: environment.audioSystem.model.rates.audio,
                    values: flock.test.generateSequence(1, 64)
                }
            }
        });

        var passThrough = synth.get("pass");
        synth.genFn(synth.nodeList.nodes, synth.model);
        deepEqual(passThrough.output, flock.test.generateSequence(1, 64),
            "When first instantiating the synth, a unit generator's inputs should be evaluated first.");

        synth.set("pass.source", {
            ugen: "flock.ugen.sequence",
            rate: "audio",
            freq: environment.audioSystem.model.rates.audio,
            list: flock.test.generateSequence(64, 127)
        });
        synth.genFn(synth.nodeList.nodes, synth.model);
        deepEqual(passThrough.output, flock.test.generateSequence(64, 127),
            "After swapping one active unit generator for another, the correct order should be preserved.");

        synth.set("pass.source", 1.0);
        synth.genFn(synth.nodeList.nodes, synth.model);
        var expected = new Float32Array(64);
        expected[0] = 1.0; // With a control rate source input, passThrough will only output the first value.
        deepEqual(passThrough.output, expected,
            "Replacing an active ugen with an inactive one.");

        synth.set("pass.source", {
            ugen: "flock.ugen.sequence",
            rate: "audio",
            freq: environment.audioSystem.model.rates.audio,
            values: flock.test.generateSequence(128, 191)
        });
        synth.genFn(synth.nodeList.nodes, synth.model);
        deepEqual(passThrough.output, flock.test.generateSequence(128, 191),
            "Replacing an inactive ugen for an active one.");
    });

    var setAndTestUGenCount = function (synth, change, expected, msg) {
        if (change) {
            synth.set(change);
        }
        equal(synth.nodeList.nodes.length, expected, msg);
    };

    var runUGenCountTests = function (testSpec) {
        var synth = flock.synth({
                synthDef: testSpec.synthDef
            }),
            i,
            test;

        for (i = 0; i < testSpec.tests.length; i++) {
            test = testSpec.tests[i];
            setAndTestUGenCount(synth, test.change, test.expected, test.msg);
        }
    };

    test("Synth.set(): replace inputs", function () {
        var testSpec = {
            synthDef: {
                ugen: "flock.ugen.out",         // 5
                bus: 0,                         // 3
                expand: 2,                      // 4
                sources: {
                    id: "carrier",
                    ugen: "flock.ugen.sin",     // 2
                    freq: 440,                  // 0
                    phase: 0.0                  // 1
                }
            },

            tests: [
                {
                    expected: 6,
                    msg: "After instantiation, there should be three uugens--the output, the sin, and the freq value ugen."
                },

                {
                    change: {
                        "carrier.freq": 27
                    },
                    expected: 6,
                    msg: "After replacing a value ugen with another, there should be the same number of ugens."
                },

                {
                    change: {
                        "carrier.freq": {
                            id: "modulator",
                            ugen: "flock.ugen.lfSaw",
                            freq: 22,
                            phase: 0.1
                        }
                    },
                    expected: 8,
                    msg: "After replacing a value ugen with a two-input oscillator, there should be two more ugens--the saw's freq and phase value ugens."
                }
            ]
        };

        runUGenCountTests(testSpec);
    });

    var testAddToEnvironment = function (synthOptions, expectedOrder, message) {
        flock.nodeList.clearAll(environment.nodeList);

        var synths = [];
        fluid.each(synthOptions, function (synthOption) {
            synths.push(flock.synth(synthOption));
        });

        var actualOrder = fluid.transform(synths, function (synth) {
            return environment.nodeList.nodes.indexOf(synth);
        });

        deepEqual(actualOrder, expectedOrder, message);
    };

    var runAddToEnvironmentTest = function (testSpec) {
        var def = {
            ugen: "flock.ugen.sinOsc"
        };

        var synthOptions = [];

        var addToEnvironmentOptions = fluid.makeArray(testSpec.addToEnvironment);
        fluid.each(addToEnvironmentOptions, function (addToEnvironment) {
            synthOptions.push({
                synthDef: def,
                addToEnvironment: addToEnvironment
            });
        });

        testAddToEnvironment(synthOptions, testSpec.expectedOrder, testSpec.msg);
    };

    var runAddToEnvironmentTests = function (testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            runAddToEnvironmentTest(testSpec);
        });
    };

    test("addToEnvironment", function () {

        var testSpecs = [
            {
                addToEnvironment: [false],
                expectedOrder: [-1],
                msg: "The synth should not have been added to the environment " +
                    "when its addToEnvironment option was false."
            },
            {
                addToEnvironment: [undefined],
                expectedOrder: [0],
                msg: "The synth should have been added to the environment " +
                    "when its addToEnvironment option was undefined, because flock.synth's default " +
                    "behaviour is to add itself to the environment at the tail."
            },
            {
                addToEnvironment: [null],
                expectedOrder: [-1],
                msg: "The synth should not have been added to the environment " +
                    "when its addToEnvironment option was null."
            },
            {
                addToEnvironment: [true],
                expectedOrder: [0],
                msg: "The synth should have been added to the environment " +
                    "when its addToEnvironment option was set to true."
            },
            {
                addToEnvironment: ["tail", "tail", "head"],
                expectedOrder: [1, 2, 0],
                msg: "The synth should have been added to the head of the environment when its " +
                    "addToEnvironment option is set to 'head'."
            },
            {
                addToEnvironment: ["head", "head", "head", 2],
                expectedOrder: [3, 1, 0, 2],
                msg: "The synth should have been added to the environment at the correct index " +
                    "when its addToEnvironment option was set to an integer."
            },
            {
                addToEnvironment: [true, "head", 2, "tail"],
                expectedOrder: [1, 0, 2, 3],
                msg: "The node order should be correct when specifying a variety of types of " +
                    "addToEnvironment options."
            },
            {
                addToEnvironment: ["tail", "cat"],
                expectedOrder: [0, 1],
                msg: "The synth should be added to tail of the environment " +
                    "when its addToEnvironment option was invalid."
            }
        ];

        runAddToEnvironmentTests(testSpecs);
    });

    var sequenceSynthDef = {
        id: "seq",
        ugen: "flock.ugen.sequence",
        freq: 750,
        list: [1, 2, 3, 5]
    };

    test("Getting and setting ugen-specified special inputs.", function () {
        var s = flock.synth({
            synthDef: sequenceSynthDef
        });

        var seqUGen = s.get("seq");
        deepEqual(seqUGen.inputs.list, s.options.synthDef.list,
            "Sanity check: the sequence ugen should be initialized with the same list as specified in the synthDef.");

        var newList = [9, 10, 11, 12];
        s.set("seq.list", newList);
        deepEqual(seqUGen.inputs.list, newList,
            "After setting a 'special input' on a unit generator, it should have been set correctly.");
    });

    var checkModelState = function (synth, genMethodName, numGens) {
        for (var i = 1; i <= numGens; i++) {
            flock.evaluate.synth(synth);
            equal(synth.model.value, i,
                "The model value should have been correctly updated.");
        }
    };

    var testSynthModelState = function (testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            test(testSpec.name, function () {
                var s = fluid.getGlobalValue(testSpec.type)({
                    synthDef: sequenceSynthDef,
                    sampleRate: 48000
                });

                checkModelState(s, testSpec.genMethodName, testSpec.numGens || 3);
            });
        });
    };

    var modelStateTestSpecs = [
        {
            name: "flock.synth model state",
            type: "flock.synth",
            genMethodName: "gen",
            numGens: 3
        },
        {
            name: "flock.synth.value",
            type: "flock.synth.value",
            genMethodName: "value",
            numGens: 3
        }
    ];

    testSynthModelState(modelStateTestSpecs);


    test("Frame rate synth gets set up with the correct scheduled rate", function () {
        var s = flock.synth.frameRate({
            fps: 60,

            synthDef: {
                id: "oscillator",
                ugen: "flock.ugen.sin",
                freq: 1
            }
        });

        equal(s.audioSettings.rates.scheduled, 60,
            "The frame rate should have been specified as the synth's scheduled rate.");
        equal(s.get("oscillator").model.sampleRate, 60,
            "The unit generator should have its sample rate set to 60 fps.");
    });


    flock.test.synth.testNoteEvents = function (testSpec) {
        var baseOpts = {
            synthDef: {
                id: "carrier",
                ugen: "flock.ugen.sinOsc",
                freq: 440,
                mul: {
                    id: "env",
                    ugen: "flock.ugen.asr",
                    gate: 0.0
                }
            }
        };

        var opts = testSpec.synthOptions ?
            $.extend({}, baseOpts, testSpec.synthOptions) : baseOpts;

        var s = flock.synth(opts);

        flock.test.synth.testNoteEvents.assertSynthState("Initially",
            testSpec.initialState.expected, s);

        s.noteOn(testSpec.noteOn.change);

        flock.test.synth.testNoteEvents.assertSynthState(
            "After receiving a note on event",
            testSpec.noteOn.expected, s);

        s.noteOff(testSpec.noteOff.change);

        flock.test.synth.testNoteEvents.assertSynthState(
            "After receiving a note off event",
            testSpec.noteOff.expected, s);
    };

    flock.test.synth.testNoteEvents.assertSynthState = function (msgPrefix, expected, s) {
        fluid.each(expected, function (value, path) {
            equal(s.get(path), value,
                msgPrefix + ", " + path + " should be " + value + ".");
        });
    };

    var noteTestSpecs = [
        {
            initialState: {
                expected: {
                    "env.gate": 0.0
                }
            },

            noteOn: {
                expected: {
                    "env.gate": 1.0
                }
            },

            noteOff: {
                expected: {
                    "env.gate": 0.0
                }
            }
        },
        {
            initialState: {
                expected: {
                    "carrier.freq": 440,
                    "env.gate": 0.0
                }
            },

            noteOn: {
                change: {
                    "carrier.freq": 220
                },
                expected: {
                    "carrier.freq": 220,
                    "env.gate": 1.0
                }
            },

            noteOff: {
                change: {
                    "carrier.freq": 0
                },
                expected: {
                    "carrier.freq": 0,
                    "env.gate": 0.0
                }
            }
        },
        {
            synthOptions: {
                noteChanges: {
                    on: {
                        "env.sustain": 0.5
                    },

                    off: {
                        "env.release": 10
                    }
                }
            },

            initialState: {
                expected: {
                    "carrier.freq": 440,
                    "env.gate": 0.0,
                    "env.sustain": 1.0,
                    "env.release": 1.0
                }
            },

            noteOn: {
                change: {
                    "carrier.freq": 220
                },
                expected: {
                    "carrier.freq": 220,
                    "env.gate": 1.0,
                    "env.sustain": 0.5,
                    "env.release": 1.0
                }
            },

            noteOff: {
                change: {
                    "carrier.freq": 0
                },
                expected: {
                    "carrier.freq": 0,
                    "env.gate": 0.0,
                    "env.sustain": 0.5,
                    "env.release": 10
                }
            }
        }
    ];

    test("synth.noteOn()/noteOff()", function () {
        fluid.each(noteTestSpecs, flock.test.synth.testNoteEvents);
    });

    module("Group synths");

    var checkValueOnNodes = function (nodes, ugenName, inputName, expected) {
        $.each(nodes, function (i, node) {
            var actual = node.nodeList.namedNodes[ugenName].input(inputName);
            equal(expected, actual, "Node #" + i + " should have the correct value.");
        });
    };

    fluid.defaults("flock.test.synthGroup.base", {
        gradeNames: "flock.synth",
        addToEnvironment: false,

        model: {
            didGen: false
        },

        synthDef: {
            id: "mock",
            ugen: "flock.test.ugen.mock"
        },

        invokers: {
            genFn: {
                changePath: "didGen",
                value: true
            }
        }
    });

    fluid.defaults("flock.test.synthGroup.synth1", {
        gradeNames: "flock.test.synthGroup.base",

        synthDef: {
            freq: 110,
            mul: 0.1,
            options: {
                buffer: flock.generate(64, 1)
            }
        }
    });

    fluid.defaults("flock.test.synthGroup.synth2", {
        gradeNames: "flock.test.synthGroup.base",

        synthDef: {
            freq: 220,
            mul: 0.2,
            options: {
                buffer: flock.generate(64, 2)
            }
        }
    });

    test("flock.synth.group", function () {
        var synth1 = flock.test.synthGroup.synth1();
        var synth2 = flock.test.synthGroup.synth2();

        var group = flock.synth.group({
            addToEnvironment: false
        });

        group.head(synth1);
        group.tail(synth2);
        equal(group.nodeList.nodes.length, 2,
            "Both synths should have been added to the group.");

        var inputVal = group.input("mock.freq");
        equal(inputVal, 220,
            "Getting an input on the group with input() should return the tail synth's value.");

        inputVal = group.get("mock.freq");
        equal(inputVal, 220,
            "Getting an input on the group with get() should return the tail synth's value.");

        group.input("mock.freq", 440);
        checkValueOnNodes(group.nodeList.nodes, "mock", "freq", 440);

        group.set("mock.mul", 0.5);
        checkValueOnNodes(group.nodeList.nodes, "mock", "mul", 0.5);

        group.genFn(group.nodeList.nodes, group.model);

        ok(synth1.model.didGen && synth2.model.didGen,
            "All nodes should recieve the gen() method when it is called on the group.");
    });


    var checkVoiceInputValues = function (synth, voiceName, expectedValues, msg) {
        var voice = synth.voiceAllocator.activeVoices[voiceName],
            keys = Object.keys(expectedValues),
            inputVals = voice.input(keys);

        deepEqual(inputVals, expectedValues, msg);
    };

    var checkVoicesAndInputValues = function (synth, expectations, msg) {
        var numActive = Object.keys(synth.voiceAllocator.activeVoices).length,
            numExpected = Object.keys(expectations).length;

        equal(numActive, numExpected,
            "The expected voices should be playing.");

        $.each(expectations, function (voiceName, expectedValues) {
            checkVoiceInputValues(synth, voiceName, expectedValues, msg);
        });
    };

    var polySynthTestSpecs = [
        {
            event: "noteOn",
            args: ["cat"],
            expected: {
                "cat": {
                    "env.gate": 1,
                    "carrier.freq": 440
                }
            },
            msg: "The first voice should be active."
        },
        {
            event: "noteOn",
            args: ["dog", {
                "carrier.freq": 220
            }],
            expected: {
                cat: {
                    "env.gate": 1,
                    "carrier.freq": 440
                },
                dog: {
                    "env.gate": 1,
                    "carrier.freq": 220
                }
            },
            msg: "Both voices should be active"
        },
        {
            event: "noteOff",
            args: ["cat"],
            expected: {
                "dog": {
                    "env.gate": 1,
                    "carrier.freq": 220
                }
            },
            msg: "Only the second voice should still be active."
        },
        {
            event: "noteOff",
            args: ["dog"],
            expected: {},
            msg: "No voices should be active."
        }
    ];

    test("flock.synth.polyphonic", function () {
        var def = {
            id: "carrier",
            ugen: "flock.test.ugen.mock",
            freq: 440,
            mul: {
                id: "env",
                ugen: "flock.test.ugen.mock",
                gate: 0
            }
        };

        var poly = flock.synth.polyphonic({
            synthDef: def,
            addToEnvironment: false
        });
        equal(Object.keys(poly.voiceAllocator.activeVoices).length, 0,
            "When a polyphonic synth is instantiated, it should have no active voices.");

        $.each(polySynthTestSpecs, function (i, testSpec) {
            var fn = poly[testSpec.event];
            fn.apply(poly, testSpec.args);
            checkVoicesAndInputValues(poly, testSpec.expected, testSpec.msg);
        });
    });


    module("Parsing tests");

    var checkRegisteredUGens = function (synth, expectedNumEvals) {
        equal(Object.keys(synth.nodeList.namedNodes).length, 3, "There should be three registered ugens.");
        equal(synth.nodeList.nodes.length, expectedNumEvals,
            "There should be " + expectedNumEvals + " ugens in the 'all' list, including the output.");
    };

    var checkParsedTestSynthDef = function (synthDef, expectedNumEvalUGens) {
        var synth = flock.synth({
            synthDef: synthDef
        }), namedUGens = synth.nodeList.namedNodes;

        checkRegisteredUGens(synth, expectedNumEvalUGens);
        ok(namedUGens.sine, "The sine ugen should be keyed by its id....");
        equal(0, namedUGens.sine.model.phase, "...and it should be a real osc ugen.");

        ok(namedUGens.mul, "The mul ugen should be keyed by its id...");
        ok(namedUGens.mul.model.value, "...and it should be a real value ugen.");
    };

    var condensedTestSynthDef = {
        id: "sine",
        ugen: "flock.ugen.sinOsc",
        freq: 440,
        mul: {
            id: "mul",
            ugen: "flock.ugen.value",
            value: 1.0
        }
    };

    var expandedTestSynthDef = {
        id: flock.OUT_UGEN_ID,
        ugen: "flock.ugen.out",
        inputs: {
            sources: condensedTestSynthDef,
            bus: 0,
            expand: 2
        }
    };

    test("flock.synth(), no output specified", function () {
        checkParsedTestSynthDef(condensedTestSynthDef, 7);
    });

    test("flock.synth(), output specified", function () {
        checkParsedTestSynthDef(expandedTestSynthDef, 7);
    });

    test("flock.synth() with multiple channels", function () {
        var multiChanTestSynthDef = [
            {
                id: "leftSine",
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: 440
                }
            },
            {
                id: "rightSine",
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: 444
                }
            }
        ];

        var synth = flock.synth({
            synthDef: multiChanTestSynthDef
        });
        var namedUGens = synth.nodeList.namedNodes;

        checkRegisteredUGens(synth, 9);
        ok(namedUGens.leftSine, "The left sine ugen should have been parsed correctly.");
        ok(namedUGens.rightSine, "The right sine ugen should have been parsed correctly.");
        deepEqual(synth.out.inputs.sources,
            [namedUGens.leftSine, namedUGens.rightSine],
            "The output ugen should have an array of sources, containing the left and right sine ugens.");
    });

    test("flock.synth() with mix of compressed and expanded ugenDefs", function () {
        var mixedSynthDef = {
            id: "carrier",
            ugen: "flock.test.ugen.mock",
            freq: {
                id: "mod",
                ugen: "flock.test.ugen.mock",
                inputs: {
                    freq: 440,
                    phase: {
                        id: "line",
                        ugen: "flock.test.ugen.mock",
                        start: 1,
                        end: 10,
                        duration: 2
                    }
                }
            }
        };

        var synth = flock.synth({
            synthDef: mixedSynthDef
        }), namedUGens = synth.nodeList.namedNodes;

        equal(namedUGens.carrier.inputs.freq, namedUGens.mod,
            "The modulator should have been set as the frequency input to the carrier.");
        equal(namedUGens.mod.inputs.freq.model.value, 440,
            "The modulator's frequency should be 440.");
        equal(namedUGens.mod.inputs.phase, namedUGens.line,
            "The modulator's phase input should be set to the line ugen.");
        equal(namedUGens.line.inputs.end.model.value, 10,
            "The line's inputs should be set correctly.");
    });

}());
