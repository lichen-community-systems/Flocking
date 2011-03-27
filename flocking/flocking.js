/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global Float32Array, Audio, window*/

var flock = flock || {};

(function () {
    "use strict";
    
    flock.OUT_UGEN_ID = "flocking-out";
    
    flock.rates = {
        AUDIO: "audio",
        CONTROL: "control"
    };
    
    flock.defaults = {
        sampleRate: 44100,
        controlRate: 64,
        bufferSize: 44100,
        minLatency: 250,
        writeInterval: 100
    };
    
    /*************
     * Utilities *
     *************/
    
    flock.minBufferSize = function (sampleRate, chans, latency) {
        return (sampleRate * chans) / (1000 / latency);
    };
     
    flock.constantBuffer = function (val, size) {
        var buf = new Float32Array(size);
        for (var i = 0; i < size; i++) {
            buf[i] = val;
        }
        return buf;
    };
    
    flock.mul = function (mulInput, output, numSamps) {
        var mul = mulInput.gen(numSamps);
        for (var i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i];
        }
        return output;
    };
    
    flock.add = function (addInput, output, numSamps) {
        var add = addInput.gen(numSamps);
        for (var i = 0; i < numSamps; i++) {
            output[i] = output[i] + add[i];
        }
        
        return output;
    };
    
    flock.mulAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.gen(numSamps);
        var add = addInput.gen(numSamps);
        for (var i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i] + add[i];
        }
        return output;
    };
    
    flock.pathParseError = function (path, token) {
        throw new Error("Error parsing path: " + path + ". Segment '" + token + 
            "' could not be resolved.");
    };
    
    flock.resolvePath = function (path, root) {
        var tokenized = path === "" ? [] : String(path).split(".");
        root = root || window;
        var valForSeg = root[tokenized[0]];
        
        for (var i = 1; i < tokenized.length; i++) {
            if (valForSeg === null || valForSeg === undefined) {
                flock.pathParseError(path, tokenized[i - 1]);
            }
            valForSeg = valForSeg[tokenized[i]];
        }
        return valForSeg;
    };
    
    flock.invokePath = function (path, args, root) {
        var fn = flock.resolvePath(path, root);
        if (typeof (fn) !== "function") {
            throw new Error("Path '" + path + "' does not resolve to a function.");
        }
        return fn.apply(null, args);
    };
    
    
    /*******************
     * Unit Generators *
     *******************/
    
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
    
    // TODO: Need to refactor or provide a convenience creator for flock.ugen.value().
    flock.ugen.value = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        that.rate = flock.rates.CONTROL;
        that.model.value = inputs.value;
        that.buffer = flock.constantBuffer(that.model.value, that.sampleRate);
        
        that.control = function (numSamps) {
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
        
        that.gen = that.control;
        
        return that;
    };
    
    // TODO: This algorithm aliases and distorts with non-integer frequency values.
    flock.ugen.sinOsc = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        flock.ugen.mulAdder(that);
        that.wavetable = flock.ugen.sinOsc.generateWavetable(that.sampleRate);
        that.model.phase = 0;
        
        // Scan the wavetable at the given frequency to generate the output.
        that.audio = function (numSamps) {
            // Cache instance variables locally so we don't pay the cost of property lookup
            // within the sample generation loop.
            var freq = that.inputs.freq.gen(numSamps),
                tableLen = that.wavetable.length,
                output = that.output,
                wavetable = that.wavetable,
                phase = that.model.phase,
                sampleRate = that.sampleRate;

            for (var i = 0; i < numSamps; i++) {
                output[i] = wavetable[phase];
                var increment = freq[i] * tableLen / sampleRate;
                phase += increment;
                if (phase > tableLen) {
                    phase -= tableLen;
                }
                that.model.phase = phase;
            }
            
            return that.mulAdd(numSamps);
        };
        
        that.gen = that.audio;
        
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
    
    flock.ugen.dust = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        flock.ugen.mulAdder(that);
        that.model = {
            density: 0.0,
            scale: 0.0,
            threshold: 0.0,
            sampleDur: 1.0 / that.sampleRate
        };
        
        that.audio = function (numSamps) {
            var density = inputs.density.gen(numSamps)[0], // Assume density is control rate.
                threshold, 
                scale;
                
            if (density !== that.model.density) {
                that.model.density = density;
                threshold = that.model.threshold = density * that.model.sampleDur;
                scale = that.model.scale = threshold > 0.0 ? 1.0 / threshold : 0.0;
            } else {
                threshold = that.model.threshold;
                scale = that.model.scale;
            }
            
            for (var i = 0; i < numSamps; i++) {
                var rand = Math.random();
                output[i] = (rand < threshold) ? rand * scale : 0.0;
            }
            
            return that.mulAdd(numSamps);
        };
        
        that.gen = that.audio;
        
        return that;
    };
    
    flock.ugen.out = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        
        // Simple pass-through output.
        that.gen = function (numSamps) {
            return that.inputs.source.gen(numSamps);
        };
        
        return that;
    };
    
    flock.ugen.stereoOut = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        
        that.audio = function (numFrames, offset) {
            var sourceBuf = that.inputs.source.gen(numFrames);
            var output = that.output;
            
            // Handle multiple channels, including stereo expansion of a single channel.
            var left, right;
            if (sourceBuf.length === 2) {
                // Assume we've got a stereo pair of output buffers
                left = sourceBuf[0];
                right = sourceBuf[1];
            } else {
                left = sourceBuf;
                right = sourceBuf; 
            }

            // Interleave each output channel into stereo frames.
            offset = offset || 0;
            for (var i = 0; i < numFrames; i++) {
                var frameIdx = i * 2 + offset;
                output[frameIdx] = left[i];
                output[frameIdx + 1] = right[i];
            }
            
            return output;
        };
        
        that.gen = that.audio;
        
        return that;
    };
    
    
    /**********
     * Synths *
     **********/
    
    // TODO: Deal with argument list.
    var writeAudio = function (outUGen, audioEl, preBufferSize, chans, playState, writerFn) {
        var needed = audioEl.mozCurrentSampleOffset() + preBufferSize - playState.written;
        if (needed < 0) {
            return; // Don't write if no more samples are needed.
        }
        
        var outBuf = writerFn(outUGen, chans, needed);
        playState.written += audioEl.mozWriteAudio(outBuf);
    };
    
    var controlRateWriter = function (outUGen, chans, needed) {
        // Figure out how many control periods worth of samples to generate.
        // This means that we'll be writing slightly more or less than needed.
        var kr = flock.defaults.controlRate;
        var numBufs = Math.round(needed / kr);
        // We're assuming that the output buffer is always going to be large enough to accommodate 'needed'.
        var outBufSize = numBufs * kr * chans;
        var outBuf;
        for (var i = 0; i < numBufs; i++) {
            outBuf = outUGen.audio(kr, i * kr * chans);
        }
        return outBuf.subarray(0, outBufSize);
    };
    
    // Deprecated and used only for testing.
    var onDemandWriter = function (outUGen, chans, needed) {
        // We're assuming that the output buffer is always going to be large enough to accommodate 'needed'.
        return outUGen.audio(needed).subarray(0, needed * chans);
    };
    
    flock.synth = function (graphDef, options) {
        // TODO: Consolidate options and model.
        options = options || {};
        var that = {
            audioEl: new Audio(),
            sampleRate: options.sampleRate || flock.defaults.sampleRate,
            chans: 2, // TODO: Hardbaked to stereo. Add support for more and less channels.
            bufferSize: options.bufferSize || flock.defaults.bufferSize,
            writeInterval: options.writeInterval || flock.defaults.writeInterval,
            playbackTimerId: null,
            playState: {
                written: 0,
                total: null
            },
            model: graphDef
        };
        that.preBufferSize = flock.minBufferSize(that.sampleRate, that.chans, flock.defaults.minLatency);
        that.ugens = flock.parse.graph(that.model, that.sampleRate, that.bufferSize, that.chans);
        that.out = that.ugens[flock.OUT_UGEN_ID];
        that.audioEl.mozSetup(that.chans, that.sampleRate);
        
        that.play = function (duration) {
            that.playState.total = (duration === undefined) ? Infinity : 
                duration * (that.sampleRate * that.numChans);

            that.playbackTimerId = window.setInterval(function () {
                writeAudio(that.out, that.audioEl, that.preBufferSize, that.chans, that.playState, controlRateWriter);
                if (that.playState.written >= that.playState.total) {
                    that.stop();
                }
            }, that.writeInterval);
        };
        
        that.stop = function () {
            window.clearInterval(that.playbackTimerId);
        };
    
        // TODO:
        //  - Awkward stuff! All this really does is shield the user from the presences of the "inputs" property
        //      of a unit generator, and only up to two path segments.
        //  - Replace with a proxy?
        that.input = function (path, val) {
            // TODO: Hard-coded to two-segment paths.
            var tokenized = path.split("."),
                ugenId = tokenized[0],
                input = tokenized[1];
                
            var ugen = that.ugens[ugenId];
            if (!ugen) {
                flock.pathParseError(path, ugenId);
            }

            // Get.
            if (arguments.length < 2) {
                if (!input) {
                    return ugen;
                }
                
                if (!ugen.inputs[input]) {
                    flock.pathParseError(path, input);
                }
                var inputSource = ugen.inputs[input];
                return inputSource.model.value !== undefined ? inputSource.model.value : inputSource;
            }
                
            // Set.
            if (!input) {
                throw new Error("Setting a ugen directly is not currently supported.");
            }
            return ugen.inputs[input] = typeof (val) === "number" ? 
                flock.ugen.value({value: val}, new Float32Array(that.bufferSize), that.sampleRate) :
                val;
        };
              
        return that;
    };
    

    
    /**********
     * Parser *
     **********/
    // TODO:
    //  - Remove the need to specify the output ugen
    //  - Support multiple channels.
    
    flock.parse = flock.parse || {};
    
    flock.parse.graph = function (ugenDef, sampleRate, bufferSize, chans) {
        var ugens = {};
        var root = flock.parse.ugenForDef(ugenDef, sampleRate, bufferSize, ugens);
        if (ugenDef.id !== flock.OUT_UGEN_ID) {
            // User didn't give us an out ugen, so we need to create one automatically.
            var outType = (chans === 2) ? "flock.ugen.stereoOut" : "flock.ugen.out";
            var out = flock.parse.ugenForDef({
                id: flock.OUT_UGEN_ID,
                ugen: outType
            }, sampleRate, bufferSize, ugens);
            out.inputs.source = root;
        }        
        return ugens;
    };
    
    flock.parse.ugenForDef = function (ugenDef, sampleRate, bufferSize, ugens) {
        var inputDefs = ugenDef.inputs;
        var inputs = {};
        for (var inputDef in inputDefs) {
            // Create ugens for all inputs except value inputs.
            inputs[inputDef] = inputDef === "value" ? ugenDef.inputs[inputDef] :
                flock.parse.ugenForInputDef(ugenDef.inputs[inputDef], sampleRate, bufferSize, ugens);
        }
        
        if (!ugenDef.ugen) {
            throw new Error("Unit generator definition lacks a 'ugen' property; can't initialize the synth graph.");
        }
        
        var ugen = flock.invokePath(ugenDef.ugen, [inputs, new Float32Array(bufferSize), sampleRate]);
        if (ugenDef.id) {
            ugens[ugenDef.id] = ugen;
        }
        return ugen;
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
    
    flock.parse.ugenForInputDef = function (inputDef, sampleRate, bufferSize, ugens) {    
        inputDef = flock.parse.expandInputDef(inputDef);
        return flock.parse.ugenForDef(inputDef, sampleRate, bufferSize, ugens);
    };

})();
