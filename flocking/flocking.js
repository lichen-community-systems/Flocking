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
    flock.TWOPI = 2.0 * Math.PI;
    
    flock.rates = {
        AUDIO: "audio",
        CONTROL: "control"
    };
    
    flock.defaults = {
        tableSize: 8192,
        sampleRate: 44100,
        controlRate: 64,
        bufferSize: 44100,
        minLatency: 125,
        writeInterval: 50
    };
    
    
    /*************
     * Utilities *
     *************/
    
    flock.minBufferSize = function (sampleRate, chans, latency) {
        return (sampleRate * chans) / (1000 / latency);
    };
     
    flock.fillBuffer = function (buf, val) {
        var len = buf.length,
            i;
        for (i = 0; i < len; i++) {
            buf[i] = val;
        }
        return buf;
    };
    
    flock.constantBuffer = function (val, size) {
        var buf = new Float32Array(size);
        return flock.fillBuffer(buf);
    };
    
    flock.mul = function (mulInput, output, numSamps) {
        var mul = mulInput.gen(numSamps),
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i];
        }
        return output;
    };
    
    flock.add = function (addInput, output, numSamps) {
        var add = addInput.gen(numSamps),
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] + add[i];
        }
        
        return output;
    };
    
    flock.mulAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.gen(numSamps),
            add = addInput.gen(numSamps),
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i] + add[i];
        }
        return output;
    };
    
    flock.pathParseError = function (path, token) {
        throw new Error("Error parsing path: " + path + ". Segment '" + token + 
            "' could not be resolved.");
    };
    
    flock.resolvePath = function (path, root) {
        root = root || window;
        var tokenized = path === "" ? [] : String(path).split("."),
            valForSeg = root[tokenized[0]],
            i;
        
        for (i = 1; i < tokenized.length; i++) {
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
    
    flock.ugen.value = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        that.rate = flock.rates.CONTROL;
        that.model.value = inputs.value;
        flock.fillBuffer(that.output, that.model.value);
        
        that.control = function (numSamps) {
            var len = that.sampleRate;
            return numSamps === len ? that.output : 
                numSamps < len ? that.output.subarray(0, numSamps) : flock.constantBuffer(numSamps);
        };
        
        that.gen = that.control;
        
        return that;
    };
    
    // TODO: Add support for a phase input.
    flock.ugen.oscN = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        flock.ugen.mulAdder(that);
        that.model.phase = 0;
        
        // Scan the wavetable at the given frequency to generate the output.
        that.audio = function (numSamps) {
            // Cache instance variables locally so we don't pay the cost of property lookup
            // within the sample generation loop.
            var freq = that.inputs.freq.gen(numSamps),
                table = that.inputs.table,
                tableLen = table.length,
                output = that.output,
                phase = that.model.phase,
                sampleRate = that.sampleRate,
                increment,
                i;

            for (i = 0; i < numSamps; i++) {
                output[i] = table[Math.round(phase)];
                increment = freq[i] * tableLen / sampleRate;
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
    
    flock.ugen.sinOsc = function (inputs, output, sampleRate) {
        var that = flock.ugen.oscN(inputs, output, sampleRate);
        that.inputs.table = flock.ugen.sinOsc.fillTable(flock.defaults.tableSize);
        return that;
    };
    
    flock.ugen.sinOsc.fillTable = function (size) {
        var table = new Float32Array(size),
            scale = flock.TWOPI / size,
            i;
            
        for (i = 0; i < size; i++) {
            table[i] = Math.sin(i * scale);
        }
        
        return table;
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
            var density = inputs.density.gen(1)[0], // Assume density is control rate.
                threshold, 
                scale,
                i;
                
            if (density !== that.model.density) {
                that.model.density = density;
                threshold = that.model.threshold = density * that.model.sampleDur;
                scale = that.model.scale = threshold > 0.0 ? 1.0 / threshold : 0.0;
            } else {
                threshold = that.model.threshold;
                scale = that.model.scale;
            }
            
            for (i = 0; i < numSamps; i++) {
                var rand = Math.random();
                output[i] = (rand < threshold) ? rand * scale : 0.0;
            }
            
            return that.mulAdd(numSamps);
        };
        
        that.gen = that.audio;
        
        return that;
    };
    
    flock.ugen.lfNoise = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        flock.ugen.mulAdder(that);
        
        that.model.counter = 0;
        that.model.level = 0;
        
        that.audio = function (numSamps) {
            var freq = inputs.freq.gen(1)[0], // Freq is kr.
                remain = numSamps,
                out = that.output,
                counter = that.model.counter,
                level = that.model.level,
                currSamp = 0,
                nsmps,
                i;
                
            freq = freq > 0.001 ? freq : 0.001;
            // TODO: Rewrite this algorithm.
            do {
                if (counter <= 0) {
                    counter = that.sampleRate / freq;
                    counter = counter > 1 ? counter : 1;
                    level = Math.random();
                }
                nsmps = remain < counter ? remain : counter;
                remain -= nsmps;
                counter -= nsmps;
                for (i = 0; i < nsmps; i++) {
                    output[currSamp] = level;
                    currSamp++;
                }

            } while (remain);
            that.counter = counter;
            that.level = level;
            
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
            var source = that.inputs.source,
                output = that.output,
                left, 
                right,
                i,
                frameIdx;
            
            // Handle multiple channels, including stereo expansion of a single channel.
            // TODO: Do this less often, introducing some kind of "input changed" event for ugens.
            if (typeof (source.length) === "number") {
                left = source[0].gen(numFrames);
                right = source[1].gen(numFrames);
            } else {
                left = source.gen(numFrames);
                right = left;
            }
            // Interleave each output channel into stereo frames.
            offset = offset || 0;
            for (i = 0; i < numFrames; i++) {
                frameIdx = i * 2 + offset;
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
        var kr = flock.defaults.controlRate,
            numBufs = Math.round(needed / kr),
            // Assume the output buffer is going to be large enough to accommodate 'needed'.
            outBufSize = numBufs * kr * chans,
            outBuf,
            i;
        for (i = 0; i < numBufs; i++) {
            outBuf = outUGen.audio(kr, i * kr * chans);
        }
        return outBuf.subarray(0, outBufSize);
    };
    
    var setupOutput = function (that) {
        that.out = that.ugens[flock.OUT_UGEN_ID];
        that.out.output = new Float32Array(that.bufferSize);
        that.audioEl.mozSetup(that.chans, that.sampleRate);
    };
    
    flock.synth = function (def, options) {
        // TODO: Consolidate options and model.
        options = options || {};
        var that = {
            audioEl: new Audio(),
            sampleRate: options.sampleRate || flock.defaults.sampleRate,
            chans: options.chans || 2,
            bufferSize: options.bufferSize || flock.defaults.bufferSize,
            writeInterval: options.writeInterval || flock.defaults.writeInterval,
            playbackTimerId: null,
            playState: {
                written: 0,
                total: null
            },
            model: def
        };
        that.preBufferSize = flock.minBufferSize(that.sampleRate, that.chans, flock.defaults.minLatency);
        that.ugens = flock.parse.synthDef(that.model, that.sampleRate, that.bufferSize, that.chans);

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
    
        that.getUGenPath = function (path) {
            var input = flock.resolvePath(path, that.ugens);
            return typeof (input.model.value) !== "undefined" ? input.model.value : input;
        };
        
        that.setUGenPath = function (path, val) {
            if (path.indexOf(".") === -1) {
                throw new Error("Setting a ugen directly is not currently supported.");
            }
            var lastSegIdx = path.lastIndexOf(".");
            var ugenPath = path.substring(0, lastSegIdx);
            var inputName = path.substring(lastSegIdx + 1);
            var inputs = flock.resolvePath(ugenPath, that.ugens);
            var inputUGen = flock.parse.ugenForInputDef(val);
            inputs[inputName] = inputUGen;
            return inputUGen;
        };
        
        // TODO: Naming?
        that.input = function (path, val) {
            if (!path) {
                return;
            }
            var expanded = path.replace(".", ".inputs.");
            return arguments.length < 2 ? that.getUGenPath(expanded) : that.setUGenPath(expanded, val);
        };
        
        setupOutput(that);
        return that;
    };
    
    
    /**********
     * Parser *
     **********/
    
    flock.parse = flock.parse || {};
    
    flock.parse.synthDef = function (ugenDef, sampleRate, bufferSize, chans) {
        var ugens = {},
            source,
            i;
        
        if (typeof (ugenDef.length) === "number") {
            // We've got multiple channels of output.
            source = [];
            for (i = 0; i < ugenDef.length; i++) {
                source[i] = flock.parse.ugenForDef(ugenDef[i], sampleRate, bufferSize, ugens);
            }
        } else {
            // Only one output source.
            source = flock.parse.ugenForDef(ugenDef, sampleRate, bufferSize, ugens);
            if (ugenDef.id === flock.OUT_UGEN_ID) {
                return ugens;
            }
        }
                
        // User didn't give us an out ugen, so we need to create one automatically.
        var outType = (chans === 2) ? "flock.ugen.stereoOut" : "flock.ugen.out";
        var out = flock.parse.ugenForDef({
            id: flock.OUT_UGEN_ID,
            ugen: outType
        }, sampleRate, bufferSize, ugens);
        out.inputs.source = source;
        
        return ugens;
    };
    
    flock.parse.ugenForDef = function (ugenDef, sampleRate, bufferSize, ugens) {
        var inputDefs = ugenDef.inputs,
            inputs = {},
            inputDef;
            
        for (inputDef in inputDefs) {
            // Create ugens for all inputs except value inputs.
            inputs[inputDef] = inputDef === "value" ? ugenDef.inputs[inputDef] :
                flock.parse.ugenForInputDef(ugenDef.inputs[inputDef], sampleRate, bufferSize, ugens);
        }
        
        if (!ugenDef.ugen) {
            throw new Error("Unit generator definition lacks a 'ugen' property; can't initialize the synth graph.");
        }
        
        var ugen = flock.invokePath(ugenDef.ugen, [inputs, new Float32Array(flock.defaults.controlRate), sampleRate]);
        if (ugenDef.id) {
            ugens[ugenDef.id] = ugen;
        }
        return ugen;
    };
    
    flock.parse.expandInputDef = function (inputDef) {
        var type = typeof (inputDef);
        if (type === "number") {
            return {
                ugen: "flock.ugen.value",
                inputs: {
                    value: inputDef
                }
            };
        } 
        
        if (type === "object") {
            return inputDef;
        }
        
        throw new Error("Invalid value type found in ugen definition.");
    };
    
    flock.parse.ugenForInputDef = function (inputDef, sampleRate, bufferSize, ugens) {    
        inputDef = flock.parse.expandInputDef(inputDef);
        return flock.parse.ugenForDef(inputDef, sampleRate, bufferSize, ugens);
    };

}());
