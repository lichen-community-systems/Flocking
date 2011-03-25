var flock = flock || {};

(function () {
    flock.tests = function () {
        var simpleGraph = {
            ugen: "flock.ugen.out",
            inputs: {
                source: {
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
                }
            }
        };
        
        var createSynth = function (graph) {
            return flock.synth(graph || simpleGraph, 1, 1);
        };
        
        var countKeys = function (obj) {
            var numKeys = 0,
                key;
            for (key in obj) {
                numKeys++;
            }
            return numKeys;
        };
        
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
        
        
        module("Synth tests");
        
        test("Get input values", function () {
            var synth = createSynth();
            
            expect(5);
            
            // Getting simple values.
            equals(synth.input("sine.freq"), 440, "Getting 'sine.freq' should return the value set in the synth graph.");
            equals(synth.input("sine.freq"), 440, "Getting 'sine.freq' a second time should return the same value.");
            equals(synth.input("mod.freq"), 1.0, "Getting 'carrier.freq' should also return the initial value.");
            
            // Get a ugen.
            var ugen = synth.input("mod");
            ok(ugen.audio, "A ugen returned from synth.input() should have an audio property...");
            equals(typeof(ugen.audio), "function", "...of type function");
        });
        
        test("Set input values", function () {
            var synth = createSynth(),
                sineUGen = synth.ugens.sine,
                modUGen = synth.ugens.mod;
            
            // Setting simple values.
            synth.input("sine.freq", 220);
            equals(synth.input("sine.freq"), 220, "Setting 'sine.freq' should update the input value accordingly.");
            equals(sineUGen.inputs.freq.source.model.value, 220, "And the underlying value ugen should also be updated.");
            synth.input("sine.freq", 110);
            equals(synth.input("sine.freq"), 110, "Setting 'sine.freq' a second time should also work.");
            equals(sineUGen.inputs.freq.source.model.value, 110, "And the underlying value ugen should also be updated.");
            synth.input("mod.freq", 2.0);
            equals(synth.input("mod.freq"), 2.0, "Setting 'mod.freq' should update the input value.");
            equals(modUGen.inputs.freq.source.model.value, 2.0, "And the underlying value ugen should also be updated.");
            equals(modUGen.inputs.freq.source.buffer[0], 2.0, "Even the ugen's buffer should contain the new value.");
            
            // TODO: Set a ugen.
            var testUGen = flock.ugen.value({value: 8.0}, null, 1);
            var wire = synth.input("sine.mul", testUGen);
            equals(synth.ugens.sine.inputs.mul.source, testUGen, "The 'sine' ugen should be set to our test ugen.");
            equals(wire.source, testUGen, "The wire returned from setting a ugen should have the correct source.");
        });


        module("Parsing tests");
        
        test("flock.parse.graph()", function () {
            var testGraph = {
                ugen: "flock.ugen.out",
                inputs: {
                    source: {
                        id: "sine",
                        ugen: "flock.ugen.sinOsc",
                        inputs: {
                            freq: 440,
                            mul: {
                                id: "mul",
                                ugen: "flock.ugen.value",
                                inputs: {
                                    value: 1.0
                                }
                            }
                        }
                    }
                }
            };
            var parsedUGens = flock.parse.graph(testGraph, 1, 1);
                      
            equals(countKeys(parsedUGens), 3, "There should be three named ugens.");            
            ok(parsedUGens[flock.OUT_UGEN_ID], "The output ugen should be at the reserved key flock.OUT_UGEN_ID...");
            ok(parsedUGens[flock.OUT_UGEN_ID].audioEl, "... and it should be a real output ugen.");
            
            ok(parsedUGens.sine, "The sine ugen should be keyed by its id....");
            ok(parsedUGens.sine.wavetable, "...and it should be a real sine ugen.");
            
            ok(parsedUGens.mul, "The mul ugen should be keyed by its id...");
            ok(parsedUGens.mul.model.value, "...and it should be a real value ugen.");
        });


        module("UGen tests");

        test("flock.ugen.dust", function () {
            var dust = flock.ugen.dust({
                density: flock.wire(1.0, 44100)
            }, new Float32Array(44100), 44100);
            
            var buffer = dust.audio(44100);
            ok(buffer, "A buffer should be returned from dust.audio()");
            equals(buffer.length, 44100, "And it should be the specified length.");
            checkSampleBoundary(buffer, 0.0, 1.0);
            var nonZero = countNonZeroSamples(buffer);
            ok(nonZero < 3 && nonZero > 0, 
                "There should be roughly two non-zero samples in a one-second buffer when run with a density of 2.0");
        });
    };
})();