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

(function () {
    "use strict";
    
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
        return flock.synth(synthDef, {
            sampleRate: 1,
            chans: 1
        });
    };
    
    module("Utility tests");
    
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
            }
        ];
        
        $.each(tests, function (i, spec) {
            flock.set(root, spec.path, spec.value);
            equals(flock.get(root, spec.path), spec.expected || spec.value, spec.msg);
        });
        
        // Error cases
        try {
            flock.set(root, "cat.claws.count", 25);
            ok(false);
        } catch (e) {
            ok(e.message.indexOf("cat") !== -1);
        }
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
        var actual = flock.normalize($.map(unnormalized, flock.identity), normal);
        deepEqual(actual, expected, "Buffer normalized to " + normal + ".");
    };
    
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
    
    test("flock.minBufferSize()", function () {
        var audioSettings = {
            rates: {
                audio: 44100,
                control: 64,
                constant: 1
            },
            chans: 2
        };
        var minSize = flock.minBufferSize(500, audioSettings);
        equals(minSize, 44100, 
            "The mininum buffer size for a 44100 KHz stereo signal with 500ms latency should be 44100");
            
        audioSettings.chans = 1;
        minSize = flock.minBufferSize(500, audioSettings);
        equals(minSize, 22050, 
            "The mininum buffer size for a 44100 KHz mono signal with 500ms latency should be 22050");
        
        audioSettings.rates.audio = 48000;
        audioSettings.chans = 2;
        minSize = flock.minBufferSize(250, audioSettings);
        equals(minSize, 24000, 
            "The mininum buffer size for a 48000 KHz stereo signal with 250ms latency should be 24000");
    });
    
    module("Synth tests");
    
    test("Get input values", function () {
        var synth = createSynth(simpleSynthDef);
        
        expect(5);
        
        // Getting simple values.
        equals(synth.input("sine.freq"), 440,
            "Getting 'sine.freq' should return the value set in the synthDef.");
        equals(synth.input("sine.freq"), 440,
            "Getting 'sine.freq' a second time should return the same value.");
        equals(synth.input("mod.freq"), 1.0,
            "Getting 'carrier.freq' should also return the initial value.");
        
        // Get a ugen.
        var ugen = synth.input("mod");
        ok(ugen.gen, "A ugen returned from synth.input() should have a gen() property...");
        equals(typeof (ugen.gen), "function", "...of type function");
    });
    
    test("Set input values", function () {
        var synth = createSynth(simpleSynthDef),
            sineUGen = synth.ugens.named.sine,
            modUGen = synth.ugens.named.mod;
        
        // Setting simple values.
        synth.input("sine.freq", 220);
        equals(synth.input("sine.freq"), 220,
            "Setting 'sine.freq' should update the input value accordingly.");
        equals(sineUGen.inputs.freq.model.value, 220,
            "And the underlying value ugen should also be updated.");
        synth.input("sine.freq", 110);
        equals(synth.input("sine.freq"), 110,
            "Setting 'sine.freq' a second time should also work.");
        equals(sineUGen.inputs.freq.model.value, 110,
            "And the underlying value ugen should also be updated.");
        synth.input("mod.freq", 2.0);
        equals(synth.input("mod.freq"), 2.0,
        "Setting 'mod.freq' should update the input value.");
        equals(modUGen.inputs.freq.model.value, 2.0,
            "And the underlying value ugen should also be updated.");
        equals(modUGen.inputs.freq.output[0], 2.0,
            "Even the ugen's output buffer should contain the new value.");
        
        // Set a ugen def.
        var testUGenDef = {
            ugen: "flock.ugen.dust",
            inputs: {
                density: 200
            }
        };
        var dust = synth.input("sine.mul", testUGenDef);
        equals(synth.ugens.named.sine.inputs.mul, dust,
            "The 'mul' ugen should be set to our test Dust ugen.");
        equals(synth.ugens.named.sine.inputs.mul.inputs.density.model.value, 200,
            "The ugen should be set up correctly.");
        
        // Set a named ugen directly.
        synth = createSynth(simpleSynthDef);
        synth.input("sine", {
            ugen: "flock.ugen.lfNoise",
            freq: 123
        });
        equals(synth.ugens.named.sine.inputs.freq.model.value, 123,
            "Directly setting a named unit generator should cause the previous ugen to be replaced.");
        ok(sineUGen !== synth.ugens.named.sine);
    });

    test("Set input values, onInputChanged event", function () {
        flock.tests = {};
        flock.tests.ugens = {};
        
        var didOnInputChangedFire = false;
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

    test("Get and set array input values", function () {
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
        
        var synth = flock.synth(def);
        var actual = synth.input("carrier.freq.sources.1"),
            expected = synth.ugens.named.adder.inputs.sources[1];
        equal(actual, expected, "Getting a ugen input within an array should return the correct ugen.");
        
        actual = synth.input("adder.sources.1.freq");
        expected = 880;
        equal(actual, expected,
            "Getting a value from a ugen within an array should return the correct value.");
            
        synth.input("adder.sources.1.freq", 889);
        expected = 889;
        actual = synth.ugens.named.adder.inputs.sources[1].inputs.freq.model.value;
        equal(actual, expected,
            "Setting a value on a ugen within an array should succeed.");
        
        synth.input("adder.sources.0", {
            ugen: "flock.ugen.lfNoise",
            freq: 456
        });
        equal(synth.ugens.named.adder.inputs.sources[0].inputs.freq.model.value, 456,
            "Setting a ugen within an array should succeed.");
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
        
        direct = synth.ugens.named.sine;
        
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
        equal(direct.inputs.mul.inputs.freq.model.value, 1.2);
        equal(direct.inputs.add.inputs.freq.model.value, 7.0);
        equal(direct.inputs.add.id, "add");
    };
    
    test("Set multiple input values", function () {
        testSetMultiple("set");
        testSetMultiple("input");
    });
    
    
    module("Parsing tests");
    
    var checkRegisteredUGens = function (synth, expectedNumEvals) {
        equals(flock.test.countKeys(synth.ugens.named), 3, "There should be three registered ugens.");
        ok(synth.out, 
            "The output ugen should have been stored at synth.out");
        equals(synth.ugens.active.length, expectedNumEvals, 
            "There should be " + expectedNumEvals + " real ugens in the 'active' list, including the output.");
    };
    
    var checkParsedTestSynthDef = function (synthDef, expectedNumEvalUGens) {
        var synth = flock.synth(synthDef),
            namedUGens = synth.ugens.named;
        
        checkRegisteredUGens(synth, expectedNumEvalUGens);
        ok(namedUGens.sine, "The sine ugen should be keyed by its id....");
        equals(0, namedUGens.sine.model.phase, "...and it should be a real osc ugen.");
        
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
            bus: 0
        }
    };
    
    test("flock.synth(), no output specified", function () {
        checkParsedTestSynthDef(condensedTestSynthDef, 2);
    });

    test("flock.synth(), output specified", function () {
        checkParsedTestSynthDef(expandedTestSynthDef, 2);
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
        
        var synth = flock.synth(multiChanTestSynthDef),
            namedUGens = synth.ugens.named;
        checkRegisteredUGens(synth, 3);
        ok(namedUGens.leftSine, "The left sine ugen should have been parsed correctly.");
        ok(namedUGens.rightSine, "The right sine ugen should have been parsed correctly.");
        deepEqual(synth.out.inputs.sources, 
            [namedUGens.leftSine, namedUGens.rightSine],
            "The output ugen should have an array of sources, containing the left and right sine ugens.");
    });
    
    test("flock.synth() with mix of compressed and expanded ugenDefs", function () {
        var mixedSynthDef = {
            id: "carrier",
            ugen: "flock.ugen.sinOsc",
            freq: {
                id: "mod",
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: 440,
                    phase: {
                        id: "line",
                        ugen: "flock.ugen.xLine",
                        start: 1,
                        end: 10,
                        duration: 2
                    }
                }
            }
        };
    
        var synth = flock.synth(mixedSynthDef),
            namedUGens = synth.ugens.named;
        equals(namedUGens.carrier.inputs.freq, namedUGens.mod, 
            "The modulator should have been set as the frequency input to the carrier.");
        equals(namedUGens.mod.inputs.freq.model.value, 440, 
            "The modulator's frequency should be 440.");
        equals(namedUGens.mod.inputs.phase, namedUGens.line,
            "The modulator's phase input should be set to the line ugen.");
        equals(namedUGens.line.inputs.end.model.value, 10, 
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
        equals(actual.inputs.freq.inputs.value, 299,
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
        equals(parsed.rate, flock.rates.CONTROL, 
            "A compressed control rate should be expanded to its full value.");
        equals(parsed.inputs.freq.rate, flock.rates.AUDIO, 
            "An already-expanded audio rate should not be mangled.");
        equals(parsed.inputs.mul.rate, flock.rates.AUDIO, 
            "A compressed audio rate should be expanded to its full value.");
        equals(parsed.inputs.add.rate, flock.rates.CONSTANT, 
            "A compressed constant rate should be expanded to its full value.");
    });
    
    test("flock.parse.ugenForDef options merging", function () {
        var sinOscDef = {
            ugen: "flock.ugen.sinOsc",
            phase: 1.0
        };
        
        var ugen = flock.parse.ugenForDef(sinOscDef);
        equals(ugen.rate, flock.rates.AUDIO, 
            "The rate option should be supplied by the ugen's defaults.");
        equals(ugen.inputs.freq.model.value, 440, 
            "The frequency input should be supplied by the ugen's defaults.");
        equals(ugen.inputs.phase.model.value, 1.0,
            "The ugen's default phase input should be overridden by the ugenDef.");
    });
    
    var testRemoval = function (synthDef, testSpecs) {
        var synth = flock.synth(synthDef);
        $.each(testSpecs, function (i, spec) {
            var toRemove = spec.ugenToRemove;
            if (toRemove) {
                toRemove = typeof (toRemove) === "string" ? flock.get(synth, toRemove) : toRemove;
                synth.ugens.remove(toRemove, true);
            }
            equals(synth.ugens.active.length, spec.expected.active, 
                spec.msg + ", there should be " + spec.expected.active + " active ugens.");
            equals(flock.test.countKeys(synth.ugens.named), spec.expected.named, 
                spec.msg + ", there should be " + spec.expected.named + " named ugens.");
        });
    };
    
    var nestedSynthDef = {
        ugen: "flock.ugen.out",
        inputs: {
            sources: {
                ugen: "flock.test.mockUGen",
                inputs: {
                    gerbil: {
                        id: "gerbil",
                        ugen: "flock.test.mockUGen",
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
                        ugen: "flock.test.mockUGen"
                    },
                    dog: {
                        ugen: "flock.test.mockUGen"
                    }
                }
            }
        }
    };
    
    test("flock.synth.ugenCache: removing ugens", function () {
        var removalTestSpecs = [
            {
                ugenToRemove: null,
                expected: {
                    active: 5,
                    named: 3
                },
                msg: "To start"
            },
            {
                ugenToRemove: "ugens.named.ear",
                expected: {
                    active: 5,
                    named: 2
                },
                msg: "After removing a passive, named ugen"
            },
            {
                ugenToRemove: "ugens.named.cat",
                expected: {
                    active: 4,
                    named: 1
                },
                msg: "After removing an active, named ugen"
            },
            {
                ugenToRemove: "out.inputs.sources.inputs.dog",
                expected: {
                    active: 3,
                    named: 1
                },
                msg: "After removing an active, unnamed ugen"
            },
            {
                ugenToRemove: "out",
                expected: {
                    active: 0,
                    named: 0
                },
                msg: "After removing a ugen with other inputs, its inputs should be recursively removed"
            }
        ];
        
        testRemoval(nestedSynthDef, removalTestSpecs);
    });
    
    test("flock.synth.ugenCache.replace(): reattach inputs", function () {
        var synth = flock.synth(nestedSynthDef);
        
        var toReplace = synth.ugens.named.gerbil,
            expectedInput = synth.ugens.named.ear,
            newUGen = flock.parse.ugenForDef({
                id: "gerbil",
                ugen: "flock.test.mockUGen"
            });
        synth.ugens.replace(newUGen, toReplace, true);
        
        equals(synth.ugens.named.gerbil, newUGen, 
            "The old ugen should have been replaced by the new one.");
        equals(synth.ugens.named.gerbil.inputs.ear, expectedInput, 
            "The old ugen's input should have been copied over to the new one.");
        equals(synth.out.inputs.sources.inputs.gerbil, newUGen, "The new ugen's output should be wired back up.");
    });
    
    
    module("Asynchronous Scheduler tests");
    
    var checkScheduledCallback = function (scheduledTime, sentAt, receivedAt) {
        equals(scheduledTime, 500,
            "The callback for once() should return the correct scheduled time.");
        ok(sentAt >= receivedAt - 3,
            "The callback should have been called at the scheduled time, within a tolerance of 3 ms.");
    };
    
    asyncTest("flock.scheduler.async.once()", function () {
        var sked = flock.scheduler.async(),
            runs = 10,
            numRuns = 0;
        
        expect(21);
        
        var scheduledAction = function (scheduledTime, now) {
            numRuns++;
            checkScheduledCallback(scheduledTime, now, Date.now());
            if (numRuns < runs) {
                sked.once(500, scheduledAction);
            } else {
                equals(numRuns, runs,
                    "The scheduled callback should be invoked only once.");
                start();
            }
        };
        sked.once(500, scheduledAction);
    });
    
    asyncTest("flock.scheduler.async.repeat()", function () {
        var sked = flock.scheduler.async(),
            interval = 500,
            numRuns = 10,
            runs = 0,
            lastFired = 0,
            callback;
            
        callback = function () {
            var now = Date.now(),
                time = now - lastFired;
            
            ok(time >= interval,
                "The scheduled callback should never be fired early.");
            ok(time <= interval + 3,
                "The scheduled callback should be fired within a tolerance of 3 ms.");
                
            lastFired = Date.now();
            
            if (runs === numRuns) {
                sked.clearRepeat(interval);
                start();
            }
            runs++;
        };
        
        sked.repeat(interval, callback);
        lastFired = Date.now();
        
    });
}());
