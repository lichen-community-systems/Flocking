"use strict";

var flock = flock || {};

(function () {
    flock.rates = {
        AUDIO: "audio",
        CONSTANT: "constant"
    };
    
    flock.defaults = {
        sampleRate: 44100,
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
    
    /*******************
     * Unit Generators *
     *******************/
     
    flock.wire = function (source) {
        var that = {
            source: source,
            rate: flock.defaults.rate // We only support audio rate currently.
        };
        
        that.pull = function (numSamps) {
            return that.source[that.rate].apply(null, [numSamps]);
        };
        
        return that;
    };
    
    flock.constantWire = function (val) {
        var that = {
            source: val,
            rate: flock.rates.CONSTANT,
            buffer: flock.constantBuffer(val, flock.defaults.sampleRate)
        };
        
        that.pull = function (numSamps) {
            return that.buffer.subarray(0, numSamps); // TODO: What if numSamps is larger than our buffer?
        };
        
        return that;
    };
    
    
    flock.mulAdd = function (inputs, output, numSamps) {
        // Reads directly from the output buffer, overwriting it in place with modified values.
        var mul = inputs.mul.pull(numSamps);
        var add = inputs.add.pull(numSamps);
        for (var i = 0; i < numSamps; i++) {
            output[i] = output[i] * inputs.mul[i] + inputs.add[i];
        }
        return output;
    };
    
    flock.ugen = function (inputs, output, sampleRate) {
        var that = {
            inputs: inputs,
            output: output,
            sampleRate: sampleRate || flock.defaults.sampleRate,
            model: {}
        };
        
        return that;
    };
     
    flock.ugen.sinOsc = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
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
            return flock.mulAdd(inputs, output, numSamps);
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
            
            // Handle multiple channels.
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
            graphDef: graphDef,
            playbackTimerId: null
        };        
        that.bufferSize = bufferSize || that.sampleRate / 2;
        that.rootUGen = flock.parseUGenDef(that.graphDef, that.sampleRate, that.bufferSize);
        
        that.play = function (duration) {
            var writes = 0;
            var interval = 1000 / (that.sampleRate / that.bufferSize);
            var maxWrites = duration / interval;

            var audioWriter = function () {
                console.log(new Date());
                that.rootUGen.audio(that.bufferSize);
                
                if (duration !== undefined && duration !== Infinity) {
                    writes++;
                    if (writes >= maxWrites) {
                        that.stop();
                    }
                }
            };
            that.playbackTimerId = window.setInterval(audioWriter, interval);
        };
        
        that.stop = function () {
            window.clearInterval(that.playbackTimerId);
        };
                
        return that;
    };
    
    flock.parseUGenDef = function (ugenDef, sampleRate, bufferSize) {
        var inputDefs = ugenDef.inputs;
        var inWires = {};
        for (var inputDef in inputDefs) {
            inWires[inputDef] = flock.parseUGenDef.wireForInputDef(ugenDef.inputs[inputDef], sampleRate, bufferSize);
        }
        
        if (!ugenDef.ugen) {
            throw new Error("Unit generator definition lacks a 'ugen' property; can't initialize the synth graph.");
        }
        
        // Ensure all ugens have mul and add wires, even if they weren't specified.
        // TODO: Rework this requirement.
        inWires.add = inWires.add || flock.constantWire(0.0);
        inWires.mul = inWires.mul || flock.constantWire(1.0);
        return flock.invokePath(ugenDef.ugen, [inWires, new Float32Array(bufferSize), sampleRate]);
    };
    
    flock.parseUGenDef.inputDefWiringMap = {
        "number": flock.constantWire,
        "object": function () {
            return flock.wire(flock.parseUGenDef.apply(null, arguments));
        }
    };
    
    flock.parseUGenDef.wireForInputDef = function (val, sampleRate, bufferSize) {    
        var wireFn = flock.parseUGenDef.inputDefWiringMap[typeof(val)];
        if (!wireFn) {
            throw new Error("Invalid value type found in ugen definition.");
        }
        return wireFn(val, sampleRate, bufferSize);
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

})();
