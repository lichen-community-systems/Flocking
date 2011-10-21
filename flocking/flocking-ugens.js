/*
* Flocking Unit Generators
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Float32Array*/
/*jslint white: true, funcinvoke: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, forvar: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";
     
    flock.ugen = function (inputs, output, options) {
        options = options || {};
    
        var that = {
            inputs: inputs,
            output: output,
            sampleRate: options.sampleRate || flock.defaults.rates.audio,
            rate: options.rate || flock.rates.AUDIO,
            options: options,
            model: {}
        };
    
        return that;
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

    flock.ugen.osc.define = function (name, tableFillFn) {
        var lastSegIdx = name.lastIndexOf("."),
            namespace = name.substring(0, lastSegIdx),
            oscName = name.substring(lastSegIdx + 1),
            namespaceObj = flock.resolvePath(namespace);
        
        namespaceObj[oscName] = function (inputs, output, options) {
            var size = (options && options.tableSize) || flock.defaults.tableSize,
                scale = flock.TWOPI / size;
            inputs.table = tableFillFn(size, scale); // TODO: Make table an option, not an input.
            return flock.ugen.osc(inputs, output, options);
        };
    };
    
    
    flock.ugen.osc.define("flock.ugen.sinOsc", function (size, scale) {
        return flock.generate(size, function (i) {
            return Math.sin(i * scale);
        });
    });

    flock.ugen.osc.fourierTable = function (size, scale, numHarms, phase, amps) {
        phase *= flock.TWOPI;
        
        return flock.generate(size, function (i) {
            var harm,
                amp,
                w,
                val = 0.0;
                
            for (harm = 0; harm < numHarms; harm++) {
                amp = amps ? amps[harm] : 1.0;
                w = (harm + 1) * (i * scale);
                val += amp * Math.cos(w + phase);
            }
            
            return val;
        });
    };
    
    flock.ugen.osc.normalizedFourierTable = function (size, scale, numHarms, phase, ampGenFn) {
        var amps = flock.generate(numHarms, function (harm) {
            return ampGenFn(harm + 1); // Indexed harmonics from 1 instead of 0.
        });
        
        var table = flock.ugen.osc.fourierTable(size, scale, numHarms, phase, amps);
        return flock.normalize(table);
    };
    
    flock.ugen.osc.define("flock.ugen.triOsc", function (size, scale) {
        return flock.ugen.osc.normalizedFourierTable(size, scale, 1000, 1.0, function (harm) {
            // Only odd harmonics with amplitudes decreasing by the inverse square of the harmonic number
            return harm % 2 === 0 ? 0.0 : 1.0 / (harm * harm);
        });
    });
    
    flock.ugen.osc.define("flock.ugen.sawOsc", function (size, scale) {
        return flock.ugen.osc.normalizedFourierTable(size, scale, 10, -0.25, function (harm) {
            // All harmonics with amplitudes decreasing by the inverse of the harmonic number
            return 1.0 / harm;
        });
    });
    
    flock.ugen.osc.define("flock.ugen.squareOsc", function (size, scale) {
        return flock.ugen.osc.normalizedFourierTable(size, scale, 10, -0.25, function (harm) {
            // Only odd harmonics with amplitudes decreasing by the inverse of the harmonic number
            return harm % 2 === 0 ? 0.0 : 1.0 / harm;
        });
    });

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
    
    flock.ugen.lfSaw = function (inputs, output, options) {
        var that = flock.ugen.mulAdd(inputs, output, options);
        that.model.scale = 2 * (1 / options.sampleRate);
        
        that.krFreq = function (numSamps) {
            that.model.phase = that.model.phase || that.inputs.phase.output[0]; // Only read the phase input initially.
            var freq = that.inputs.freq.output[0], // TODO: hard-coded at control rate. Fix this.
                out = that.output,
                scale = that.model.scale,
                phase = that.model.phase,
                i;
            
            for (i = 0; i < numSamps; i++) {
                out[i] = phase;
                phase += freq * scale;
                if (phase >= 1.0) { 
                    phase -= 2.0;
                } else if (phase <= -1.0) {
                    phase += 2.0;
                }
            }
            that.model.phase = phase;
        };
        
        that.arFreq = function (numSamps) {
            that.model.phase = that.model.phase || that.inputs.phase.output[0]; // Only read the phase input initially.
            var freq = that.inputs.freq.output,
                out = that.output,
                scale = that.model.scale,
                phase = that.model.phase,
                i;
            
            for (i = 0; i < numSamps; i++) {
                out[i] = phase;
                phase += freq[i] * scale;
                if (phase >= 1.0) { 
                    phase -= 2.0;
                } else if (phase <= -1.0) {
                    phase += 2.0;
                }
            }
            that.model.phase = phase;
        };
        
        that.onInputChanged = function () {
            that.gen = that.inputs.freq.rate === flock.rates.AUDIO ? that.arFreq : that.krFreq;
            
            if (!that.inputs.phase) {
                that.inputs.phase = flock.ugen.value({value: 0.0}, new Float32Array(1));
            }
        };
        
        that.onInputChanged();
        return that;
    };
    
    flock.ugen.lfPulse = function (inputs, output, options) {
        var that = flock.ugen.mulAdd(inputs, output, options);
        that.model.scale = 1 / options.sampleRate;
        
        that.krFreq = function (numSamps) {
            // TODO: Can this be done more efficiently? Definitely if we knew the synth graph had been primed.
            that.model.phase = that.model.phase ||  that.inputs.phase.output[0]; // Only read the phase input initially.
            
            var freq = that.inputs.freq.output[0],
                width = that.inputs.width.output[0], // TODO: Are we handling width correctly here?
                out = that.output,
                scale = that.model.scale,
                phase = that.model.phase, 
                i;
            
            for (i = 0; i < numSamps; i++) {
                if (phase >= 1.0) {
                    phase -= 1.0;
                    out[i] = width < 0.5 ? 1.0 : -1.0;
                } else {
                    out[i] = phase < width ? 1.0 : -1.0;
                }
                phase += freq * scale;
            }
            that.model.phase = phase;
        };
        
        that.arFreq = function (numSamps) {
            that.model.phase = that.model.phase ||  that.inputs.phase.output[0];
            
            var freq = that.inputs.freq.output,
                width = that.inputs.width.output[0],
                out = that.output,
                scale = that.model.scale,
                phase = that.model.phase, 
                i;
            
            for (i = 0; i < numSamps; i++) {
                if (phase >= 1.0) {
                    phase -= 1.0;
                    out[i] = width < 0.5 ? 1.0 : -1.0;
                } else {
                    out[i] = phase < width ? 1.0 : -1.0;
                }
                phase += freq[i] * scale;
            }
            that.model.phase = phase;
        };
        
        that.onInputChanged = function () {
            that.gen = that.inputs.freq.rate === flock.rates.AUDIO ? that.arFreq : that.krFreq;
            
            // TODO: factor out this functionality into some kind of configurable setting for all ugens.
            if (!that.inputs.phase) {
                that.inputs.phase = flock.ugen.value({value: 0.0}, new Float32Array(1));
            }
            
            if (!that.inputs.width) { 
                that.inputs.width = flock.ugen.value({value: 0.5}, new Float32Array(1));
            }
        };
        
        that.onInputChanged();
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
    
    flock.ugen.scope = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        
        // TODO: Move more of this code to the scopeView widget.
        that.model.spf = that.sampleRate / flock.defaults.fps;
        that.model.bufIdx = 0;
        
        // Setup the scopeView widget. 
        that.model.scope = that.options.styles;
        that.model.scope.values = new Float32Array(that.model.spf);
        that.scopeView = flock.gfx.scopeView(that.options.canvas, that.model.scope);
        
        that.gen = function (numSamps) {
            var spf = that.model.spf,
                bufIdx = that.model.bufIdx,
                buf = that.model.scope.values,
                i;
            
            for (i = 0; i < numSamps; i++) {
                buf[bufIdx] = that.inputs.source.output[i];
                bufIdx = bufIdx < spf ? bufIdx + 1 : 0;
            }
            that.model.bufIdx = bufIdx;
        };
        
        that.drawScope = function () {
            requestAnimationFrame(that.drawScope);
            that.scopeView.refreshView();
        };
        
        that.onInputChanged = function () {
            // Pass the "source" input directly back as the output from this ugen.
            that.output = that.inputs.source.output;
        };
        
        that.onInputChanged();
        that.drawScope();
        return that;
    };
    
    flock.ugen.amplitude = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        that.model.previousValue = 0.0;
        
        that.gen = function (numSamps) {
            var source = that.inputs.source.output,
                out = that.output,
                prevAtt = that.model.attackTime,
                nextAtt = that.inputs.attack.output[0],
                prevRel = that.model.releaseTime,
                nextRel = that.inputs.release.output[0],
                prevVal = that.model.previousValue,
                attCoef = that.model.attackCoef,
                relCoef = that.model.releaseCoef,
                i,
                val,
                coef;
                
                // Convert 60 dB attack and release times to coefficients if they've changed.
                if (nextAtt !== prevAtt) {
                    that.model.attackTime = nextAtt;
                    attCoef = that.model.attackCoef = 
                        nextAtt === 0.0 ? 0.0 : Math.exp(flock.LOG1 / (nextAtt * that.sampleRate));
                }
                
                if (nextRel != prevRel) {
                    that.model.releaseTime = nextRel;
                    relCoef = that.model.releaseCoef = 
                        (nextRel === 0.0) ? 0.0 : Math.exp(flock.LOG1 / (nextRel * that.sampleRate));
                }
            
            for (i = 0; i < numSamps; i++) {
                val = Math.abs(source[i]);
                coef = val < prevVal ? relCoef : attCoef;
                out[i] = prevVal = val + (prevVal - val) * coef;
            }
            
            that.model.previousValue = prevVal;
        };
        
        that.onInputChanged = function () {
            // Set default values if necessary for attack and release times.
            if (!that.inputs.attack) {
                that.inputs.attack = flock.ugen.value({value: 0.01}, new Float32Array(1));
            }
            
            if (!that.inputs.release) { 
                that.inputs.release = flock.ugen.value({value: 0.01}, new Float32Array(1));
            }
        };
        
        that.onInputChanged();
        return that;
    };
    
}());
