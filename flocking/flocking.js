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
    };
    
    flock.mul = function (mulInput, output, numSamps) {
        var mul = mulInput.output,
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i];
        }
    };
    
    flock.krAdd = function (addInput, output, numSamps) {
        var add = addInput.output[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] + add;
        }
    };
    
    flock.add = function (addInput, output, numSamps) {
        var add = addInput.output,
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] + add[i];
        }
    };
    
    flock.krMulAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.output[0],
            add = addInput.output,
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul + add[i];
        }
    };
    
    flock.mulKrAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.output,
            add = addInput.output[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i] + add;
        }
    };
    
    flock.krMulKrAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.output[0],
            add = addInput.output[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul + add;
        }
    };
    
    flock.mulAdd = function (mulInput, addInput, output, numSamps) {
        var mul = mulInput.output,
            add = addInput.output,
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i] + add[i];
        }
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
    
    flock.ugen.osc = function (inputs, output, options) {
        var that = flock.ugen.mulAdd(inputs, output, options);
        that.model.phase = 0.0;

        that.krFreqKrPhase = function (numSamps) {
            var freq = that.inputs.freq.output[0],
                phase = that.inputs.phase.output[0],
                table = that.inputs.table,
                tableLen = that.model.tableLen,
                freqInc = freq * that.model.tableIncHz,
                phaseInc = phase * that.model.tableIncRad,
                output = that.output,
                phaseAccum = that.model.phase,
                i,
                idx;

            for (i = 0; i < numSamps; i++) {
                idx = Math.round(phaseAccum + phaseInc);
                if (idx >= tableLen) {
                    idx -= tableLen;
                } else if (idx < 0) {
                    idx += tableLen;
                }
                
                output[i] = table[idx];
                phaseAccum += freqInc;
                if (phaseAccum >= tableLen) {
                    phaseAccum -= tableLen;
                } else if (phaseAccum < 0) {
                    phaseAccum += tableLen;
                }
            }
            
            that.model.phase = phaseAccum;
            return that.mulAdd(numSamps);
        };
        
        that.krFreqArPhase = function (numSamps) {
            var freq = that.inputs.freq.output[0],
                phase = that.inputs.phase.output,
                table = that.inputs.table,
                tableLen = that.model.tableLen,
                freqInc = freq * that.model.tableIncHz,
                tableIncRad = that.model.tableIncRad,
                output = that.output,
                phaseAccum = that.model.phase,
                i,
                idx;

            for (i = 0; i < numSamps; i++) {
                idx = Math.round(phaseAccum + phase[i] * tableIncRad);
                if (idx >= tableLen) {
                    idx -= tableLen;
                } else if (idx < 0) {
                    idx += tableLen;
                }
                output[i] = table[idx];
                phaseAccum += freqInc;
                if (phaseAccum >= tableLen) {
                    phaseAccum -= tableLen;
                } else if (phaseAccum < 0) {
                    phaseAccum += tableLen;
                }
            }
            that.model.phase = phaseAccum;
            return that.mulAdd(numSamps);
        };

        that.arFreqKrPhase = function (numSamps) {
            var freq = that.inputs.freq.output,
                phase = that.inputs.phase.output[0],
                table = that.inputs.table,
                tableLen = that.model.tableLen,
                tableIncHz = that.model.tableIncHz,
                phaseInc = phase * that.model.tableIncRad,
                output = that.output,
                phaseAccum = that.model.phase,
                i,
                idx;

            for (i = 0; i < numSamps; i++) {
                idx = Math.round(phaseAccum + phaseInc);
                if (idx >= tableLen) {
                    idx -= tableLen;
                } else if (idx < 0) {
                    idx += tableLen;
                }
                output[i] = table[idx];
                phaseAccum += freq[i] * tableIncHz;
                if (phaseAccum >= tableLen) {
                    phaseAccum -= tableLen;
                } else if (phaseAccum < 0) {
                    phaseAccum += tableLen;
                }
            }
            that.model.phase = phaseAccum;
            return that.mulAdd(numSamps);
        };
                
        that.arFreqArPhase = function (numSamps) {
            var freq = that.inputs.freq.output,
                phase = that.inputs.phase.output,
                table = that.inputs.table,
                tableLen = that.model.tableLen,
                tableIncHz = that.model.tableIncHz,
                tableIncRad = that.model.tableIncRad,
                output = that.output,
                phaseAccum = that.model.phase,
                i,
                idx;

            for (i = 0; i < numSamps; i++) {
                idx = Math.round(phaseAccum + phase[i] * tableIncRad);
                if (idx >= tableLen) {
                    idx -= tableLen;
                } else if (idx < 0) {
                    idx += tableLen;
                }
                output[i] = table[idx];
                phaseAccum += freq[i] * tableIncHz;
                if (phaseAccum >= tableLen) {
                    phaseAccum -= tableLen;
                } else if (phaseAccum < 0) {
                    phaseAccum += tableLen;
                }
            }

            that.model.phase = phaseAccum;
            return that.mulAdd(numSamps);
        };
        
        that.onInputChanged = function () {
            flock.ugen.osc.onInputChanged(that);
            
            // Precalculate table-related values.
            // TODO: The table input here isn't a standard ugen input. Does this matter?
            that.model.tableLen = that.inputs.table.length;
            that.model.tableIncHz = that.model.tableLen / that.sampleRate;
            that.model.tableIncRad =  that.model.tableLen / flock.TWOPI;
        };
        
        that.onInputChanged();
        return that;
    };
    
    flock.ugen.osc.onInputChanged = function (that) {
        if (!that.inputs.phase) {
            that.inputs.phase = flock.ugen.value({value: 0.0}, new Float32Array(1));
        }
        
        var phaseRate = that.inputs.phase.rate;
        if (that.inputs.freq.rate === flock.rates.AUDIO) {
            that.gen = phaseRate === flock.rates.AUDIO ? that.arFreqArPhase : that.arFreqKrPhase;
        } else {
            that.gen = phaseRate === flock.rates.AUDIO ? that.krFreqArPhase : that.krFreqKrPhase;
        }
    };
    
    flock.ugen.sinOsc = function (inputs, output, options) {
        inputs.table = flock.ugen.sinOsc.fillTable(flock.defaults.tableSize);
        return flock.ugen.osc(inputs, output, options);
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
    
    flock.ugen.sin = function (inputs, output, options) {
        var that = flock.ugen.mulAdd(inputs, output, options);
        that.model.phase = 0.0;
        
        that.krFreqKrPhase = function (numSamps) {
            var freq = that.inputs.freq.output[0],
                freqInc = freq / that.sampleRate * flock.TWOPI,
                phase = that.inputs.phase.output[0],
                phaseAccum = that.model.phase,
                i;
            for (i = 0; i < numSamps; i++) {
                output[i] = Math.sin(phaseAccum + phase);
                phaseAccum += freqInc;
            }
            that.model.phase = phaseAccum;
            that.mulAdd(numSamps);
        };
        
        that.krFreqArPhase = function (numSamps) {
            var freq = that.inputs.freq.output[0],
                freqInc = freq / that.sampleRate * flock.TWOPI,
                phase = that.inputs.phase.output,
                phaseAccum = that.model.phase,
                i;
            for (i = 0; i < numSamps; i++) {
                output[i] = Math.sin(phaseAccum + phase[i]);
                phaseAccum += freqInc;
            }
            that.model.phase = phaseAccum;
            that.mulAdd(numSamps);
        };
        
        that.arFreqKrPhase = function (numSamps) {
            var freq = that.inputs.freq.output,
                phase = that.inputs.phase.output[0],
                phaseAccum = that.model.phase,
                sampleRate = that.sampleRate,
                i;
            for (i = 0; i < numSamps; i++) {
                output[i] = Math.sin(phaseAccum + phase);
                phaseAccum += freq[i]  / sampleRate * flock.TWOPI;
            }
            that.model.phase = phaseAccum;
            that.mulAdd(numSamps);
        };
        
        that.arFreqArPhase = function (numSamps) {
            var freq = that.inputs.freq.output,
                phase = that.inputs.phase.output,
                phaseAccum = that.model.phase,
                sampleRate = that.sampleRate,
                phaseInc,
                i;
            for (i = 0; i < numSamps; i++) {
                output[i] = Math.sin(phaseAccum + phase[i]);
                phaseAccum += freq[i] / sampleRate * flock.TWOPI;
            }
            that.model.phase = phaseAccum;
            that.mulAdd(numSamps);
        };
        
        that.onInputChanged = function () {
            flock.ugen.osc.onInputChanged(that);
        };
        
        that.onInputChanged();
        return that;
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
    
    flock.ugen.lfNoise = function (inputs, output, options) {
        var that = flock.ugen.mulAdd(inputs, output, options);
        that.rate = flock.rates.AUDIO; // TODO: Implement control rate version of this algorithm.
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
    
    flock.ugen.line = function (inputs, output, options) {
        var that = flock.ugen.mulAdd(inputs, output, options);

        that.gen = function (numSamps) {
            var stepSize = that.model.stepSize,
                numSteps = that.model.numSteps,
                numLevelVals = numSteps >= numSamps ? numSamps : numSteps,
                numEndVals = numSamps - numLevelVals,
                level = that.model.level,
                out = that.output,
                i;
            
            for (i = 0; i < numLevelVals; i++) {
                out[i] = level;
                numSteps--;
                level += stepSize;
            }
            
            // TODO: Implement a more efficient gen algorithm when the line has finished.
            if (numEndVals > 0) {
                for (i = 0; i < numEndVals; i++) {
                    out[i] = level;
                }
            }
            
            that.model.level = level;
            that.model.numSteps = numSteps;
            
            that.mulAdd(numSamps);
        };
        
        that.onInputChanged = function () {
            // Any change in input value will restart the line.
            that.model.start = that.inputs.start.output[0];
            that.model.end = that.inputs.end.output[0];
            that.model.numSteps = Math.round(that.inputs.duration.output[0] * that.sampleRate); // Duration is seconds.
            if (that.model.numSteps === 0) {
                that.model.stepSize = 0.0;
                that.model.level = that.model.end;
            } else {
                that.model.stepSize = (that.model.end - that.model.start) / that.model.numSteps;
                that.model.level = that.model.start;
            }
        };
        
        that.onInputChanged();
        return that;
    };
    
    flock.ugen.xLine = function (inputs, output, options) {
        var that = flock.ugen.mulAdd(inputs, output, options);

        that.gen = function (numSamps) {
            var multiplier = that.model.multiplier,
                numSteps = that.model.numSteps,
                numLevelVals = numSteps >= numSamps ? numSamps : numSteps,
                numEndVals = numSamps - numLevelVals,
                level = that.model.level,
                out = that.output,
                i;
            
            for (i = 0; i < numLevelVals; i++) {
                out[i] = level;
                numSteps--;
                level *= multiplier;
            }
            
            // TODO: Implement a more efficient gen algorithm when the line has finished.
            if (numEndVals > 0) {
                for (i = 0; i < numEndVals; i++) {
                    out[i] = level;
                }
            }
            
            that.model.level = level;
            that.model.numSteps = numSteps;
            
            that.mulAdd(numSamps);
        };
        
        that.onInputChanged = function () {
            // Any change in input value will restart the line.
            that.model.start = that.inputs.start.output[0];
            that.model.end = that.inputs.end.output[0];
            that.model.numSteps = Math.round(that.inputs.duration.output[0] * that.sampleRate);
            that.model.multiplier = Math.pow(that.model.end / that.model.start, 1.0 / that.model.numSteps);
            that.model.level = that.model.start;
        };
        
        that.onInputChanged();
        return that;
    };
    
    flock.ugen.out = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        
        that.krBufferMultiChan = function () {
            var source = that.inputs.source,
                buffers = flock.enviro.shared.buffers,
                bufStart = that.inputs.buffer.output[0],
                i;
                
            for (i = 0; i < source.length; i++) {
                buffers[bufStart + i] = source[i].output;
            }
        };
        
        that.krBufferExpandSingle = function () {
            var source = that.inputs.source,
                buffers = flock.enviro.shared.buffers,
                bufStart = that.inputs.buffer.output[0],
                chans = that.model.chans,
                i;
                
            for (i = 0; i < chans; i++) {
                buffers[bufStart + i] = source.output;
            }
        };
        
        that.onInputChanged = function () {
            var isMulti = typeof (that.inputs.source.length) === "number";
            that.gen = isMulti ? that.krBufferMultiChan : that.krBufferExpandSingle;            
            that.model.chans = that.inputs.expand ? that.inputs.expand.output[0] : 1; // Assume constant rate.
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
    flock.interleavedDemandWriter = function (needed, evalFn, sourceBufs, audioSettings) {
        var kr = audioSettings.rates.control,
            chans = audioSettings.chans,
            // Figure out how many control periods worth of samples to generate.
            // This means that we'll probably be writing slightly more or less than needed.
            numKRBufs = Math.round(needed / kr),
            outBufSize = numKRBufs * kr * chans,
            outBuf = new Float32Array(outBufSize); // TODO: Don't generate a new buffer each time through.
            
        for (var i = 0; i < numKRBufs; i++) {
            evalFn();
            var offset = i * kr * chans;
            
            // Interleave each output channel.
            for (var chan = 0; chan < chans; chan++) {
                var sourceBuf = sourceBufs[chan];
                for (var samp = 0; samp < kr; samp++) {
                    var frameIdx = samp * chans + offset;
                    outBuf[frameIdx + chan] = sourceBuf[samp];
                }
            }
        }
        
        return outBuf;
    };
    
    var setupEnviro = function (that) {
        var setupFn = typeof (window.webkitAudioContext) !== "undefined" ?
            flock.enviro.webkit : flock.enviro.moz;
        setupFn(that);
    };
    
    flock.enviro = function (options) {
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
                playState: {
                    written: 0,
                    total: null
                }
            },
            nodes: []
        };
        that.buffers = flock.enviro.createAudioBuffers(16, that.audioSettings.rates.control);
        
        /**
         * Starts generating samples from all synths.
         *
         * @param {Number} dur optional duration to play in seconds
         */
        that.play = function (dur) {
            var playState = that.model.playState,
                sps = dur * (that.audioSettings.rates.audio * that.audioSettings.chans);
                
            playState.total = dur === undefined ? Infinity :
                playState.total === Infinity ? sps : playState.written + sps;
            that.registerCallback();
        };
        
        /**
         * Stops generating samples from all synths.
         */
        that.stop = function () {
            that.unregisterCallback();
        };
        
        that.gen = function () {
            flock.enviro.evalGraph(that.nodes, that.audioSettings.rates.control);
        };
        
        that.head = function (node) {
            that.nodes.unshift(node);
        };
        
        that.before = function (refNode, node) {
            var refIdx = that.nodes.indexOf(refNode);
            that.at(refIdx, node);
        };
        
        that.after = function (refNode, node) {
            var refIdx = that.nodes.indexOf(refNode);
            that.at(refIdx + 1, node);
        };
        
        that.at = function (idx, node) {
            that.nodes.splice(idx, 0, node);
        };
        
        that.tail = function (node) {
            that.nodes.push(node);
        };
        
        that.remove = function (node) {
            var idx = that.nodes.indexOf(node);
            that.nodes.splice(idx, 1);
        };

        setupEnviro(that);
        return that;
    };

    flock.enviro.createAudioBuffers = function (numBufs, kr) {
        var bufs = [],
            i;
        for (i = 0; i < numBufs; i++) {
            bufs[i] = new Float32Array(kr);
        }
        return bufs;
    };
    
    flock.enviro.evalGraph = function (nodes, kr) {
        var i,
            node;
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            node.gen(node.rate === flock.rates.AUDIO ? kr : 1);
        }
    };
    
    /**
     * Mixes in Firefox-specific Audio Data API implementations for outputting audio
     *
     * @param that the environment to mix into
     */
    flock.enviro.moz = function (that) {
        that.audioEl = new Audio();
        that.model.writeInterval = that.model.writeInterval || flock.defaults.writeInterval;
        that.audioSettings.bufferSize = flock.minBufferSize(flock.defaults.minLatency, that.audioSettings);
        that.audioEl.mozSetup(that.audioSettings.chans, that.audioSettings.rates.audio);
        that.playbackTimerId = null;
        
        that.registerCallback = function () {
            // Don't play if we're already playing.
            if (that.playbackTimerId) {
                return;
            }
            
            that.playbackTimerId = window.setInterval(function () {
                var playState = that.model.playState;
                var needed = that.audioEl.mozCurrentSampleOffset() + 
                    that.audioSettings.bufferSize - playState.written;
                if (needed < 0) {
                    return;
                }
                
                var outBuf = flock.interleavedDemandWriter(needed, that.gen, that.buffers, that.audioSettings);
                playState.written += that.audioEl.mozWriteAudio(outBuf);
                if (playState.written >= playState.total) {
                    that.stop();
                }
            }, that.model.writeInterval);
        };
        
        that.unregisterCallback = function () {
            window.clearInterval(that.playbackTimerId);
            that.playbackTimerId = null;
        };        
    };


    var setupWebKitEnviro = function (that) {
        that.jsNode.onaudioprocess = function (e) {
            var kr = flock.defaults.rates.control,
                playState = that.model,
                chans = that.audioSettings.chans,
                bufSize = that.audioSettings.bufferSize,
                numKRBufs = bufSize / kr,
                sourceBufs = that.buffers,
                outBufs = e.outputBuffer;

            for (var i = 0; i < numKRBufs; i++) {
                that.gen();
                var offset = i * kr;

                // Loop through each channel.
                for (var chan = 0; chan < chans; chan++) {
                    var sourceBuf = sourceBufs[chan],
                        outBuf = outBufs.getChannelData(chan);
                    
                    // And output each sample.
                    for (var samp = 0; samp < kr; samp++) {
                        outBuf[samp + offset] = sourceBuf[samp];
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
    
    
    /**
     * Mixes in WebKit-specific Web Audio API implementations for outputting audio
     *
     * @param that the environment to mix into
     */
    flock.enviro.webkit = function (that) {
        that.context = new webkitAudioContext();
        that.audioSettings.bufferSize = 4096; // TODO: how does this relate to minimum latency?
        that.source = that.context.createBufferSource();
        that.jsNode = that.context.createJavaScriptNode(that.audioSettings.bufferSize);
        
        that.registerCallback = function () {
            that.jsNode.connect(that.context.destination);
        };
        
        that.unregisterCallback = function () {
            that.jsNode.disconnect(0);
        };
        
        setupWebKitEnviro(that);
    };
    
    // Immediately register a singleton environment for the page.
    // Users are free to replace this with their own if needed.
    // TODO: Avoid dorky globalism?
    flock.enviro.shared = flock.enviro();
    
    
    flock.synth = function (def) {
        var that = {
            rate: flock.rates.AUDIO,
            model: {
                synthDef: def
            }
        };
        that.enviro = flock.enviro.shared;
        that.inputUGens = flock.parse.synthDef(that.model.synthDef, that.enviro.audioSettings);
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
            flock.enviro.evalGraph(that.ugens, that.enviro.audioSettings.rates.control);
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
                inputUGen = flock.parse.ugenForInputDef(val, that.enviro.audioSettings.rates);
                
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
                
        /**
         * Plays the synth. This is a convenience method that will add the synth to the tail of the
         * environment's node graph and then play the environmnent.
         *
         * @param {Number} dur optional duration to play this synth in seconds
         */
        that.play = function () {
            that.enviro.tail(that);
            that.enviro.play();
        };
        
        /**
         * Stops the synth if it is currently playing.
         * This is a convenience method that will remove the synth from the environment's node graph
         * and then stop the environment.
         */
        that.stop = function () {
            that.enviro.stop();
            that.enviro.remove(that);
        };
                
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
                ugen: "flock.ugen.out",
                inputs: {
                    source: ugenDef,
                    buffer: 0,
                    expand: options.chans
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
    
    
    flock.parse.reservedWords = ["id", "ugen", "rate", "inputs", "options"];
    
    flock.parse.expandUGenDef = function (ugenDef) {
        var inputs = {},
            prop;
           
        // Copy any non-reserved properties from the top-level ugenDef object into the inputs property.
        for (prop in ugenDef) {
            if (flock.parse.reservedWords.indexOf(prop) === -1) {
                inputs[prop] = ugenDef[prop];
                delete ugenDef[prop];
            }
        }
        ugenDef.inputs = inputs;
        
        return ugenDef;
    };
    
    flock.parse.rateMap = {
        "ar": flock.rates.AUDIO,
        "kr": flock.rates.CONTROL,
        "cr": flock.rates.CONSTANT
    };
    
    flock.parse.expandRate = function (ugenDef) {
        ugenDef.rate = flock.parse.rateMap[ugenDef.rate] || ugenDef.rate;
        return ugenDef;
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
     *           OR
     *      - inputs keyed by name at the top level of the ugenDef
     */
    flock.parse.ugenForDef = function (ugenDef, rates, ugens) {
        rates = rates || flock.defaults.rates;
        
        // We received an array of ugen defs.
        if (typeof (ugenDef.length) === "number") {
            return flock.parse.ugensForDefs(ugenDef, rates, ugens);
        }
        
        if (!ugenDef.inputs) {
            ugenDef = flock.parse.expandUGenDef(ugenDef);
        }
        
        flock.parse.expandRate(ugenDef);
        
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
