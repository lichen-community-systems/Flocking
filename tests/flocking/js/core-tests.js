/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, QUnit, module, test, asyncTest, expect, ok, equal, deepEqual, start*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.registerNamespace("flock.test.core");

    flock.init();

    var $ = fluid.registerNamespace("jQuery");

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

    module("Utility tests");


    test("flock.isIterable()", function () {
        var iterable = [
            {
                val: ["cat", "dog"],
                msg: "A standard Array should be iterable."
            },
            {
                val: new Float32Array([0, 1, 2]),
                msg: "A typed array should be iterable."
            }
        ];

        var notIterable = [
            {
                val: {
                    cat: "dog"
                },
                msg: "An Object should not be iterable."
            },
            {
                val: true,
                msg: "A boolean should not be iterable."
            },
            {
                val: function () {
                    "cat";
                },
                msg: "A Function should not be iterable."
            },
            {
                val: "Stringy",
                msg: "A String should not be iterable."
            },
            {
                val: 42,
                msg: "A number should not be iterable."
            },
            {
                val: undefined,
                msg: "Undefined should not be iterable."
            },
            {
                val: null,
                msg: "Null should not be iterable."
            }
        ];

        fluid.each(iterable, function (testSpec) {
            ok(flock.isIterable(testSpec.val), testSpec.msg);
        });

        fluid.each(notIterable, function (testSpec) {
            ok(!flock.isIterable(testSpec.val), testSpec.msg);
        });

    });

    test("flock.parseMidiString", function () {
        function runMidiStringTest(testSpec) {
            var actual = flock.parseMidiString(testSpec.note);
            deepEqual(actual, testSpec.expected, testSpec.name);
        }


        var testSpecs = [
            {
                name: "No accidental, c0",
                note: "c0",
                expected: 0
            },
            {
                name: "No accidental",
                note: "e9",
                expected: 112
            },
            {
                name: "Sharp lower case",
                note: "g#6",
                expected: 80
            },
            {
                name: "Sharp upper case",
                note: "F#6",
                expected: 78
            },
            {
                name: "Flat",
                note: "Bb8",
                expected: 106
            },
            {
                name: "Two digits",
                note: "G10",
                expected: 127
            },
            {
                name: "Two digits with accidental",
                note: "C#10",
                expected: 121
            },
            {
                name: "Invalid note name",
                note: "cat27",
                expected: NaN
            }
            // What about out of range octaves? Should it work?
        ];

        fluid.each(testSpecs, runMidiStringTest);
    });

    var defaultFailMode = flock.debug.failHard;
    module("Path utilities", {
        teardown: function () {
            flock.debug.failHard = defaultFailMode;
        }
    });

    test("flock.set()", function () {
        var root = {
            cat: "meow",
            dog: {
                sheltie: "bark"
            }
        };

        var tests = [
            {
                path: "cat",
                value: "rreow",
                msg: "Single-segment path."
            },
            {
                path: "dog.sheltie",
                value: "roof",
                msg: "Multi-segment path."
            },
            {
                path: "dog.sheltie",
                value: {
                    fur: {
                        primary: "sable",
                        secondary: "white"
                    }
                },
                msg: "Multi-segment path, object value."
            },
            {
                path: "dog.claws.count",
                value: 25,
                msg: "Path with non-existent middle segment should cause the container to be created."
            },
            {
                path: "dog.sheltie",
                value: undefined,
                msg: "Valid path, undefined value."
            },
            {
                path: "dog.sheltie",
                value: null,
                msg: "Valid path, null value."
            }
        ];

        $.each(tests, function (i, spec) {
            flock.set(root, spec.path, spec.value);
            equal(flock.get(root, spec.path), spec.expected || spec.value, spec.msg);
        });

        // Error cases
        try {
            flock.set(root, "cat.claws.count", 25);
            ok(false);
        } catch (e) {
            ok(e.message.indexOf("cat") !== -1);
        }
    });

    var assertNoErrorThrown = function (fn) {
        try {
            fn();
            ok(true, "A hard error shouldn't be thrown.");
        } catch (e) {
            ok(false, "A hard error shouldn't be thrown.");
        }
    };

    var assertErrorThrown = function (fn) {
        try {
            fn();
            ok(false, "A hard error should be thrown.");
        } catch (e) {
            ok(true, "A hard error should be thrown.");
        }
    };

    test("Getting and setting invalid paths with soft failure enabled", function () {
        flock.debug.failHard = false;

        assertNoErrorThrown(function () {
            flock.get({}, "cow.moo");
        });

        assertNoErrorThrown(function () {
            flock.set({}, "cow.moo", true);
        });
    });

    test("Getting and setting invalid paths with hard failure enabled", function () {
        flock.debug.failHard = true;

        assertErrorThrown(function () {
            flock.get({}, "cow.moo");
        });

        assertErrorThrown(function () {
            flock.set({}, "cow.moo", true);
        });
    });

    var testInputPathExpansion = function (testSpecs) {
        $.each(testSpecs, function (i, spec) {
            var actual = flock.input.pathExpander(spec.path);
            equal(actual, spec.expected, spec.msg,
                "Setting to a non-container type should cause an error to be thrown.");
        });
    };

    test("flock.synth.inputPathExpander()", function () {
        testInputPathExpansion([
            {
                path: "cat.dog",
                expected: "cat.inputs.dog",
                msg: "With a single dot, the path should have been expanded as an input path."
            },
            {
                path: "cat.dog.hamster",
                expected: "cat.inputs.dog.inputs.hamster",
                msg: "With multiple dots, the path should have been expanded as an input path."
            },
            {
                path: "cat.dog.1.hamster",
                expected: "cat.inputs.dog.1.inputs.hamster",
                msg: "With a single-digit number, all segments except immediately preceding the number path should have been expanded."
            },
            {
                path: "cat.dog.27.hamster",
                expected: "cat.inputs.dog.27.inputs.hamster",
                msg: "With a multi-digit number, all segments except immediately preceding the number path should have been expanded."
            },
            {
                path: "cat27.dog.0.fish42",
                expected: "cat27.inputs.dog.0.inputs.fish42",
                msg: "Path segments with numbers should be handled correctly."
            },
            {
                path: "cat.dog.model.value",
                expected: "cat.inputs.dog.model.value",
                msg: "The special 'model' keyword should not be expanded"
            },
            {
                path: "cat.dog.options.isAwesome",
                expected: "cat.inputs.dog.options.isAwesome",
                msg: "The special 'options' keyword should not be expanded"
            },
            {
                path: "cat.dog.options.model",
                expected: "cat.inputs.dog.options.model",
                msg: "Reference to options.model should not be expanded"
            },
            {
                path: "cat.dog.Options.Model",
                expected: "cat.inputs.dog.inputs.Options.inputs.Model",
                msg: "The match must be case sensitive"
            },
            {
                path: "fish.modelizedCat.dogoptions.hamster.model.options.model",
                expected: "fish.inputs.modelizedCat.inputs.dogoptions.inputs.hamster.model.options.model",
                msg: "Partial matches on the words 'options' or 'model' should be ignored."
            },
            {
                path: "dog.optionsCat.modelDog.value",
                expected: "dog.inputs.optionsCat.inputs.modelDog.inputs.value",
                msg: "Partial matches on the words 'options' or 'model' should be ignored."
            },
            {
                path: "sine.freq.model",
                expected: "sine.inputs.freq.model",
                msg: "Special segment at the end should be matched"
            },
            {
                path: "sine.freq.options",
                expected: "sine.inputs.freq.options",
                msg: "Special segment at the end should be matched"
            },
            {
                path: "model.freq",
                expected: "model.inputs.freq",
                msg: "Special segment at the beginning should not be matched"
            }
        ]);
    });

    test("flock.generate()", function () {
        // Buffer size and static number for the generator.
        var expected = new Float32Array([1.0, 1.0, 1.0]);
        var actual = flock.generate(3, 1.0);
        deepEqual(actual, expected, "Buffer size as a number and generator as a scalar.");

        // Pre-existing buffer and a static number for the generator.
        expected = new Float32Array(5);
        actual = flock.generate(expected, 42.0);
        equal(actual, expected, "When a buffer is supplied as the first argument, it should operated on in place.");

        // Pre-existing buffer and a generator function.
        expected = new Float32Array([99.9, 199.8]);
        var inputBuffer = new Float32Array(2);
        actual = flock.generate(inputBuffer, function (i) {
            return 99.9 * (i + 1);
        });
        equal(actual, inputBuffer,
            "When a buffer is supplied as the first argument and a generator as the second, the buffer should operated on in place.");
        deepEqual(actual, expected,
            "The generator should be invoked with the increment value as its first argument, and its output should be placed in the buffer.");

        // Buffer size and generator function
        expected = new Float32Array([0, 42, 0, 42, 0]);
        actual = flock.generate(5, function (i) {
            return i % 2 > 0 ? 42 : 0;
        });
        deepEqual(actual, expected, "Buffer size as a number and generator function.");
    });

    var testNormalize = function (normal, unnormalized, expected) {
        var actual = flock.normalize($.map(unnormalized, fluid.identity), normal);
        deepEqual(actual, expected, "Buffer normalized to " + normal + ".");
    };

    test("flock.reverse()", function () {
        expect(5);

        var forwardRaw = [1, 2, 3, 4, 5],
            forwardTyped = new Float32Array(forwardRaw),
            reverseRaw = [5, 4, 3, 2, 1],
            reverseTyped = new Float32Array(reverseRaw),
            actual = flock.reverse(forwardTyped);

        deepEqual(actual, reverseTyped, "A typed array should be reversed as expected.");

        actual = flock.reverse(forwardRaw);
        deepEqual(actual, reverseRaw, "A plain JS array should be reversed as expected.");

        var empty = [];
        actual = flock.reverse(empty);
        equal(actual, empty, "An empty array should be returned as is.");

        var oneItemList = ["Cat"];
        actual = flock.reverse(oneItemList);
        equal(actual, oneItemList, "A single-item list should be returned as is.");

        var nonArray = {a: "cat", b: new Float32Array([1, 2, 3])};
        actual = flock.reverse(nonArray);
        equal(actual, nonArray, "A non array argument should be returned as is.");
    });

    test("flock.normalize()", function () {
        expect(6);
        var unnormalized = [0.0, 0.5, 1.0, 1.5, 2.0];
        testNormalize(1.0, unnormalized, [0.0, 0.25, 0.5, 0.75, 1.0]);
        testNormalize(0.5, unnormalized, [0.0, 0.125, 0.25, 0.375, 0.5]);
        testNormalize(3.0, unnormalized, [0.0, 0.75, 1.5, 2.25, 3.0]);

        var mixedUnnormalized = [-1.0, -0.5, 0.0, 0.5, 1.0, 0.5, 0.0];
        testNormalize(1.0, mixedUnnormalized, mixedUnnormalized);
        testNormalize(0.5, mixedUnnormalized, [-0.5, -0.25, 0.0, 0.25, 0.5, 0.25, 0.0]);

        var negUnnormalized = [-5.0, -4.0, -3.0, -2.0, -1.0, -0.5, -0.25];
        testNormalize(1.0, negUnnormalized, [-1.0, -0.8, -0.6, -0.4, -0.2, -0.1, -0.05]);
    });


    module("Synth tests", {
        teardown: function () {
            flock.enviro.shared.reset();
        }
    });

    fluid.defaults("flock.test.genReportSynth", {
        gradeNames: ["flock.synth", "autoInit"],

        model: {
            didGen: false
        },

        synthDef: {
            ugen: "flock.ugen.silence"
        },

        invokers: {
            reset: {
                func: "{that}.applier.change",
                args: ["didGen", false]
            }
        }
    });

    flock.test.genReportSynth.finalInit = function (that) {
        that.gen = function () {
            that.applier.change("didGen", true);
        };
    };

    var testEnviroGraph = function (fn) {
        var audioSettings = flock.enviro.shared.audioSettings;

        setTimeout(function () {
            fn();
            start();
        }, (audioSettings.bufferSize / audioSettings.rates.audio) * 2000);
    };

    asyncTest("Auto add to the environment", function () {
        var synth = flock.test.genReportSynth();
        flock.enviro.shared.play();

        testEnviroGraph(function () {
            ok(flock.enviro.shared.nodes.indexOf(synth) > -1,
                "The synth should have been automatically added to the environment.");
            ok(synth.model.didGen,
                "The synth should have been evaluated.");
        });
    });

    asyncTest("Don't auto add to the environment", function () {
        var synth = flock.test.genReportSynth({
            addToEnvironment: false
        });
        flock.enviro.shared.play();

        testEnviroGraph(function () {
            ok(flock.enviro.shared.nodes.indexOf(synth) === -1,
                "The synth should not have been automatically added to the environment.");
            ok(!synth.model.didGen,
                "The synth should not have been evaluated.");
        });
    });

    asyncTest("Remove from the environment", function () {
        var synth = flock.test.genReportSynth();
        flock.enviro.shared.play();

        var audioSettings = flock.enviro.shared.audioSettings,
            waitDur = (audioSettings.bufferSize / audioSettings.rates.audio) * 1000 * 2;

        setTimeout(function () {
            ok(flock.enviro.shared.nodes.indexOf(synth) > -1,
                "The synth should have been automatically added to the environment.");
            ok(synth.model.didGen,
                "The synth should have been evaluated.");

            synth.pause();

            ok(flock.enviro.shared.nodes.indexOf(synth) === -1,
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
        var audioSettings = flock.enviro.shared.audioSettings,
            waitDur = (audioSettings.bufferSize / audioSettings.rates.audio) * 1000 * 2;

        flock.enviro.shared.play();

        setTimeout(function () {
            ok(flock.enviro.shared.nodes.indexOf(synth) > -1,
                "The synth should have been automatically added to the environment.");
            ok(synth.model.didGen,
                "The synth should have been evaluated.");

            synth.reset();
            synth.destroy();
            ok(flock.enviro.shared.nodes.indexOf(synth) === -1,
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
        equal(synth.input("sine.freq"), 440,
            "Getting 'sine.freq' should return the value set in the synthDef.");
        equal(synth.input("sine.freq"), 440,
            "Getting 'sine.freq' a second time should return the same value.");
        equal(synth.input("mod.freq"), 1.0,
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
            sineUGen = synth.namedNodes.sine,
            modUGen = synth.namedNodes.mod;

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
        equal(synth.namedNodes.sine.inputs.mul, dust,
            "The 'mul' ugen should be set to our test Dust ugen.");
        equal(synth.namedNodes.sine.inputs.mul.inputs.density.model.value, 200,
            "The ugen should be set up correctly.");

        // Set a named ugen directly.
        synth = createSynth(simpleSynthDef);
        synth.input("sine", {
            ugen: "flock.ugen.lfNoise",
            freq: 123
        });
        equal(synth.namedNodes.sine.inputs.freq.model.value, 123,
            "Directly setting a named unit generator should cause the previous ugen to be replaced.");
        ok(sineUGen !== synth.namedNodes.sine);
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
            expected = synth.namedNodes.adder.inputs.sources[1];
        equal(actual, expected, "Getting a ugen input within an array should return the correct ugen.");

        actual = synth.input("adder.sources.1.freq");
        expected = 880;
        equal(actual, expected,
            "Getting a value from a ugen within an array should return the correct value.");

        synth.input("adder.sources.1.freq", 889);
        expected = 889;
        actual = synth.namedNodes.adder.inputs.sources[1].inputs.freq.model.value;
        equal(actual, expected,
            "Setting a value on a ugen within an array should succeed.");

        synth.input("adder.sources.0", {
            ugen: "flock.ugen.lfNoise",
            freq: 456
        });
        equal(synth.namedNodes.adder.inputs.sources[0].inputs.freq.model.value, 456,
            "Setting a ugen within an array should succeed.");
    });

    var testSetUGenArray = function (synth, path, value, expectedNumNodes, oldUGens, msgPrefix) {
        var result = synth.set(path, value);

        equal(value.length, synth.get("out.sources").length,
            msgPrefix + ": " +
            "The input should have the correct number of unit generators attached to it.");
        equal(synth.nodes.length, expectedNumNodes,
            msgPrefix + ": " +
            "The unit generator list should have been updated with the new unit generator count (i.e. old inputs removed, new ones added).");

        var activeOldCount = 0;
        for (var i = 0; i < oldUGens.length; i++) {
            activeOldCount += synth.nodes.indexOf(oldUGens[i]);
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

        equal(synth.nodes.length, 11,
            "Sanity check: all 11 unit generators should have been added to the synth.");

        var result = synth.get("out.sources");
        equal(result, synth.namedNodes.out.inputs.sources,
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

        direct = synth.namedNodes.sine;

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
                    freq: flock.enviro.shared.audioSettings.rates.audio,
                    list: flock.test.fillBuffer(1, 64)
                }
            }
        });

        var passThrough = synth.get("pass");
        synth.gen();
        deepEqual(passThrough.output, flock.test.fillBuffer(1, 64),
            "When first instantiating the synth, a unit generator's inputs should be evaluated first.");

        synth.set("pass.source", {
            ugen: "flock.ugen.sequence",
            rate: "audio",
            freq: flock.enviro.shared.audioSettings.rates.audio,
            list: flock.test.fillBuffer(64, 127)
        });
        synth.gen();
        deepEqual(passThrough.output, flock.test.fillBuffer(64, 127),
            "After swapping one active unit generator for another, the correct order should be preserved.");

        synth.set("pass.source", 1.0);
        synth.gen();
        var expected = new Float32Array(64);
        expected[0] = 1.0; // With a control rate source input, passThrough will only output the first value.
        deepEqual(passThrough.output, expected,
            "Replacing an active ugen with an inactive one.");

        synth.set("pass.source", {
            ugen: "flock.ugen.sequence",
            rate: "audio",
            freq: flock.enviro.shared.audioSettings.rates.audio,
            list: flock.test.fillBuffer(128, 191)
        });
        synth.gen();
        deepEqual(passThrough.output, flock.test.fillBuffer(128, 191),
            "Replacing an inactive ugen for an active one.");
    });

    var setAndTestUGenCount = function (synth, change, expected, msg) {
        if (change) {
            synth.set(change);
        }
        equal(synth.nodes.length, expected, msg);
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
            synth[genMethodName]();
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


    module("nodeList and ugenNodeList");

    test("flock.nodeList", function () {
        var nl = flock.nodeList();
        equal(nl.nodes.length, 0,
            "When a NodeList is instantiated, it should contain no nodes.");

        var testNodes = [{nickName: "first"}, {cat: "second"}, {nickName: "third"}];
        nl.head(testNodes[0]);
        equal(nl.nodes.length, 1,
            "The node should have been added to the list.");
        equal(nl.nodes[0], testNodes[0],
            "The node should have been added at the correct index.");
        equal(1, Object.keys(nl.namedNodes).length,
            "The node should have also been added to the collection of namedNodes.");

        nl.remove(testNodes[0]);
        equal(nl.nodes.length, 0,
            "The node should have been removed from the list");
        equal(0, Object.keys(nl.namedNodes).length,
            "The node should have also been removed from the collection of namedNodes.");

        nl.remove(testNodes[0]);
        equal(nl.nodes.length, 0,
            "Removing a node that is not in the list should not cause errors, and the list should remain the same.");
        equal(0, Object.keys(nl.namedNodes).length,
            "The collection of namedNodes should also remain the same.");

        nl.head(testNodes[2]);
        nl.head(testNodes[0]);
        deepEqual(nl.nodes, [testNodes[0], testNodes[2]],
            "Adding a node to the head of the list should put it in the correct position.");
        deepEqual(nl.namedNodes, {"first": testNodes[0], "third": testNodes[2]},
            "The collection of namedNodes should contain all nodes with a valid nickName.");

        nl.tail(testNodes[0]);
        deepEqual(nl.nodes, [testNodes[0], testNodes[2], testNodes[0]],
            "Adding a node twice should include it twice, in the correct positions.");
        deepEqual(nl.namedNodes, {"first": testNodes[0], "third": testNodes[2]},
            "The collection of namedNodes should remain the same.");

        nl.remove(testNodes[0]);
        deepEqual(nl.nodes, [testNodes[2], testNodes[0]],
            "Removing a duplicate node should remove the first one.");
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "But the node will be removed entirely from the namedNodes collection.");

        nl.insert(1, testNodes[1]);
        deepEqual(nl.nodes, [testNodes[2], testNodes[1], testNodes[0]],
            "Adding a node at a specific position should work.");
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "A unit generator without a nickName should not be added to namedNodes.");
        nl.remove(testNodes[1]);
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "The collection of namedNodes should not change when a node without a nickname is removed.");

        nl.before(testNodes[0], testNodes[1]);
        deepEqual(nl.nodes, [testNodes[2], testNodes[1], testNodes[0]],
            "Adding a node before another node should work.");
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same.");

        nl.after(testNodes[0], testNodes[1]);
        deepEqual(nl.nodes, [testNodes[2], testNodes[1], testNodes[0], testNodes[1]],
            "Adding a duplicate node after another node should work.");
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same.");

        nl.remove(testNodes[1]);
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same after a non-nickNamed node is removed.");

        nl.remove(testNodes[0]);
        deepEqual(nl.namedNodes, {"third": testNodes[2]},
            "namedNodes should remain the same after a nickNamed node is removed, which a duplicated of had already been removed.");

        nl.after(testNodes[2], testNodes[0]);
        deepEqual(nl.nodes, [testNodes[2], testNodes[0], testNodes[1]],
            "Adding a node after another node should work.");
        deepEqual(nl.namedNodes, {"first": testNodes[0], "third": testNodes[2]},
            "namedNodes should have been updated.");
    });

    test("flock.ugenNodeList", function () {
        var testNodes = [
            {
                nickName: "1",
                tags: ["flock.ugen"],
                inputs: {
                    cat: {
                        nickName: "1.2",
                        tags: ["flock.ugen"],
                        inputs: {
                            dog: {
                                nickName: "1.1",
                                tags: ["flock.ugen"]
                            }
                        }
                    }
                }
            },
            {
                nickName: "2",
                tags: ["flock.ugen"]
            },
            {
                nickName: "3",
                tags: ["flock.ugen"],
                inputs: {
                    hamster: {
                        nickName: 3.1,
                        tags: ["flock.ugen"]
                    }
                }
            }
        ];

        var ugnl = flock.ugenNodeList();
        equal(ugnl.nodes.length, 0,
            "When a ugenNodeList is instantiated, it should contain no nodes.");
        equal(Object.keys(ugnl.namedNodes).length, 0,
            "When a ugenNodeList is instantiated, it should contain no named nodes.");

        ugnl.insertTree(0, testNodes[0]);
        deepEqual(ugnl.nodes, [testNodes[0].inputs.cat.inputs.dog, testNodes[0].inputs.cat, testNodes[0]],
            "The list of nodes should include the node and all its inputs and grandinputs.");
        deepEqual(ugnl.namedNodes, {
            "1": testNodes[0],
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat
        }, "The named nodes collection should contain the added unit generator and all its inputs.");

        ugnl.removeTree(testNodes[0]);
        equal(ugnl.nodes.length, 0,
            "After removing the unit generator and all its inputs, there should be no active nodes.");
        deepEqual(ugnl.namedNodes, {}, "Nor any named nodes.");

        ugnl.insertTree(0, testNodes[2]);
        equal(ugnl.nodes.length, 2, "The node list should contain the inserted node and its input.");
        deepEqual(ugnl.namedNodes, {
            "3": testNodes[2],
            "3.1": testNodes[2].inputs.hamster
        }, "The named nodes collection should also contain the inserted nodes.");

        ugnl.removeTree(testNodes[2].inputs.hamster);
        equal(ugnl.nodes.length, 1, "The specified node should have been removed, but not its parent node.");
        deepEqual(ugnl.namedNodes, {
            "3": testNodes[2]
        }, "The node should have been removed from the named nodes collection.");

        ugnl.insertTree(0, testNodes[0]);
        equal(ugnl.nodes.length, 4, "The node and its inputs should have been added.");
        deepEqual(ugnl.namedNodes, {
            "1": testNodes[0],
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat,
            "3": testNodes[2]
        }, "The named nodes collection should contain the added unit generator and all its inputs.");

        ugnl.swapTree(testNodes[1], testNodes[0]);
        equal(ugnl.nodes.length, 4, "The new node should have been swapped in, leaving all the previous inputs.");
        deepEqual(ugnl.namedNodes, {
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat,
            "2": testNodes[1],
            "3": testNodes[2]
        }, "The new node should have been added to the named nodes, leaving the others untouched.");

        ugnl.removeTree(testNodes[1]);
        deepEqual(ugnl.namedNodes, {
            "3": testNodes[2]
        }, "The node and all its swapped inputs should have been removed.");

        var multiInputNode = {
            nickName: "4",
            inputs: {
                giraffe: {
                    nickName: 4.1,
                    tags: ["flock.ugen"]
                },
                goose: {
                    nickName: 4.2,
                    tags: ["flock.ugen"]
                }
            }
        };

        ugnl.removeTree(testNodes[2]);
        ugnl.insertTree(0, multiInputNode);
        ugnl.swapTree(testNodes[0], multiInputNode, ["goose"]);
        equal(ugnl.nodes.length, 4);
        deepEqual(ugnl.namedNodes, {
            "1": testNodes[0],
            "1.1": testNodes[0].inputs.cat.inputs.dog,
            "1.2": testNodes[0].inputs.cat,
            "4.2": multiInputNode.inputs.goose,
        }, "The new node should have been added along with its inputs, and the specified inputs should have been swapped..");

        ugnl.replaceTree(testNodes[2], testNodes[0]);
        equal(ugnl.nodes.length, 2);
        deepEqual(ugnl.namedNodes, {
            "3": testNodes[2],
            "3.1": testNodes[2].inputs.hamster
        }, "The old node and all its inputs should be replaced by the new one and its inputs.");
    });

    var testRemoval = function (synthDef, testSpecs) {
        var synth = flock.synth({
            synthDef: synthDef
        });

        $.each(testSpecs, function (i, spec) {
            var toRemove = spec.ugenToRemove;
            if (toRemove) {
                toRemove = typeof (toRemove) === "string" ? flock.get(synth, toRemove) : toRemove;
                synth.removeTree(toRemove, true);
            }
            equal(synth.nodes.length, spec.expected.all,
                spec.msg + ", there should be " + spec.expected.all + " all ugens.");
            equal(Object.keys(synth.namedNodes).length, spec.expected.named,
                spec.msg + ", there should be " + spec.expected.named + " named ugens.");
        });
    };

    var nestedSynthDef = {
        ugen: "flock.ugen.out",
        inputs: {
            sources: {
                ugen: "flock.test.ugen.mock",
                inputs: {
                    gerbil: {
                        id: "gerbil",
                        ugen: "flock.test.ugen.mock",
                        inputs: {
                            ear: {
                                id: "ear",
                                ugen: "flock.ugen.value",
                                value: 500
                            }
                        }
                    },
                    cat: {
                        id: "cat",
                        ugen: "flock.test.ugen.mock"
                    },
                    dog: {
                        ugen: "flock.test.ugen.mock"
                    }
                }
            },
            bus: 0,
            expand: 2
        }
    };

    test("flock.ugenNodeList: removing ugens", function () {
        var removalTestSpecs = [
            {
                ugenToRemove: null,
                expected: {
                    all: 8,
                    named: 3
                },
                msg: "To start"
            },
            {
                ugenToRemove: "namedNodes.ear",
                expected: {
                    all: 7,
                    named: 2
                },
                msg: "After removing a passive, named ugen"
            },
            {
                ugenToRemove: "namedNodes.cat",
                expected: {
                    all: 6,
                    named: 1
                },
                msg: "After removing an active, named ugen"
            },
            {
                ugenToRemove: "out.inputs.sources.inputs.dog",
                expected: {
                    all: 5,
                    named: 1
                },
                msg: "After removing an active, unnamed ugen"
            },
            {
                ugenToRemove: "out",
                expected: {
                    all: 0,
                    named: 0
                },
                msg: "After removing a ugen with other inputs, its inputs should be recursively removed"
            }
        ];

        testRemoval(nestedSynthDef, removalTestSpecs);
    });


    test("flock.ugenNodeList.replace(): reattach inputs", function () {
        var synth = flock.synth({
            synthDef: nestedSynthDef
        });

        var toReplace = synth.namedNodes.gerbil,
            expectedInput = synth.namedNodes.ear,
            newUGen = flock.parse.ugenForDef({
                id: "gerbil",
                ugen: "flock.test.ugen.mock"
            });
        synth.swapTree(newUGen, toReplace);

        equal(synth.namedNodes.gerbil, newUGen,
            "The old ugen should have been replaced by the new one.");
        equal(synth.namedNodes.gerbil.inputs.ear, expectedInput,
            "The old ugen's input should have been copied over to the new one.");
        // TODO: Why is this failing?
        //deepEqual(synth.out.inputs.sources.inputs.gerbil, newUGen, "The new ugen's output should be wired back up.");
    });


    module("Group synths");

    var checkValueOnNodes = function (nodes, ugenName, inputName, expected) {
        $.each(nodes, function (i, node) {
            var actual = node.namedNodes[ugenName].input(inputName);
            equal(expected, actual, "Node #" + i + " should have the correct value.");
        });
    };

    test("flock.synth.group", function () {
        var synth1DidGen = false;
        var synth2DidGen = false;

        var synthOpts = {
            addToEnvironment: false
        };
        var synth1 = flock.synth({
            synthDef: {
                id: "mock",
                ugen: "flock.test.ugen.mock",
                freq: 110,
                mul: 0.1,
                options: {
                    buffer: flock.generate(64, 1),
                    gen: function () {
                        synth1DidGen = true;
                    }
                }
            }
        }, synthOpts);
        var synth2 = flock.synth({
            synthDef: {
                id: "mock",
                ugen: "flock.test.ugen.mock",
                freq: 220,
                mul: 0.2,
                options: {
                    buffer: flock.generate(64, 2),
                    gen: function () {
                        synth2DidGen = true;
                    }
                }
            }
        }, synthOpts);

        var group = flock.synth.group(synthOpts);
        group.head(synth1);
        group.tail(synth2);
        equal(2, group.nodes.length,
            "Both synths should have been added to the group.");

        var inputVal = group.input("mock.freq");
        equal(inputVal, 220,
            "Getting an input on the group with input() should return the tail synth's value.");

        inputVal = group.get("mock.freq");
        equal(inputVal, 220,
            "Getting an input on the group with get() should return the tail synth's value.");

        group.input("mock.freq", 440);
        checkValueOnNodes(group.nodes, "mock", "freq", 440);

        group.set("mock.mul", 0.5);
        checkValueOnNodes(group.nodes, "mock", "mul", 0.5);

        group.gen();
        ok(synth1DidGen && synth2DidGen,
            "All nodes should recieve the gen() method when it is called on the group.");
    });


    var checkVoiceInputValues = function (synth, voiceName, expectedValues, msg) {
        var inputVals = synth.activeVoices[voiceName].input(Object.keys(expectedValues));
        deepEqual(inputVals, expectedValues, msg);
    };

    var checkVoicesAndInputValues = function (synth, expectations, msg) {
        var numActive = Object.keys(synth.activeVoices).length,
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
        equal(Object.keys(poly.activeVoices).length, 0,
            "When a polyphonic synth is instantiated, it should have no active voices.");

        $.each(polySynthTestSpecs, function (i, testSpec) {
            var fn = poly[testSpec.event];
            fn.apply(poly, testSpec.args);
            checkVoicesAndInputValues(poly, testSpec.expected, testSpec.msg);
        });
    });


    module("Parsing tests");

    var checkRegisteredUGens = function (synth, expectedNumEvals) {
        equal(Object.keys(synth.namedNodes).length, 3, "There should be three registered ugens.");
        ok(synth.out,
            "The output ugen should have been stored at synth.out");
        equal(synth.nodes.length, expectedNumEvals,
            "There should be " + expectedNumEvals + " ugens in the 'all' list, including the output.");
    };

    var checkParsedTestSynthDef = function (synthDef, expectedNumEvalUGens) {
        var synth = flock.synth({
            synthDef: synthDef
        }), namedUGens = synth.namedNodes;

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
        var namedUGens = synth.namedNodes;

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
        }), namedUGens = synth.namedNodes;

        equal(namedUGens.carrier.inputs.freq, namedUGens.mod,
            "The modulator should have been set as the frequency input to the carrier.");
        equal(namedUGens.mod.inputs.freq.model.value, 440,
            "The modulator's frequency should be 440.");
        equal(namedUGens.mod.inputs.phase, namedUGens.line,
            "The modulator's phase input should be set to the line ugen.");
        equal(namedUGens.line.inputs.end.model.value, 10,
            "The line's inputs should be set correctly.");
    });

    test("flock.parse.ugenForDef special input handling", function () {
        var def = {
            ugen: "flock.ugen.osc",
            inputs: {
                table: [0.0, 0.5, 1.0, 0.5, 0.0, -0.5, -1.0, -0.5, 0.0],
                freq: {
                    ugen: "flock.ugen.value",
                    inputs: {
                        value: 299
                    }
                },
                buffer: {
                    url: "http://a.url"
                }
            }
        };

        var actual = flock.parse.ugenForDef(def);
        equal(actual.inputs.freq.inputs.value, 299,
            "A value input should not be expanded.");
        deepEqual(actual.inputs.table, def.inputs.table,
            "A table input should not be expanded.");
        deepEqual(actual.inputs.buffer, def.inputs.buffer,
            "A buffer def input should not be expanded.");
    });

    test("flock.parse.ugenForDef rate expansion", function () {
        var ugenDef = {
            ugen: "flock.ugen.sinOsc",
            rate: "kr",
            freq: {
                ugen: "flock.ugen.sinOsc",
                rate: flock.rates.AUDIO,
                freq: 440
            },
            mul: {
                ugen: "flock.ugen.lfNoise",
                rate: "ar"
            },
            add: {
                ugen: "flock.ugen.dust",
                rate: "cr"
            }
        };

        var parsed = flock.parse.ugenForDef(ugenDef);
        equal(parsed.rate, flock.rates.CONTROL,
            "A compressed control rate should be expanded to its full value.");
        equal(parsed.inputs.freq.rate, flock.rates.AUDIO,
            "An already-expanded audio rate should not be mangled.");
        equal(parsed.inputs.mul.rate, flock.rates.AUDIO,
            "A compressed audio rate should be expanded to its full value.");
        equal(parsed.inputs.add.rate, flock.rates.CONSTANT,
            "A compressed constant rate should be expanded to its full value.");
    });

    test("flock.parse.ugenForDef options merging", function () {
        var sinOscDef = {
            ugen: "flock.ugen.sinOsc",
            phase: 1.0
        };

        var ugen = flock.parse.ugenForDef(sinOscDef);
        equal(ugen.rate, flock.rates.AUDIO,
            "The rate option should be supplied by the ugen's defaults.");
        equal(ugen.inputs.freq.model.value, 440,
            "The frequency input should be supplied by the ugen's defaults.");
        equal(ugen.inputs.phase.model.value, 1.0,
            "The ugen's default phase input should be overridden by the ugenDef.");
    });


    var checkTypedArrayProperty = function (componentType, propertyPath, componentOptions) {
        var component = fluid.invokeGlobalFunction(componentType, [componentOptions]);
        var property = fluid.get(component, propertyPath);
        var isTyped = property instanceof Float32Array;
        ok(isTyped, "A typed array stored as a component default should not be corrupted.");
    };

    test("Typed Array Merge Preservation", function () {
        var ta = new Float32Array([1.1, 2.2, 3.3]);
        ok(ta instanceof Float32Array, "Sanity check: a Float32Array should be an instance of a Float32Array.");
        ok(!fluid.isPlainObject(ta), "fluid.isPlainObject() should not recognize a typed array as a primitive.");
        ok(!fluid.isPrimitive(ta), "fluid.isPrimitive() should not recognize a typed array as a primitive.");

        fluid.defaults("flock.test.typedArrayComponent", {
            gradeNames: ["fluid.littleComponent", "autoInit"],
            synthDef: {
                cat: ta
            }
        });

        // Check the property after it has been stored in fluid.defaults().
        var defaultProperty = fluid.defaults("flock.test.typedArrayComponent").synthDef.cat;
        ok(defaultProperty instanceof Float32Array);

        // Instantiate the component with no options and check the typed array property.
        checkTypedArrayProperty("flock.test.typedArrayComponent", "options.synthDef.cat");

        // Specify, in options, a typed array and check that it is not merged.
        checkTypedArrayProperty("flock.test.typedArrayComponent", "options.synthDef.cat", {
            synthDef: {
                cat: new Float32Array([4.4, 5.5, 6.6])
            }
        });
    });

    test("Options clamping", function () {
        var enviro = flock.init({
            chans: 64,
            numInputBuses: 128
        });
        ok(enviro.audioSettings.chans <= flock.MAX_CHANNELS,
            "The environment's number of channels should be clamped at " + flock.MAX_CHANNELS);
        equal(enviro.audioSettings.numInputBuses, flock.MAX_INPUT_BUSES,
            "The environment's number of input buses should be clamped at " + flock.MAX_INPUT_BUSES);
        ok(enviro.audioSettings.numInputBuses >= flock.MIN_INPUT_BUSES,
            "The environment should have at least " + flock.MIN_INPUT_BUSES + " input buses.");

        enviro = flock.init({
            chans: 1,
            numBuses: 1
        });
        ok(enviro.audioSettings.numBuses >= 2,
            "The environment should always have two or more buses.");

        enviro = flock.init({
            chans: 8,
            numBuses: 4
        });
        equal(enviro.audioSettings.numBuses, 8,
            "The environment should always have at least as many buses as channels.");
    });

    test("Options merging", function () {
        var enviro = flock.init({
            numBuses: 24,
            chans: 1
        });

        var expectedNumChans = !flock.platform.browser.safari ? 1 : enviro.audioStrategy.context.destination.channelCount;
        equal(enviro.audioSettings.chans, expectedNumChans,
            "The environment should have been configured with the specified chans option (except on Safari).");

        equal(enviro.audioSettings.numBuses, 24,
            "The environment should have been configured with the specified number of buses");

        equal(enviro.buses.length, 24,
            "The environment should actually have the specified number of buses.");
    });


    module("Bus tests");

    flock.test.core.runBusTests = function (type, numBuses, enviroOpts, expectedCalcFn) {
        var enviro = flock.init(enviroOpts),
            actualBusNum,
            expectedBusNum;

        for (var i = 0; i < numBuses; i++) {
            actualBusNum = enviro.acquireNextBus(type);
            expectedBusNum = expectedCalcFn(i, enviro);
            equal(actualBusNum, expectedBusNum,
                "The correct " + type + " bus number should have been returned.");
        }

        try {
            enviro.acquireNextBus(type);
            ok(false, "An error should have been thrown when " +
                "trying to acquire more than the available number of buses.");
        } catch (e) {
            ok(e.message.indexOf("insufficient buses available") > -1,
                "The correct error should be thrown when trying to acquire " +
                "more than the available number of buses.");
        }
    };

    test("Input bus acquisition", function () {
        var enviroOpts = {
            chans: 1,
            numBuses: 10,
            numInputBuses: 2
        };

        flock.test.core.runBusTests("input", 2, enviroOpts, function (runIdx, enviro) {
            return runIdx + enviro.audioSettings.chans;
        });
    });

    test("Interconnect bus acquisition", function () {
        var enviroOpts = {
            chans: 2,
            numBuses: 6,
            numInputBuses: 2
        };

        flock.test.core.runBusTests("interconnect", 2, enviroOpts, function (runIdx, enviro) {
            return runIdx + enviro.audioSettings.chans + enviro.audioSettings.numInputBuses;
        });
    });

    flock.test.core.testBusAcquisition = function (enviro, expected, msg) {
        var busNum = enviro.acquireNextBus("interconnect");
        QUnit.equal(busNum, expected, msg);
    };

    test("Bus acquisition after environment reset", function () {
        var enviroOptions = {
            chans: 2,
            numBuses: 6,
            numInputBuses: 2
        };

        var enviro = flock.init(enviroOptions);
        flock.test.core.testBusAcquisition(enviro, 4, "The first interconnect bus should have been acquired.");
        enviro.reset();
        flock.test.core.testBusAcquisition(enviro, 4,
            "The first interconnectBus should have been acquired again after resetting the environment.");
    });
}());
