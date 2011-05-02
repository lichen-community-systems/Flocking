/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global Float32Array, Audio, window*/
/*jslint white: true, funcinvoke: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, forvar: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";
      
    flock.OUT_UGEN_ID = "flocking-out";
    flock.TWOPI = 2.0 * Math.PI;
    
    flock.rates = {
        AUDIO: "audio",
        CONTROL: "control",
        CONSTANT: "constant"
    };
    
    flock.defaults = {
        rates: {
            audio: 44100,
            control: 64,
            constant: 1
        },        
        tableSize: 8192,
        minLatency: 125,
        writeInterval: 50
    };
        
    
    /*************
     * Utilities *
     *************/
    
    flock.minBufferSize = function (latency, audioSettings) {
        var size = (audioSettings.rates.audio * audioSettings.chans) / (1000 / latency);
        return Math.round(size);
    };
    
    flock.krMul = function (mulInput, output, numSamps) {
        var mul = mulInput.gen(1)[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul;
        }
        return output;
    };
    
    flock.mul = function (mulInput, output, numSamps) {
        var mul = mulInput.gen(numSamps),
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i];
        }
        return output;
    };
    
    flock.krAdd = function (addInput, output, numSamps) {
        var add = addInput.gen(1)[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] + add;
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
    
    flock.krMulAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.gen(1)[0],
            add = addInput.gen(numSamps),
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul + add[i];
        }
        return output;
    };
    
    flock.mulKrAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.gen(numSamps),
            add = addInput.gen(1)[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i] + add;
        }
        return output;
    };
    
    flock.krMulKrAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.gen(1)[0],
            add = addInput.gen(1)[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul + add;
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
     
    // TODO:
    //  - Cache inputs and add an inputChanged event to speed up control vs. audio rate handling.
    
    flock.ugen = function (inputs, output, sampleRate) {
        var that = {
            inputs: inputs,
            output: output,
            sampleRate: sampleRate || flock.defaults.rates.audio,
            rate: flock.rates.AUDIO,
            model: {}
        };
        
        return that;
    };
    
    flock.ugen.mulAdd = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        
        // Reads directly from the output buffer, overwriting it in place with modified values.
        that.mulAdd = function (numSamps) {  
            var mul = that.inputs.mul,
                add = that.inputs.add,
                fn;
                
            // If we have no mul or add inputs, bail immediately.
            if (!mul && !add) {
                return that.output;
            }
            
            // Only add.
            if (!mul) {
                fn = add.rate !== flock.rates.AUDIO ? flock.krAdd : flock.add;
                return fn(add, that.output, numSamps);
            }
            
            // Only mul.
            if (!add) {
                fn = mul.rate !== flock.rates.AUDIO ? flock.krMul : flock.mul;
                return fn(mul, that.output, numSamps);
            }
            
            // Both mul and add.
            fn = mul.rate !== flock.rates.AUDIO ? 
                (add.rate !== flock.rates.AUDIO ? flock.krMulKrAdd : flock.krMulAdd) :
                (add.rate !== flock.rates.AUDIO ? flock.mulKrAdd : flock.mulAdd);
            return fn(mul, add, that.output, numSamps);
        };
        
        return that;
    };
    
    flock.ugen.value = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        that.rate = flock.rates.CONSTANT;
        that.output[0] = that.model.value = inputs.value;
        
        that.gen = function (numSamps) {
            return that.output;
        };
                
        return that;
    };
    
    // TODO: Add support for a phase input.
    flock.ugen.osc = function (inputs, output, sampleRate) {
        var that = flock.ugen.mulAdd(inputs, output, sampleRate);
        that.model.phase = 0;
          
        that.krFreqGen = function (numSamps) {
            var freq = that.inputs.freq.gen(1)[0],
                table = that.inputs.table,
                tableLen = table.length,
                sampleRate = that.sampleRate,
                output = that.output,
                phase = that.model.phase,
                increment = freq * tableLen / sampleRate,
                i;

            for (i = 0; i < numSamps; i++) {
                output[i] = table[Math.round(phase)];
                phase += increment;
                if (phase >= tableLen) {
                    phase -= tableLen;
                }
            }
            that.model.phase = phase;
            
            return that.mulAdd(numSamps);
        };
        
        that.arFreqGen = function (numSamps) {
            var freq = that.inputs.freq.gen(numSamps),
                table = that.inputs.table,
                tableLen = table.length,
                sampleRate = that.sampleRate,
                output = that.output,
                phase = that.model.phase,
                increment,
                i;

            for (i = 0; i < numSamps; i++) {
                output[i] = table[Math.round(phase)];
                increment = freq[i] * tableLen / sampleRate;
                phase += increment;
                if (phase >= tableLen) {
                    phase -= tableLen;
                }
            }
            that.model.phase = phase;
            
            return that.mulAdd(numSamps);
        };
        
        that.onInputChange = function () {
            that.gen = that.inputs.freq.rate === flock.rates.AUDIO ? that.arFreqGen : that.krFreqGen;
        };
        
        that.onInputChange();
        return that;
    };
        
    flock.ugen.sinOsc = function (inputs, output, sampleRate) {
        var that = flock.ugen.osc(inputs, output, sampleRate);
        // TODO: The table input here isn't a standard ugen input.
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
        var that = flock.ugen.mulAdd(inputs, output, sampleRate);
        that.model = {
            density: 0.0,
            scale: 0.0,
            threshold: 0.0,
            sampleDur: 1.0 / that.sampleRate
        };
        
        that.gen = function (numSamps) {
            var density = inputs.density.gen(1)[0], // Density is kr.
                threshold, 
                scale,
                val,
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
                val = Math.random();
                output[i] = (val < threshold) ? val * scale : 0.0;
            }
            
            return that.mulAdd(numSamps);
        };
                
        return that;
    };
    
    // TODO: Implement control rate version of this algorithm.
    flock.ugen.lfNoise = function (inputs, output, sampleRate) {
        var that = flock.ugen.mulAdd(inputs, output, sampleRate);
        that.model.counter = 0;
        that.model.level = 0;
        
        that.gen = function (numSamps) {
            var freq = inputs.freq.gen(1)[0], // Freq is kr.
                remain = numSamps,
                out = that.output,
                counter = that.model.counter,
                level = that.model.level,
                currSamp = 0,
                sampsForLevel,
                i;
                
            freq = freq > 0.001 ? freq : 0.001;
            do {
                if (counter <= 0) {
                    counter = that.sampleRate / freq;
                    counter = counter > 1 ? counter : 1;
                    level = Math.random();
                }
                sampsForLevel = remain < counter ? remain : counter;
                remain -= sampsForLevel;
                counter -= sampsForLevel;
                for (i = 0; i < sampsForLevel; i++) {
                    out[currSamp] = level;
                    currSamp++;
                }

            } while (remain);
            that.model.counter = counter;
            that.model.level = level;
            
            return that.mulAdd(numSamps);
        };
                
        return that;
    };
    
    flock.ugen.out = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);
        
        // Simple pass-through output.
        that.gen = function (numSamps) {
            return [that.inputs.source.gen(numSamps)];
        };
                
        return that;
    };
    
    flock.ugen.stereoOut = function (inputs, output, sampleRate) {
        var that = flock.ugen(inputs, output, sampleRate);

        that.gen = function (numFrames) {
            var source = that.inputs.source,
                left, 
                right;
            
            // Handle multiple channels, including stereo expansion of a single channel.
            // TODO: Do this less often, introducing some kind of "input changed" event for ugens.
            if (typeof (source.length) === "number") {
                left = source[0].gen(numFrames);
                right = source[1].gen(numFrames);
            } else {
                left = source.gen(numFrames);
                right = left;
            }
            
            return [left, right];
        };
                
        return that;
    };
    
    
    /***********************
     * Synths and Playback *
     ***********************/

    
    /**
     * Generates an interleaved audio buffer from the output unit generator for the specified
     * 'needed' number of samples. If number of needed samples isn't divisble by the control rate,
     * the output buffer's size will be rounded up to the nearest control period.
     *
     * @param {Number} needed the number of samples to generate
     * @param {UGen} outUGen the output unit generator from which to draw samples
     * @param {Object} audioSettings the current audio system settings
     * @return a channel-interleaved output buffer containing roughly the number of needed samples
     */
    flock.interleavedDemandWriter = function (needed, outUGen, audioSettings) {
        var kr = audioSettings.rates.control,
            chans = audioSettings.chans,
            // Figure out how many control periods worth of samples to generate.
            // This means that we'll probably be writing slightly more or less than needed.
            numKRBufs = Math.round(needed / kr),
            outBufSize = numKRBufs * kr * chans,
            outBuf = new Float32Array(outBufSize);
            
        for (var i = 0; i < numKRBufs; i++) {
            var krBufs = outUGen.gen(kr);
            var offset = i * kr * chans;
            
            // Interleave each output channel.
            for (var chan = 0; chan < chans; chan++) {
                var krBuf = krBufs[chan];
                for (var samp = 0; samp < kr; samp++) {
                    var frameIdx = samp * chans + offset;
                    outBuf[frameIdx + chan] = krBuf[samp];
                }
            }
        }
        
        return outBuf;
    };
    
    flock.environment = function () {
        var envFn = typeof (window.webkitAudioContext) !== "undefined" ?
            flock.environment.webkit : flock.environment.moz;
        return envFn.apply(null, arguments);
    };
    
    flock.environment.moz = function (outUGen, audioSettings, model) {
        var that = {
            audioEl: new Audio(),
            outUGen: outUGen,
            audioSettings: audioSettings,
            model: model
        };
        that.model.writeInterval = that.model.writeInterval || flock.defaults.writeInterval;
        that.audioSettings.bufferSize = flock.minBufferSize(flock.defaults.minLatency, that.audioSettings);
        that.audioEl.mozSetup(that.audioSettings.chans, that.audioSettings.rates.audio);
        that.outUGen.output = new Float32Array(that.audioSettings.bufferSize * that.audioSettings.chans);
        that.playbackTimerId = null;
        
        that.play = function () {
            // TODO: Protect against playing when we're already playing.
            if (that.playbackTimerId) {
                return;
            }
            
            that.playbackTimerId = window.setInterval(function () {
                var playState = that.model;
                var needed = that.audioEl.mozCurrentSampleOffset() + 
                    that.audioSettings.bufferSize - playState.written;
                if (needed < 0) {
                    return;
                }
                
                var outBuf = flock.interleavedDemandWriter(needed, that.outUGen, that.audioSettings);
                
                playState.written += that.audioEl.mozWriteAudio(outBuf);
                if (playState.written >= playState.total) {
                    that.stop();
                }
            }, that.writeInterval);
        };
        
        that.stop = function () {
            window.clearInterval(that.playbackTimerId);
            that.playbackTimerId = null;
        };
        
        return that;
    };

    var setupWebKitEnv = function (that) {
        that.jsNode.onaudioprocess = function (e) {
            var kr = flock.defaults.rates.control,
                playState = that.model,
                chans = that.audioSettings.chans,
                bufSize = that.audioSettings.bufferSize,
                numKRBufs = bufSize / kr,
                outBufs = e.outputBuffer;

            for (var i = 0; i < numKRBufs; i++) {
                var krBufs = that.outUGen.gen(kr),
                    offset= i * kr;

                // Loop through each channel.
                for (var chan = 0; chan < chans; chan++) {
                    var outBuf = outBufs.getChannelData(chan),
                        krBuf = krBufs[chan];
                    
                    // And output each sample.
                    for (var samp = 0; samp < kr; samp++) {
                        outBuf[samp + offset] = krBuf[samp];
                    }
                }
            }
            
            playState.written += bufSize * chans;
            if (playState.written >= playState.total) {
                that.stop();
            }
        };
        that.source.connect(that.jsNode);
    };
    
    flock.environment.webkit = function (outUGen, audioSettings, model) {
        var that = {
            outUGen: outUGen,
            audioSettings: audioSettings,
            context: new webkitAudioContext(),
            model: model
        };
        that.audioSettings.bufferSize = 4096; // TODO: how does this relate to minimum latency?
        that.source = that.context.createBufferSource();
        that.jsNode = that.context.createJavaScriptNode(that.audioSettings.bufferSize);
        that.outUGen.output = new Float32Array(that.audioSettings.bufferSize * that.audioSettings.chans);
        
        that.play = function () {
            that.jsNode.connect(that.context.destination);
        };
        
        that.stop = function () {
            that.jsNode.disconnect(0);
        };
        
        setupWebKitEnv(that);
        return that;
    };
    
    flock.synth = function (def, options) {
        options = options || {};
        var that = {
            audioSettings: {
                rates: {
                    audio: options.sampleRate || flock.defaults.rates.audio,
                    control: options.controlRate || flock.defaults.rates.control,
                    constant: options.constantRate || flock.defaults.rates.constant
                },
                chans: options.chans || 2
            },
            model: {
                synthDef: def,
                playState: {
                    written: 0,
                    total: null
                }
            }
        };
        that.ugens = flock.parse.synthDef(that.model.synthDef, that.audioSettings);
        that.out = that.ugens[flock.OUT_UGEN_ID];
        that.environment = flock.environment(that.out, that.audioSettings, that.model.playState);
        
        /**
         * Generates an audio rate signal by evaluating this synth's unit generator graph.
         *
         * @param numSamps the number of samples to generate
         * @return a buffer containing the generated audio
         */
        that.gen = function (numSamps) {
            return that.out.gen(flock.defaults.rates.control);
        };
        
        /**
         * Plays the synth.
         *
         * @param {Number} dur optional duration to play this synth in seconds
         */ 
        that.play = function (dur) {
            var playState = that.model.playState,
                sps = dur * (that.audioSettings.rates.audio * that.audioSettings.chans);
                
            playState.total = dur === undefined ? Infinity :
                playState.total === Infinity ? sps : playState.written + sps;
            that.environment.play();
        };
        
        /**
         * Stops the synth if it is currently playing.
         */
        that.stop = that.environment.stop;
        
        /**
         * Gets the value of the ugen at the specified path.
         *
         * @param {String} path the ugen's path within the synth graph
         * @return {Number|UGen} a scalar value in the case of a value ugen, otherwise the ugen itself
         */
        that.getUGenPath = function (path) {
            var input = flock.resolvePath(path, that.ugens);
            return typeof (input.model.value) !== "undefined" ? input.model.value : input;
        };
        
        /**
         * Sets the value of the ugen at the specified path.
         *
         * @param {String} path the ugen's path within the synth graph
         * @param {Number || UGenDef} val a scalar value (for Value ugens) or a UGenDef object
         * @return {UGen} the newly created UGen that was set at the specified path
         */
        that.setUGenPath = function (path, val) {
            if (path.indexOf(".") === -1) {
                throw new Error("Setting a ugen directly is not currently supported.");
            }
            var lastSegIdx = path.lastIndexOf(".");
            var ugenPath = path.substring(0, lastSegIdx);
            var inputName = path.substring(lastSegIdx + 1);
            var inputs = flock.resolvePath(ugenPath, that.ugens);
            var inputUGen = flock.parse.ugenForInputDef(val, that.audioSettings.rates);
            inputs[inputName] = inputUGen;
            return inputUGen;
        };
        
        /**
         * Gets or sets the value of a ugen at the specified path
         *
         * @param {String} path the ugen's path within the synth graph
         * @param {Number || UGenDef} val an optional value to to set--either a a scalar or a UGenDef object
         * @return {UGen} optionally, the newly created UGen that was set at the specified path
         */
        // TODO: Naming?
        that.input = function (path, val) {
            if (!path) {
                return;
            }
            var expanded = path.replace(".", ".inputs.");
            return arguments.length < 2 ? that.getUGenPath(expanded) : that.setUGenPath(expanded, val);
        };
        
        return that;
    };
    
    
    /**********
     * Parser *
     **********/
    
    flock.parse = flock.parse || {};
    
    flock.parse.synthDef = function (ugenDef, options) {
        var ugens = {},
            source,
            i;
        
        if (typeof (ugenDef.length) === "number") {
            // We've got multiple channels of output.
            source = [];
            for (i = 0; i < ugenDef.length; i++) {
                source[i] = flock.parse.ugenForDef(ugenDef[i], options.rates, ugens);
            }
        } else {
            // Only one output source.
            source = flock.parse.ugenForDef(ugenDef, options.rates, ugens);
            if (ugenDef.id === flock.OUT_UGEN_ID) {
                return ugens;
            }
        }
                
        // User didn't give us an out ugen, so we need to create one automatically.
        var outType = (options.chans === 2) ? "flock.ugen.stereoOut" : "flock.ugen.out";
        var out = flock.parse.ugenForDef({
            id: flock.OUT_UGEN_ID,
            ugen: outType
        }, options.rates, ugens);
        out.inputs.source = source;
        
        return ugens;
    };
    
    flock.parse.makeUGen = function (ugenDef, inputs, rates) {
        // Assume audio rate if no rate was specified by the user.
        if (!ugenDef.rate) {
            ugenDef.rate = flock.rates.AUDIO;
        }
        
        // Audio rate ugens will generate a kr-sized buffer of samples.
        var size = ugenDef.rate === flock.rates.AUDIO ? rates[flock.rates.CONTROL] : 1,
            rate = rates[ugenDef.rate],
            buffer;
        if (size === undefined) {
            throw new Error("The ugenDef's specified rate is not valid.");
        }
        buffer = new Float32Array(size);
            
        return flock.invokePath(ugenDef.ugen, [inputs, buffer, rate]);
    };
    
    flock.parse.ugenForDef = function (ugenDef, rates, ugens) {
        var inputDefs = ugenDef.inputs,
            inputs = {},
            inputDef;
            
        for (inputDef in inputDefs) {
            // Create ugens for all inputs except value inputs.
            inputs[inputDef] = inputDef === "value" ? ugenDef.inputs[inputDef] :
                flock.parse.ugenForInputDef(ugenDef.inputs[inputDef], rates, ugens);
        }
        
        if (!ugenDef.ugen) {
            throw new Error("Unit generator definition lacks a 'ugen' property; can't initialize the synth graph.");
        }
        
        var ugen = flock.parse.makeUGen(ugenDef, inputs, rates);
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
                rate: flock.rates.CONSTANT,
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
    
    flock.parse.ugenForInputDef = function (inputDef, rates, ugens) {
        inputDef = flock.parse.expandInputDef(inputDef);
        return flock.parse.ugenForDef(inputDef, rates, ugens);
    };

}());
