"use strict";

var flock = flock || {};

(function () {
    
    flock.rates = {
        AUDIO: "audio",
        CONSTANT: "constant"
    };
    
    flock.defaults = {
        sampleRate: 44100,
        bufferSize: 11025,
        rate: flock.rates.AUDIO
    };
    
    /*************
     * Utilities *
     *************/
    
    flock.constantBuffer = function (val, size) {
        var buf = new Float32Array(size);
        for (var i = 0; i < size; i++) {
            buf[i] = val;
        }
        return buf;
    };
    
    flock.mul = function (mulWire, output, numSamps) {
        var mul = mulWire.pull(numSamps);
        for (var i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i];
        }
        return output;
    };
    
    flock.add = function (addWire, output, numSamps) {
        var add = addWire.pull(numSamps);
        for (var i = 0; i < numSamps; i++) {
            output[i] = output[i] + add[i];
        }
        
        return output;
    };
    
    flock.mulAdd = function (mulWire, addWire, output, numSamps) {
        var mul = mulWire.pull(numSamps);
        var add = addWire.pull(numSamps);
        for (var i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i] + add[i];
        }
        return output;
    };
    
    flock.resolvePath = function (path, root) {
        var tokenized = path === "" ? [] : String(path).split(".");
        root = root || window;
        var valForSeg = root[tokenized[0]];
        
        for (var i = 1; i < tokenized.length; i++) {
            if (valForSeg === null || valForSeg === undefined) {
                throw new Error("Error parsing path: " + path + ". Segment '" + tokenized[i - 1] + 
                    "' could not be resolved.");
            }
            valForSeg = valForSeg[tokenized[i]];
        }
        return valForSeg;
    };
    
    flock.invokePath = function (path, args, root) {
        var fn = flock.resolvePath(path, root);
        if (typeof(fn) !== "function") {
            throw new Error("Path '" + path + "' does not resolve to a function.");
        }
        return fn.apply(null, args);
    };
    
    
    /*********
     * Wires *
     *********/
    
    flock.wire = function (source) {
        var that = {
            source: source
        };
        that.pull = that.source[that.source.rate];
        
        return that;
    };
    
    flock.constantWire = function (value, sampleRate) {
        var ugen = flock.ugen.value({value: value}, null, sampleRate);
        return flock.wire(ugen);
    };
    
    
    /*******************
     * Unit Generators *
     *******************/
    // TODO:
    //  - Add support for control-rate signals. This will require double buffering and calling pull() much more often.
    //     (i.e. calling pull() at the control rate)
    
    flock.ugen = function (inputs, output, sampleRate) {
        var that = {
            inputs: inputs,
            output: output,
            sampleRate: sampleRate || flock.defaults.sampleRate,
            rate: flock.rates.AUDIO,
            model: {}
        };
        
        return that;
    };
    
    flock.ugen.mulAdder = function (that) {
        // Reads directly from the output buffer, overwriting it in place with modified values.
        that.mulAdd = function (numSamps) {            
            // If we have no mul or add inputs, bail immediately.
            if (!that.inputs.mul && !that.inputs.add) {
                return that.output;
            }
            
            // Only add.
            if (!that.inputs.mul) {
                return flock.add(that.inputs.add, that.output, numSamps);
            }
            
            // Only mul.
            if (!that.inputs.add) {
                return flock.mul(that.inputs.mul, that.output, numSamps);
            }
            
            // Both mul and add.
            return flock.mulAdd(that.inputs.mul, that.inputs.add, that.output, numSamps);
        };
        
        return that;
    };
    
    flock.ugen.value = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        that.model.value = inputs.value;
        that.buffer = flock.constantBuffer(that.model.value, flock.defaults.bufferSize);
        
        that.audio = function (numSamps) {
            var len = that.sampleRate;
            if (numSamps < len) {
                return that.buffer.subarray(0, numSamps);
            } else if (numSamps === len) {
                return that.buffer;
            } else {
                that.buffer = new Float32Array(numSamps);
                return that.buffer;
            }
        };
        
        return that;
    };
    
    flock.ugen.sinOsc = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        flock.ugen.mulAdder(that);
        that.wavetable = flock.ugen.sinOsc.generateWavetable(that.sampleRate);
        that.model.phase = 0;
        
        // Scan the wavetable at the given frequency to generate the output.
        that.audio = function (numSamps) {
            var freq = that.inputs.freq.pull(numSamps);
            var tableLen = that.wavetable.length;
            for (var i = 0; i < numSamps; i++) {
                that.output[i] = that.wavetable[that.model.phase];
                var increment = freq[i] * tableLen / that.sampleRate;
                that.model.phase += increment;
                if (that.model.phase > tableLen) {
                    that.model.phase -= tableLen;
                }
            }
            return that.mulAdd(numSamps);
        };
        
        return that;
    };
    
    flock.ugen.sinOsc.generateWavetable = function (sampleRate) {
        var scale = (2.0 * Math.PI) / sampleRate;
        var wavetable = new Float32Array(sampleRate);
        for (var i = 0; i < sampleRate; i++) {
            wavetable[i] = Math.sin(i * scale);
        }
        return wavetable;
    };
    
    flock.ugen.out = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        that.audioEl = new Audio();
        that.audioEl.mozSetup(2, that.sampleRate);
        
        that.audio = function (numSamples) {
            var output = that.inputs.source.pull(numSamples);
            
            // Handle multiple channels, including stereo expansion of a single channel.
            var len = output.length,
                left, right;
            if (len === 2) {
                // Assume we've got a stereo pair of output buffers
                left = output[0];
                right = output[1];
                len = left.length;
                if (len !== right.length) {
                     throw new Error("Left and right output buffers must be the same length.");
                }
            } else {
                left = output;
                right = output; 
            }

            // Interleave each output channel into stereo frames.
            var stereo = new Float32Array(len * 2);
            for (var i = 0; i < len; i++) {
                var frameIdx = i * 2;
                stereo[frameIdx] = left[i];
                stereo[frameIdx + 1] = right[i];
            }
            
            that.audioEl.mozWriteAudio(stereo);
        };
        
        return that;
    };
    
    
    /**********
     * Synths *
     **********/

    flock.synth = function (graphDef, sampleRate, bufferSize) {
        var that = {
            sampleRate: sampleRate || flock.defaults.sampleRate,
            bufferSize: bufferSize || flock.defaults.bufferSize,
            graphDef: graphDef,
            playbackTimerId: null
        };        
        that.rootUGen = flock.parse.ugenForDef(that.graphDef, that.sampleRate, that.bufferSize);
        
        that.play = function (duration) {
            if (duration === undefined && duration === Infinity) {
                that.playbackTimerId = window.setInterval(function () {
                    that.rootUGen.audio(that.bufferSize);
                }, interval);
                return;
            }
            
            var writes = 0;
            var interval = 1000 / (that.sampleRate / that.bufferSize);
            var maxWrites = duration / interval;

            var audioWriter = function () {
                that.rootUGen.audio(that.bufferSize);                
                writes++;
                if (writes >= maxWrites) {
                    that.stop();
                }
            };
            that.playbackTimerId = window.setInterval(audioWriter, interval);
        };
        
        that.stop = function () {
            window.clearInterval(that.playbackTimerId);
        };
                
        return that;
    };
    
    flock.synth.vibratoSineGraph = function (carrierFreq, modFreq) {
        return {
            ugen: "flock.ugen.out",
            inputs: {
                source: {
                    ugen: "flock.ugen.sinOsc",
                    inputs: {
                        freq: carrierFreq,
                        mul: {
                            ugen: "flock.ugen.sinOsc",
                            inputs: {
                                freq: modFreq
                            }
                        }
                    }
                }
            }
        };
    };
    
    
    /**********
     * Parser *
     **********/
    flock.parse = flock.parse || {};
    
     // TODO: 
     //  - parse ugens into an id-keyed hash so that they can be accessed directly if needed
     //  - create "input tokens" in definition format to expose variables to a synth
    flock.parse.ugenForDef = function (ugenDef, sampleRate, bufferSize) {
        var inputDefs = ugenDef.inputs;
        var inWires = {};
        for (var inputDef in inputDefs) {
            // Wire all inputs except value inputs.
            inWires[inputDef] = inputDef === "value" ? ugenDef.inputs[inputDef] :
                flock.parse.wireForInputDef(ugenDef.inputs[inputDef], sampleRate, bufferSize);
        }
        
        if (!ugenDef.ugen) {
            throw new Error("Unit generator definition lacks a 'ugen' property; can't initialize the synth graph.");
        }
        
        return flock.invokePath(ugenDef.ugen, [inWires, new Float32Array(bufferSize), sampleRate]);
    };
    
    flock.parse.expandInputDef = function (inputDef) {
        switch (typeof (inputDef)) {
            case "number":
                return {
                    ugen: "flock.ugen.value",
                    inputs: {
                        value: inputDef
                    }
                };
            case "object":
                return inputDef;
            default:
                throw new Error("Invalid value type found in ugen definition.");
        }
    };
    
    flock.parse.wireForInputDef = function (inputDef, sampleRate, bufferSize) {    
        inputDef = flock.parse.expandInputDef(inputDef);
        var ugen = flock.parse.ugenForDef(inputDef, sampleRate, bufferSize);
        return flock.wire(ugen, sampleRate, bufferSize);
    };

})();
