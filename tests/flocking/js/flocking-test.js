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
        equals(synth.input("sine.freq"), 440, "Getting 'sine.freq' should return the value set in the synthDef.");
        equals(synth.input("sine.freq"), 440, "Getting 'sine.freq' a second time should return the same value.");
        equals(synth.input("mod.freq"), 1.0, "Getting 'carrier.freq' should also return the initial value.");
        
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
        equals(synth.input("sine.freq"), 220, "Setting 'sine.freq' should update the input value accordingly.");
        equals(sineUGen.inputs.freq.model.value, 220, "And the underlying value ugen should also be updated.");
        synth.input("sine.freq", 110);
        equals(synth.input("sine.freq"), 110, "Setting 'sine.freq' a second time should also work.");
        equals(sineUGen.inputs.freq.model.value, 110, "And the underlying value ugen should also be updated.");
        synth.input("mod.freq", 2.0);
        equals(synth.input("mod.freq"), 2.0, "Setting 'mod.freq' should update the input value.");
        equals(modUGen.inputs.freq.model.value, 2.0, "And the underlying value ugen should also be updated.");
        equals(modUGen.inputs.freq.output[0], 2.0, "Even the ugen's output buffer should contain the new value.");
        
        // Set a ugen def.
        var testUGenDef = {
            ugen: "flock.ugen.dust",
            inputs: {
                density: 200
            }
        };
        var dust = synth.input("sine.mul", testUGenDef);
        equals(synth.ugens.named.sine.inputs.mul, dust, "The 'mul' ugen should be set to our test Dust ugen.");
        equals(synth.ugens.named.sine.inputs.mul.inputs.density.model. value, 200, 
            "The ugen should be set up correctly.");
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
                toRemove = typeof (toRemove) === "string" ? flock.get(toRemove, synth) : toRemove;
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
    })
}());
