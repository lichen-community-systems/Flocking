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
    flock.ALL_UGENS_ID = "flocking-all";
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
        var mul = mulInput.output[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul;
        }
        return output;
    };
    
    flock.mul = function (mulInput, output, numSamps) {
        var mul = mulInput.output,
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i];
        }
        return output;
    };
    
    flock.krAdd = function (addInput, output, numSamps) {
        var add = addInput.output[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] + add;
        }
        return output;
    };
    
    flock.add = function (addInput, output, numSamps) {
        var add = addInput.output,
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] + add[i];
        }
        return output;
    };
    
    flock.krMulAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.output[0],
            add = addInput.output,
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul + add[i];
        }
        return output;
    };
    
    flock.mulKrAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.output,
            add = addInput.output[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i] + add;
        }
        return output;
    };
    
    flock.krMulKrAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.output[0],
            add = addInput.output[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul + add;
        }
        return output;
    };
    
    flock.mulAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.output,
            add = addInput.output,
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
         
    flock.ugen = function (inputs, output, options) {
        options = options || {};
        
        var that = {
            inputs: inputs,
            output: output,
            sampleRate: options.sampleRate || flock.defaults.rates.audio,
            rate: options.rate || flock.rates.AUDIO,
            model: {}
        };
        
        return that;
    };
        
    flock.ugen.mulAdd = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        
        // Reads directly from the output buffer, overwriting it in place with modified values.
        // TODO: Cache these calculations and use onInputChanged to save a function call.
        that.mulAdd = function (numSamps) {  
            var mul = that.inputs.mul,
                add = that.inputs.add,
                fn;
                
            // If we have no mul or add inputs, bail immediately.
            if (!mul && !add) {
                return;
            }
            
            if (!mul) { // Only add.
                fn = add.rate !== flock.rates.AUDIO ? flock.krAdd : flock.add;
                fn(add, that.output, numSamps);
            } else if (!add) { // Only mul.
                fn = mul.rate !== flock.rates.AUDIO ? flock.krMul : flock.mul;
                fn(mul, that.output, numSamps);
            } else { // Both mul and add.
                fn = mul.rate !== flock.rates.AUDIO ? 
                    (add.rate !== flock.rates.AUDIO ? flock.krMulKrAdd : flock.krMulAdd) :
                    (add.rate !== flock.rates.AUDIO ? flock.mulKrAdd : flock.mulAdd);
                fn(mul, add, that.output, numSamps);
            }
        };
        
        return that;
    };
    
    flock.ugen.value = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        that.rate = flock.rates.CONSTANT;
        that.output[0] = that.model.value = inputs.value;
        return that;
    };
    
    // TODO: Add support for a phase input.
    flock.ugen.osc = function (inputs, output, options) {
        var that = flock.ugen.mulAdd(inputs, output, options);
        that.model.phase = 0;

        that.krFreqGen = function (numSamps) {
            var freq = that.inputs.freq.output[0],
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
                } else if (phase < 0) {
                    phase += tableLen;
                }
            }
            that.model.phase = phase;
            
            that.mulAdd(numSamps);
        };
        
        that.arFreqGen = function (numSamps) {
            var freq = that.inputs.freq.output,
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
                } else if (phase < 0) {
                    phase += tableLen;
                }
            }
            that.model.phase = phase;
            
            that.mulAdd(numSamps);
        };
        
        that.onInputChanged = function () {
            that.gen = that.inputs.freq.rate === flock.rates.AUDIO ? that.arFreqGen : that.krFreqGen;
        };
        
        that.onInputChanged();
        return that;
    };
        
    flock.ugen.sinOsc = function (inputs, output, options) {
        var that = flock.ugen.osc(inputs, output, options);
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
    
    flock.ugen.dust = function (inputs, output, options) {
        var that = flock.ugen.mulAdd(inputs, output, options);
        that.model = {
            density: 0.0,
            scale: 0.0,
            threshold: 0.0,
            sampleDur: 1.0 / that.sampleRate
        };
        
        that.gen = function (numSamps) {
            var density = inputs.density.output[0], // Density is kr.
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
            
            that.mulAdd(numSamps);
        };
                
        return that;
    };
    
    // TODO: Implement control rate version of this algorithm.
    flock.ugen.lfNoise = function (inputs, output, options) {
        var that = flock.ugen.mulAdd(inputs, output, options);
        that.model.counter = 0;
        that.model.level = 0;
        
        that.gen = function (numSamps) {
            var freq = inputs.freq.output[0], // Freq is kr.
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
            
            that.mulAdd(numSamps);
        };
                
        return that;
    };
    
    flock.ugen.out = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        that.output = that.inputs.source.output;
        return that;
    };
    
    flock.ugen.stereoOut = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        
        that.onInputChanged = function () {
            var source = that.inputs.source;
            if (typeof (source.length) === "number") {
                that.output = [source[0].output, source[1].output];
            } else {
                that.output = [source.output, source.output];
            }
        };
        
        that.onInputChanged();
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
    flock.interleavedDemandWriter = function (needed, evalFn, outUGen, audioSettings) {
        var kr = audioSettings.rates.control,
            chans = audioSettings.chans,
            // Figure out how many control periods worth of samples to generate.
            // This means that we'll probably be writing slightly more or less than needed.
            numKRBufs = Math.round(needed / kr),
            outBufSize = numKRBufs * kr * chans,
            outBuf = new Float32Array(outBufSize);
            
        for (var i = 0; i < numKRBufs; i++) {
            evalFn();
            var krBufs = outUGen.output;
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
    
    flock.environment.moz = function (evalFn, outUGen, audioSettings, model) {
        var that = {
            audioEl: new Audio(),
            evalFn: evalFn,
            outUGen: outUGen,
            audioSettings: audioSettings,
            model: model
        };
        that.model.writeInterval = that.model.writeInterval || flock.defaults.writeInterval;
        that.audioSettings.bufferSize = flock.minBufferSize(flock.defaults.minLatency, that.audioSettings);
        that.audioEl.mozSetup(that.audioSettings.chans, that.audioSettings.rates.audio);
        that.playbackTimerId = null;
        
        that.play = function () {
            // Don't play if we're already playing.
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
                
                var outBuf = flock.interleavedDemandWriter(needed, that.evalFn, that.outUGen, that.audioSettings);
                
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
                that.evalFn();
                var krBufs = that.outUGen.output,
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
    
    flock.environment.webkit = function (evalFn, outUGen, audioSettings, model) {
        var that = {
            evalFn: evalFn,
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
    
    flock.environment.evalGraph = function (nodes, kr) {
        var i,
            node;
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            node.gen(node.rate === flock.rates.AUDIO ? kr : 1);
        }
    };
    
    flock.synth = function (def, options) {
        options = options || {};
        var that = {
            rate: flock.rates.AUDIO,
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
        that.inputUGens = flock.parse.synthDef(that.model.synthDef, that.audioSettings);
        that.ugens = that.inputUGens[flock.ALL_UGENS_ID];
        that.out = that.inputUGens[flock.OUT_UGEN_ID];
        
        /**
         * Generates an audio rate signal by evaluating this synth's unit generator graph.
         *
         * @param numSamps the number of samples to generate
         * @return a buffer containing the generated audio
         */
        that.gen = function () {
            // Synths always evaluate their ugen graph at the audio rate.
            flock.environment.evalGraph(that.ugens, that.audioSettings.rates.control);
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
         * Gets the value of the ugen at the specified path.
         *
         * @param {String} path the ugen's path within the synth graph
         * @return {Number|UGen} a scalar value in the case of a value ugen, otherwise the ugen itself
         */
        that.getUGenPath = function (path) {
            var input = flock.resolvePath(path, that.inputUGens);
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
            
            var lastSegIdx = path.lastIndexOf("."),
                ugenInputPath = path.substring(0, lastSegIdx),
                ugenPath = ugenInputPath.substring(0, ugenInputPath.lastIndexOf(".")),
                inputName = path.substring(lastSegIdx + 1),
                ugen = flock.resolvePath(ugenPath, that.inputUGens),
                inputUGen = flock.parse.ugenForInputDef(val, that.audioSettings.rates);
                
            ugen.inputs[inputName] = inputUGen;
            ugen.onInputChanged();
            
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
        
        that.environment = flock.environment(that.gen, that.out, that.audioSettings, that.model.playState);
        
        /**
         * Stops the synth if it is currently playing.
         */
        that.stop = that.environment.stop;
        
        return that;
    };
    
    
    /**********
     * Parser *
     **********/
    
    flock.parse = flock.parse || {};
    
    flock.parse.synthDef = function (ugenDef, options) {
        var ugens = {};
        ugens[flock.ALL_UGENS_ID] = [];
        
        // We didn't get an out ugen specified, so we need to make one.
        if (typeof (ugenDef.length) === "number" || ugenDef.id !== flock.OUT_UGEN_ID) {
            ugenDef = {
                id: flock.OUT_UGEN_ID,
                ugen: (options.chans === 2) ? "flock.ugen.stereoOut" : "flock.ugen.out",
                inputs: {
                    source: ugenDef
                }
            };
        }
        
        flock.parse.ugenForDef(ugenDef, options.rates, ugens);
        return ugens;
    };
    
    flock.parse.makeUGen = function (ugenDef, parsedInputs, rates) {
        // Assume audio rate if no rate was specified by the user.
        if (!ugenDef.rate) {
            ugenDef.rate = flock.rates.AUDIO;
        }
        
        var buffer = new Float32Array(ugenDef.rate === flock.rates.AUDIO ? rates.control : 1),
            sampleRate;
        
        // Set the ugen's sample rate value according to the rate the user specified.
        if (ugenDef.rate === flock.rates.AUDIO) {
            sampleRate = rates.audio;
        } else if (ugenDef.rate === flock.rates.CONTROL) {
            sampleRate = rates.audio / rates.control;
        } else {
            sampleRate = 1;
        }
            
        return flock.invokePath(ugenDef.ugen, [
            parsedInputs, 
            buffer, 
            {
                sampleRate: sampleRate,
                rate: ugenDef.rate
            }
        ]);
    };
    
    flock.parse.ugensForDefs = function (ugenDefs, rates, ugens) {
        var parsed = [],
            i;
        for (i = 0; i < ugenDefs.length; i++) {
            parsed[i] = flock.parse.ugenForDef(ugenDefs[i], rates, ugens);
        }
        return parsed;
    };
    
    /**
     * Creates a unit generator for the specified unit generator definition spec.
     *
     * ugenDefs are plain old JSON objects describing the characteristics of the desired unit generator, including:
     *      - ugen: the type of unit generator, as string (e.g. "flock.ugen.sinOsc")
     *      - rate: the rate at which the ugen should be run, either "audio", "control", or "constant"
     *      - id: an optional unique name for the unit generator, which will make it available as a synth input
     *      - inputs: a JSON object containing named key/value pairs for inputs to the unit generator
     */
    flock.parse.ugenForDef = function (ugenDef, rates, ugens) {
        // We received an array of ugen defs.
        if (typeof (ugenDef.length) === "number") {
            return flock.parse.ugensForDefs(ugenDef, rates, ugens);
        }
        
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
        // TODO: Refactor this into a separate strategy.
        if (ugens) {
            if (ugen.gen) {
                ugens[flock.ALL_UGENS_ID].push(ugen);
            }
            if (ugenDef.id) {
                ugens[ugenDef.id] = ugen;
            }
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
