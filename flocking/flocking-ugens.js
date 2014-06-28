/*
* Flocking Unit Generators
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global require, Float32Array, Random*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery"),
        DSP = flock.requireModule("DSP", "dspapi"),
        Filter = flock.requireModule("Filter", "dspapi");

    /*************
     * Utilities *
     *************/

    // TODO: Check API; write unit tests.
    flock.aliasUGen = function (sourcePath, aliasName, inputDefaults, defaultOptions) {
        var root = flock.get(sourcePath);
        flock.set(root, aliasName, function (inputs, output, options) {
            options = $.extend(true, {}, defaultOptions, options);
            return root(inputs, output, options);
        });
        fluid.defaults(sourcePath + "." + aliasName, inputDefaults);
    };

    // TODO: Check API; write unit tests.
    flock.aliasUGens = function (sourcePath, aliasesSpec) {
        var aliasName,
            settings;

        for (aliasName in aliasesSpec) {
            settings = aliasesSpec[aliasName];
            flock.aliasUGen(sourcePath, aliasName, {inputs: settings.inputDefaults}, settings.options);
        }
    };

    flock.krMul = function (numSamps, output, mulInput) {
        var mul = mulInput.output[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul;
        }
    };

    flock.mul = function (numSamps, output, mulInput) {
        var mul = mulInput.output,
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i];
        }
    };

    flock.krAdd = function (numSamps, output, mulInput, addInput) {
        var add = addInput.output[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] + add;
        }
    };

    flock.add = function (numSamps, output, mulInput, addInput) {
        var add = addInput.output,
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] + add[i];
        }
    };

    flock.krMulAdd = function (numSamps, output, mulInput, addInput) {
        var mul = mulInput.output[0],
            add = addInput.output,
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul + add[i];
        }
    };

    flock.mulKrAdd = function (numSamps, output, mulInput, addInput) {
        var mul = mulInput.output,
            add = addInput.output[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i] + add;
        }
    };

    flock.krMulKrAdd = function (numSamps, output, mulInput, addInput) {
        var mul = mulInput.output[0],
            add = addInput.output[0],
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul + add;
        }
    };

    flock.mulAdd = function (numSamps, output, mulInput, addInput) {
        var mul = mulInput.output,
            add = addInput.output,
            i;
        for (i = 0; i < numSamps; i++) {
            output[i] = output[i] * mul[i] + add[i];
        }
    };

    flock.onMulAddInputChanged = function (that) {
        var mul = that.inputs.mul,
            add = that.inputs.add,
            fn;

        // If we have no mul or add inputs, bail immediately.
        if (!mul && !add) {
            that.mulAdd = fluid.identity;
            return;
        }

        if (!mul) { // Only add.
            fn = add.rate !== flock.rates.AUDIO ? flock.krAdd : flock.add;
        } else if (!add) { // Only mul.
            fn = mul.rate !== flock.rates.AUDIO ? flock.krMul : flock.mul;
        } else { // Both mul and add.
            fn = mul.rate !== flock.rates.AUDIO ?
                (add.rate !== flock.rates.AUDIO ? flock.krMulKrAdd : flock.krMulAdd) :
                (add.rate !== flock.rates.AUDIO ? flock.mulKrAdd : flock.mulAdd);
        }

        that.mulAdd = function (numSamps) {
            fn(numSamps, that.output, mul, add);
        };
    };

    /*******************
     * Unit Generators *
     *******************/

    flock.ugen = function (inputs, output, options) {
        options = options || {};

        var that = {
            rate: options.rate || flock.rates.AUDIO,
            inputs: inputs,
            output: output,
            options: options,
            model: options.model || {},
            multiInputs: {},
            tags: ["flock.ugen"]
        };

        that.get = function (path) {
            return flock.input.get(that.inputs, path);
        };

        /**
         * Sets the value of the input at the specified path.
         *
         * @param {String} path the inputs's path relative to this ugen
         * @param {Number || UGenDef} val a scalar value (for Value ugens) or a UGenDef object
         * @return {UGen} the newly-created UGen that was set at the specified path
         */
        that.set = function (path, val) {
            return flock.input.set(that.inputs, path, val, that, function (ugenDef) {
                if (ugenDef === null || ugenDef === undefined) {
                    return;
                }

                return flock.parse.ugenDef(ugenDef, {
                    audioSettings: that.options.audioSettings,
                    buses: that.options.audioSettings.buses,
                    buffers: that.options.audioSettings.buffers
                });
            });
        };

        /**
         * Gets or sets the named unit generator input.
         *
         * @param {String} path the input path
         * @param {UGenDef} val [optional] a scalar value, ugenDef, or array of ugenDefs that will be assigned to the specified input name
         * @return {Number|UGen} a scalar value in the case of a value ugen, otherwise the ugen itself
         */
        that.input = function (path, val) {
            return !path ? undefined : typeof (path) === "string" ?
                arguments.length < 2 ? that.get(path) : that.set(path, val) :
                flock.isIterable(path) ? that.get(path) : that.set(path, val);
        };

        // TODO: Move this into a grade.
        that.calculateStrides = function () {
            var m = that.model,
                strideNames = that.options.strideInputs,
                inputs = that.inputs,
                i,
                name;

            m.strides = m.strides || {};

            for (i = 0; i < strideNames.length; i++) {
                name = strideNames[i];
                m.strides[name] = inputs[name].rate === flock.rates.AUDIO ? 1 : 0;
            }
        };

        that.collectMultiInputs = function () {
            var multiInputNames = that.options.multiInputNames,
                multiInputs = that.multiInputs,
                i,
                inputName,
                inputChannelCache,
                input;

            for (i = 0; i < multiInputNames.length; i++) {
                inputName = multiInputNames[i];
                inputChannelCache = multiInputs[inputName];

                if (!inputChannelCache) {
                    inputChannelCache = multiInputs[inputName] = [];
                } else {
                    // Clear the current array of buffers.
                    inputChannelCache.length = 0;
                }

                input = that.inputs[inputName];
                flock.ugen.collectMultiInputs(input, inputChannelCache);
            }
        };

        // Base onInputChanged() implementation.
        that.onInputChanged = function (inputName) {
            var multiInputNames = that.options.multiInputNames;

            flock.onMulAddInputChanged(that);
            if (that.options.strideInputs) {
                that.calculateStrides();
            }

            if (multiInputNames && (!inputName || multiInputNames.indexOf(inputName))) {
                that.collectMultiInputs();
            }
        };

        that.init = function () {
            var tags = fluid.makeArray(that.options.tags),
                m = that.model,
                o = that.options,
                i,
                s,
                valueDef;

            for (i = 0; i < tags.length; i++) {
                that.tags.push(tags[i]);
            }

            s = o.audioSettings = o.audioSettings || flock.enviro.shared.audioSettings;
            m.sampleRate = o.sampleRate || s.rates[that.rate];
            m.nyquistRate = m.sampleRate;
            m.blockSize = that.rate === flock.rates.AUDIO ? s.blockSize : 1;
            m.sampleDur = 1.0 / m.sampleRate;

            // Assigns an interpolator function to the UGen.
            // This is inactive by default, but can be used in custom gen() functions.
            // Will be undefined if no interpolation default or option has been set,
            // or if it is set to "none"--make sure you check before invoking it.
            that.interpolate = flock.interpolate[o.interpolation];

            if (that.rate === flock.rates.DEMAND && that.inputs.freq) {
                valueDef = flock.parse.ugenDefForConstantValue(1.0);
                that.inputs.freq = flock.parse.ugenDef(valueDef);
            }
        };

        that.init();
        return that;
    };

    // The term "multi input" is a bit ambiguous,
    // but it provides a very light (and possibly poor) abstraction for two different cases:
    //   1. inputs that consist of an array of multiple unit generators
    //   2. inputs that consist of a single unit generator that has multiple ouput channels
    // In either case, each channel of each input unit generator will be gathered up into
    // an array of "proxy ugen" objects and keyed by the input name, making easy to iterate
    // over sources of input quickly.
    // A proxy ugen consists of a simple object conforming to this contract:
    //   {rate: <rate of parent ugen>, output: <Float32Array>}
    flock.ugen.collectMultiInputs = function (inputs, inputChannelCache) {
        if (!flock.isIterable(inputs)) {
            inputs = inputs = fluid.makeArray(inputs);
        }

        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            flock.ugen.collectChannelsForInput(input, inputChannelCache);
        }

        return inputChannelCache;
    };

    flock.ugen.collectChannelsForInput = function (input, inputChannelCache) {
        var isMulti = flock.hasTag(input, "flock.ugen.multiChannelOutput"),
            channels = isMulti ? input.output : [input.output],
            i;

        for (i = 0; i < channels.length; i++) {
            inputChannelCache.push({
                rate: input.rate,
                output: channels[i]
            });
        }

        return inputChannelCache;
    };


    flock.ugen.value = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.dynamicGen = function (numSamps) {
            var out = that.output,
                m = that.model;

            for (var i = 0; i < numSamps; i++) {
                out[i] = m.value;
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            var inputs = that.inputs,
                m = that.model;

            m.value = inputs.value;

            if (that.rate !== "constant") {
                that.gen = that.dynamicGen;
            } else {
                that.gen = undefined;
            }

            flock.onMulAddInputChanged(that);
            that.dynamicGen(1);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.value", {
        rate: "control",

        inputs: {
            value: 1.0,
            mul: null,
            add: null
        },

        ugenOptions: {
            tags: ["flock.ugen.valueType"]
        }
    });


    flock.ugen.passThrough = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var source = that.inputs.source.output,
                out = that.output,
                i;

            for (i = 0; i < source.length; i++) {
                out[i] = source[i];
            }

            for (; i < numSamps; i++) {
                out[i] = 0.0;

            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.passThrough", {
        rate: "audio",

        inputs: {
            source: null,
            mul: null,
            add: null
        }
    });

    flock.ugen.valueChangeTrigger = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                source = that.inputs.source.output,
                out = that.output,
                i,
                j,
                val;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.source) {
                val = source[j];
                out[i] = val !== m.prevVal ? 1.0 : 0.0;
                m.prevVal = val;
            }
        };

        that.onInputChanged = function (inputName) {
            that.calculateStrides();

            if (inputName === "source") {
                // Force a trigger to be output whenever the input is changed,
                // even if it's the same value as was previously held.
                that.model.prevVal = null;
            }
        };

        that.calculateStrides();
        return that;
    };

    fluid.defaults("flock.ugen.valueChangeTrigger", {
        rate: "control",

        inputs: {
            source: 0.0
        },
        ugenOptions: {
            model: {
                prevVal: 0.0
            },

            strideInputs: ["source"]
        }
    });


    flock.ugen.inputChangeTrigger = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                source = that.inputs.source.output,
                sourceInc = m.strides.source,
                duration = that.inputs.duration.output,
                durationInc = m.strides.duration,
                prevDur = m.prevDur,
                out = that.output,
                i,
                j,
                k,
                val,
                dur;

            for (i = j = k = 0; i < numSamps; i++, j += sourceInc, k += durationInc) {
                val = source[j];
                dur = duration[k];

                if (dur !== prevDur) {
                    m.prevDur = dur;
                    m.remainingOpenSamples = val > 0 ? (dur > 0 ? m.sampleRate * dur : 1) : 0;
                }

                if (m.remainingOpenSamples > 0) {
                    out[i] = val;
                    m.remainingOpenSamples--;
                } else {
                    out[i] = 0.0;
                }
            }
        };

        that.onInputChanged = function (inputName) {
            that.calculateStrides();

            if (inputName === "source") {
                that.model.prevDur = null;
            }
        };

        that.calculateStrides();
        return that;
    };

    fluid.defaults("flock.ugen.inputChangeTrigger", {
        rate: "control",

        inputs: {
            source: 0,
            duration: 0
        },

        ugenOptions: {
            model: {
                prevDuration: 0,
                remainingOpenSamples: 0
            },

            strideInputs: ["source", "duration"]
        }
    });

    flock.ugen.triggerCallback = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                o = that.options,
                out = that.output,
                inputs = that.inputs,
                triggerInc = m.strides.trigger,
                sourceInc = m.strides.source,
                trig = inputs.trigger.output,
                source = inputs.source.output,
                cbSpec = o.callback,
                fn = cbSpec.func,
                args = cbSpec.args,
                cbThis = cbSpec.this,
                lastArgIdx = m.lastArgIdx,
                prevTrig = m.prevTrig,
                i,
                j,
                k,
                currTrig,
                sourceVal;

            for (i = j = k = 0; i < numSamps; i++, j += triggerInc, k += sourceInc) {
                currTrig = trig[j];
                sourceVal = source[k];

                if (currTrig > 0.0 && prevTrig <= 0.0 && fn) {
                    // Insert the current source value into the arguments list
                    // and then invoke the specified callback function.
                    args[lastArgIdx] = sourceVal;
                    fn.apply(cbThis, args);
                }

                out[i] = sourceVal;
                prevTrig = currTrig;
            }

            m.prevTrig = prevTrig;
        };

        that.onInputChanged = function () {
            var o = that.options,
                m = that.model,
                cbSpec = o.callback,
                funcName = cbSpec.funcName;

            if (funcName) {
                cbSpec.func = fluid.getGlobalValue(funcName);
            } else if (cbSpec.this && cbSpec.method) {
                if (typeof cbSpec.this !== "string") {
                    throw new Error("flock.ugen.triggerCallback doesn't support raw 'this' objects." +
                        "Use a global key path instead.");
                }
                cbSpec.this = typeof cbSpec.this === "string" ?
                    fluid.getGlobalValue(cbSpec.this) : cbSpec.this;
                cbSpec.func = fluid.get(cbSpec.this, cbSpec.method);
            }

            m.lastArgIdx = cbSpec.args.length;
            that.calculateStrides();
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.triggerCallback", {
        rate: "audio",
        inputs: {
            source: 0,
            trigger: 0
        },
        ugenOptions: {
            model: {
                funcName: undefined,
                lastArgIdx: 0
            },
            callback: {
                "this": undefined,
                method: undefined,
                func: undefined,
                args: []
            },
            strideInputs: ["source", "trigger"]
        }
    });

    flock.ugen.math = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        that.expandedSource = new Float32Array(that.options.audioSettings.blockSize);

        that.krSourceKrInputGen = function () {
            var op = that.activeInput,
                input = that.inputs[op],
                sourceBuf = flock.generate(that.expandedSource, that.inputs.source.output[0]);
            DSP[op](that.output, sourceBuf, input.output[0]);
        };

        that.krSourceArInputGen = function () {
            var op = that.activeInput,
                input = that.inputs[op],
                sourceBuf = flock.generate(that.expandedSource, that.inputs.source.output[0]);
            DSP[op](that.output, sourceBuf, input.output);
        };

        that.arSourceKrInputGen = function () {
            var op = that.activeInput,
                input = that.inputs[op],
                sourceBuf = that.inputs.source.output;
            DSP[op](that.output, sourceBuf, input.output[0]);
        };

        that.arSourceArInputGen = function () {
            var op = that.activeInput,
                input = that.inputs[op];
            DSP[op](that.output, that.inputs.source.output, input.output);
        };

        that.onInputChanged = function () {
            // Find the first input and use it. Multiple inputters, beware.
            // TODO: Support multiple operations.
            var inputs = Object.keys(that.inputs),
                i,
                input,
                isInputAudioRate;

            for (i = 0; i < inputs.length; i++) {
                input = inputs[i];
                if (input !== "source") {
                    that.activeInput = input;
                    isInputAudioRate = that.inputs[input].rate === "audio";
                    that.gen = that.inputs.source.rate === "audio" ?
                        (isInputAudioRate ? that.arSourceArInputGen : that.arSourceKrInputGen) :
                        (isInputAudioRate ? that.krSourceArInputGen : that.krSourceKrInputGen);
                    break;
                }
            }
        };

        that.init = function () {
            if (typeof (DSP) === "undefined") {
                throw new Error("DSP is undefined. Please include dspapi.js to use the flock.math unit generator.");
            }
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.math", {
        rate: "audio",
        inputs: {
            // Any Web Array Math operator is supported as an input.
            source: null
        }
    });


    flock.ugen.sum = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.copyGen = function (numSamps) {
            var out = that.output,
                source = that.inputs.sources.output,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = source[i];
            }
        };

        that.sumGen = function (numSamps) {
            var sources = that.inputs.sources,
                out = that.output,
                i,
                sourceIdx,
                sum;

            for (i = 0; i < numSamps; i++) {
                sum = 0;
                for (sourceIdx = 0; sourceIdx < sources.length; sourceIdx++) {
                    sum += sources[sourceIdx].output[i];
                }
                out[i] = sum;
            }
        };

        that.onInputChanged = function () {
            if (typeof (that.inputs.sources.length) === "number") {
                // We have an array of sources that need to be summed.
                that.gen = that.sumGen;
            } else {
                that.gen = that.copyGen;
            }
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.sum", {
        rate: "audio",
        inputs: {
            sources: null
        }
    });


    /***************
     * Oscillators *
     ***************/

    flock.ugen.osc = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                freq = inputs.freq.output,
                phaseOffset = inputs.phase.output,
                table = inputs.table,
                tableLen = m.tableLen,
                tableIncHz = m.tableIncHz,
                tableIncRad = m.tableIncRad,
                out = that.output,
                phase = m.phase,
                i,
                j,
                k,
                idx;

            for (i = 0, j = 0, k = 0; i < numSamps; i++, j += m.strides.phase, k += m.strides.freq) {
                idx = phase + phaseOffset[j] * tableIncRad;
                if (idx >= tableLen) {
                    idx -= tableLen;
                } else if (idx < 0) {
                    idx += tableLen;
                }
                out[i] = that.interpolate ? that.interpolate(idx, table) : table[idx | 0];
                phase += freq[k] * tableIncHz;
                if (phase >= tableLen) {
                    phase -= tableLen;
                } else if (phase < 0) {
                    phase += tableLen;
                }
            }

            m.phase = phase;
            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            flock.ugen.osc.onInputChanged(that);

            // Precalculate table-related values.
            var m = that.model;
            m.tableLen = that.inputs.table.length;
            m.tableIncHz = m.tableLen / m.sampleRate;
            m.tableIncRad =  m.tableLen / flock.TWOPI;
        };

        that.onInputChanged();
        return that;
    };

    flock.ugen.osc.onInputChanged = function (that) {
        that.calculateStrides();
        flock.onMulAddInputChanged(that);
    };

    fluid.defaults("flock.ugen.osc", {
        rate: "audio",
        inputs: {
            freq: 440.0,
            phase: 0.0,
            table: null,
            mul: null,
            add: null
        },
        ugenOptions: {
            interpolation: "linear",
            model: {
                phase: 0
            },
            strideInputs: [
                "freq",
                "phase"
            ]
        },
        tableSize: 8192
    });

    flock.ugen.osc.define = function (name, tableFillFn) {
        var lastSegIdx = name.lastIndexOf("."),
            namespace = name.substring(0, lastSegIdx),
            oscName = name.substring(lastSegIdx + 1),
            namespaceObj = flock.get(namespace);

        namespaceObj[oscName] = function (inputs, output, options) {
            // TODO: Awkward options pre-merging. Refactor osc API.
            var defaults = fluid.defaults("flock.ugen.osc"),
                merged = fluid.merge(null, defaults, options),
                s = merged.tableSize;
            inputs.table = tableFillFn(s, flock.TWOPI / s);
            return flock.ugen.osc(inputs, output, options);
        };

        fluid.defaults(name, fluid.defaults("flock.ugen.osc"));
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
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                freq = that.inputs.freq.output,
                phaseOffset = that.inputs.phase.output,
                out = that.output,
                phase = m.phase,
                sampleRate = m.sampleRate,
                i,
                j,
                k;

            for (i = 0, j = 0, k = 0; i < numSamps; i++, j += m.strides.phase, k += m.strides.freq) {
                out[i] = Math.sin(phase + phaseOffset[j]);
                phase += freq[k] / sampleRate * flock.TWOPI;
            }

            m.phase = phase;
            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            flock.ugen.osc.onInputChanged(that);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.sin", {
        rate: "audio",
        inputs: {
            freq: 440.0,
            phase: 0.0,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                phase: 0
            },
            strideInputs: [
                "freq",
                "phase"
            ]
        }
    });


    flock.ugen.lfSaw = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                freq = that.inputs.freq.output,
                out = that.output,
                scale = m.scale,
                phaseOffset = that.inputs.phase.output[0], // Phase is control rate
                phase = m.phase, // TODO: Prime synth graph on instantiation.
                i,
                j;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.freq) {
                out[i] = phase + phaseOffset;
                phase += freq[j] * scale;
                if (phase >= 1.0) {
                    phase -= 2.0;
                } else if (phase <= -1.0) {
                    phase += 2.0;
                }
            }

            m.phase = phase;
            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            var m = that.model;
            m.freqInc = that.inputs.freq.rate === flock.rates.AUDIO ? 1 : 0;
            m.phase = 0.0;
            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            that.model.scale = 2 * (1 / that.options.sampleRate);
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.lfSaw", {
        rate: "audio",
        inputs: {
            freq: 440,
            phase: 0.0,
            mul: null,
            add: null
        },
        ugenOptions: {
            strideInputs: ["freq"]
        }
    });


    flock.ugen.lfPulse = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var inputs = that.inputs,
                m = that.model,
                freq = inputs.freq.output,
                freqInc = m.freqInc,
                width = inputs.width.output[0], // TODO: Are we handling width correctly here?
                out = that.output,
                scale = m.scale,
                phase = m.phase !== undefined ? m.phase : inputs.phase.output[0], // TODO: Unnecessary if we knew the synth graph had been primed.
                i,
                j;

            for (i = 0, j = 0; i < numSamps; i++, j += freqInc) {
                if (phase >= 1.0) {
                    phase -= 1.0;
                    out[i] = width < 0.5 ? 1.0 : -1.0;
                } else {
                    out[i] = phase < width ? 1.0 : -1.0;
                }
                phase += freq[j] * scale;
            }

            m.phase = phase;
            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            that.model.freqInc = that.inputs.freq.rate === flock.rates.AUDIO ? 1 : 0;
            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            that.model.scale = 1 / that.options.sampleRate;
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.lfPulse", {
        rate: "audio",
        inputs: {
            freq: 440,
            phase: 0.0,
            width: 0.5,
            mul: null,
            add: null
        }
    });


    flock.ugen.impulse = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var inputs = that.inputs,
                m = that.model,
                out = that.output,
                freq = inputs.freq.output,
                freqInc = m.strides.freq,
                phaseOffset = inputs.phase.output[0],
                phase = m.phase,
                scale = m.scale,
                i,
                j,
                val;

            phase += phaseOffset;

            for (i = 0, j = 0; i < numSamps; i++, j += freqInc) {
                if (phase >= 1.0) {
                    phase -= 1.0;
                    val = 1.0;
                } else {
                    val = 0.0;
                }
                out[i] = val;
                phase += freq[j] * scale;
            }

            m.phase = phase - phaseOffset;
            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            that.model.scale = 1.0 / that.model.sampleRate;
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.impulse", {
        rate: "audio",
        inputs: {
            freq: 440,
            phase: 0.0,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                phase: 0.0
            },
            strideInputs: ["freq"]
        }
    });


    flock.ugen.t2a = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function () {
            var m = that.model,
                trig = that.inputs.source.output[0],
                offset = that.inputs.offset.output[0] | 0,
                out = that.output;

            // Clear the output buffer.
            for (var i = 0; i < out.length; i++) {
                out[i] = 0.0;
            }

            // Write the trigger value to the audio stream if it's open.
            if (trig > 0.0 && m.prevTrig <= 0.0) {
                out[offset] = trig;
            }

            m.prevTrig = trig;
        };

        return that;
    };

    fluid.defaults("flock.ugen.t2a", {
        rate: "audio",
        inputs: {
            source: null,
            offset: 0
        },
        ugenOptions: {
            model: {
                prevTrig: 0.0
            }
        }
    });


    flock.ugen.latch = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.arGen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                source = inputs.source.output,
                trig = inputs.trigger,
                sourceInc = m.strides.source,
                out = that.output,
                i, j,
                currTrig;

            if (m.holdVal === undefined) {
                m.holdVal = source[0];
            }

            for (i = 0, j = 0; i < numSamps; i++, j += sourceInc) {
                currTrig = trig.output[i];
                out[i] = (currTrig > 0.0 && m.prevTrig <= 0.0) ? m.holdVal = source[j] : m.holdVal;
                m.prevTrig = currTrig;
            }

            that.mulAdd(numSamps);
        };

        that.krGen = function (numSamps) {
            var m = that.model,
                currTrig = that.inputs.trigger.output[0],
                i;

            if (m.holdVal === undefined || currTrig > 0.0 && m.prevTrig <= 0.0) {
                m.holdVal = that.inputs.source.output[0];
            }
            m.prevTrig = currTrig;

            for (i = 0; i < numSamps; i++) {
                that.output[i] = m.holdVal;
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            that.calculateStrides();
            that.gen = that.inputs.trigger.rate === flock.rates.AUDIO ? that.arGen : that.krGen;
            flock.onMulAddInputChanged(that);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.latch", {
        rate: "audio",
        inputs: {
            source: null,
            trigger: 0.0,
            mul: null,
            add: null
        },
        ugenOptions: {
            strideInputs: ["source"],
            model: {
                prevTrig: 0.0
            }
        }
    });


    /****************
     * Buffer UGens *
     ****************/

    /**
     * Mixes buffer-related functionality into a unit generator.
     */
    flock.ugen.buffer = function (that) {
        that.onBufferInputChanged = function (inputName) {
            var m = that.model,
                inputs = that.inputs;

            if (m.bufDef !== inputs.buffer || inputName === "buffer") {
                m.bufDef = inputs.buffer;
                flock.parse.bufferForDef(m.bufDef, that, flock.enviro.shared); // TODO: Shared enviro reference.
            }
        };

        that.setBuffer = function (bufDesc) {
            that.buffer = bufDesc;
            if (that.onBufferReady) {
                that.onBufferReady(bufDesc);
            }
        };

        that.initBuffer = function () {
            // Start with a zeroed buffer, since the buffer input may be loaded asynchronously.
            that.buffer = that.model.bufDef = flock.bufferDesc({
                format: {
                    sampleRate: that.options.audioSettings.rates.audio
                },
                data: {
                    channels: [new Float32Array(that.output.length)]
                }
            });
        };
    };


    flock.ugen.playBuffer = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        // Optimized gen function for constant regular-speed playback.
        that.crRegularSpeedGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                chan = that.inputs.channel.output[0],
                source = that.buffer.data.channels[chan],
                trig = inputs.trigger.output,
                bufIdx = m.idx,
                bufLen = source.length,
                loop = that.inputs.loop.output[0],
                start = (that.inputs.start.output[0] * bufLen) | 0,
                end = (that.inputs.end.output[0] * bufLen) | 0,
                i,
                j,
                samp;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.trigger) {
                if (trig[j] > 0.0 && m.prevTrig <= 0.0) {
                    bufIdx = start;
                } else if (bufIdx >= end) {
                    if (loop > 0) {
                        bufIdx = start;
                    } else {
                        out[i] = 0.0;
                        continue;
                    }
                }
                m.prevTrig = trig[j];

                samp = that.interpolate ? that.interpolate(bufIdx, source) : source[bufIdx | 0];
                out[i] = samp;
                bufIdx += m.stepSize;
            }

            m.idx = bufIdx;

            that.mulAdd(numSamps);
        };

        that.krSpeedGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                chan = that.inputs.channel.output[0],
                speedInc = that.inputs.speed.output[0],
                source = that.buffer.data.channels[chan],
                trig = inputs.trigger.output,
                bufIdx = m.idx,
                bufLen = source.length,
                loop = that.inputs.loop.output[0],
                start = (that.inputs.start.output[0] * bufLen) | 0,
                end = (that.inputs.end.output[0] * bufLen) | 0,
                i,
                j,
                samp;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.trigger) {
                if (trig[j] > 0.0 && m.prevTrig <= 0.0) {
                    bufIdx = start;
                } else if (bufIdx >= end) {
                    if (loop > 0) {
                        bufIdx = start;
                    } else {
                        out[i] = 0.0;
                        continue;
                    }
                }
                m.prevTrig = trig[j];

                samp = that.interpolate ? that.interpolate(bufIdx, source) : source[bufIdx | 0];
                out[i] = samp;
                bufIdx += m.stepSize * speedInc;
            }

            m.idx = bufIdx;
            that.mulAdd(numSamps);
        };

        that.onInputChanged = function (inputName) {
            var inputs = that.inputs,
                speed = inputs.speed;

            that.onBufferInputChanged(inputName);

            // TODO: Optimize for non-regular speed constant rate input.
            that.gen = (speed.rate === flock.rates.CONSTANT && speed.output[0] === 1.0) ?
                that.crRegularSpeedGen : that.krSpeedGen;

            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.onBufferReady = function () {
            var m = that.model,
                end = that.inputs.end.output[0],
                chan = that.inputs.channel.output[0],
                buf = that.buffer.data.channels[chan];

            m.idx = (end * buf.length) | 0;
            m.stepSize = that.buffer.format.sampleRate / m.sampleRate;
        };

        that.init = function () {
            flock.ugen.buffer(that);
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.playBuffer", {
        rate: "audio",
        inputs: {
            channel: 0,
            loop: 0.0,
            speed: 1.0,
            start: 0.0,
            end: 1.0,
            trigger: 1.0,
            buffer: null,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                idx: 0,
                stepSize: 0,
                prevTrig: 0,
                channel: undefined
            },
            strideInputs: [
                "trigger"
            ],
            interpolation: "linear"
        }
    });

    /**
     * Reads values out of a buffer at the specified phase index.
     * This unit generator is typically used with flock.ugen.phasor or similar unit generator to
     * scan through the buffer at a particular rate.
     *
     * Inputs:
     *  - buffer: a bufDef representing the buffer to read from
     *  - channel: the channel of the buffer to read from
     *  - phase: the phase of the buffer to read (this should be a value between 0..1)
     */
    // TODO: This should be refactored based on the model of bufferPhaseStep below.
    flock.ugen.readBuffer = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                phaseS = m.strides.phase,
                out = that.output,
                chan = that.inputs.channel.output[0],
                phase = that.inputs.phase.output,
                source = that.buffer.data.channels[chan],
                sourceLen = source.length,
                i,
                bufIdx,
                j,
                val;

            for (i = j = 0; i < numSamps; i++, j += phaseS) {
                bufIdx = phase[j] * sourceLen;
                val = that.interpolate ? that.interpolate(bufIdx, source) : source[bufIdx | 0];
                out[i] = val;
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            flock.ugen.buffer(that);
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.readBuffer", {
        rate: "audio",

        inputs: {
            buffer: null,
            channel: 0,
            phase: 0,
            mul: null,
            add: null
        },

        ugenOptions: {
            model: {
                channel: undefined
            },
            strideInputs: [
                "phase"
            ],
            interpolation: "linear"
        }
    });

    /**
     * Outputs the duration of the specified buffer. Runs at either constant or control rate.
     * Use control rate only when the underlying buffer may change dynamically.
     *
     * Inputs:
     *  buffer: a bufDef object specifying the buffer to track
     */
    flock.ugen.bufferDuration = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.krGen = function (numSamps) {
            var m = that.model,
                chan = that.inputs.channel.output[0],
                source = that.buffer.data.channels[chan],
                rate = that.buffer.format.sampleRate,
                i;

            for (i = 0; i < numSamps; i++) {
                that.output[i] = m.value = source.length / rate;
            }
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
        };

        that.onBufferReady = function (buffer) {
            var chan = that.inputs.channel.output[0];
            that.output[0] = that.model.value = buffer.data.channels[chan].length / that.buffer.format.sampleRate;
        };

        that.init = function () {
            var r = that.rate;
            that.gen = (r === flock.rates.CONTROL || r === flock.rates.AUDIO) ? that.krGen : undefined;
            that.output[0] = that.model.value = 0.0;
            flock.ugen.buffer(that);
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.bufferDuration", {
        rate: "constant",
        inputs: {
            buffer: null,
            channel: 0
        },
        ugenOptions: {
            model: {
                value: 0.0
            }
        }
    });

    /**
     * Outputs the length of the specified buffer in samples. Runs at either constant or control rate.
     * Use control rate only when the underlying buffer may change dynamically.
     *
     * Inputs:
     *  buffer: a bufDef object specifying the buffer to track
     */
    flock.ugen.bufferLength = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.krGen = function (numSamps) {
            var m = that.model,
                chan = that.inputs.channel.output[0],
                source = that.buffer.data.channels[chan],
                i;

            for (i = 0; i < numSamps; i++) {
                that.output[i] = m.value = source.length;
            }
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
        };

        that.onBufferReady = function (buffer) {
            var chan = that.inputs.channel.output[0];
            that.output[0] = that.model.value = buffer.data.channels[chan].length;
        };

        that.init = function () {
            var r = that.rate;
            that.gen = (r === flock.rates.CONTROL || r === flock.rates.AUDIO) ? that.krGen : undefined;
            that.output[0] = that.model.value = 0.0;
            flock.ugen.buffer(that);
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.bufferLength", {
        rate: "constant",
        inputs: {
            buffer: null,
            channel: 0
        },
        ugenOptions: {
            model: {
                value: 0.0
            }
        }
    });

    /**
     * Outputs a phase step value for playing the specified buffer at its normal playback rate.
     * This unit generator takes into account any differences betwee the sound file's sample rate and
     * the environment's audio rate.
     *
     * Inputs:
     *  buffer: a bufDef object specifying the buffer to track
     */
    flock.ugen.bufferPhaseStep = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.krGen = function (numSamps) {
            var out = that.output,
                val = that.model.value,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = val;
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
            flock.onMulAddInputChanged(that);
        };

        that.onBufferReady = function (buffer) {
            var m = that.model,
                chan = that.inputs.channel.output[0],
                source = buffer.data.channels[chan],
                enviroRate = that.options.audioSettings.rates.audio,
                bufferRate = that.buffer.format.sampleRate || enviroRate;

            m.scale = bufferRate / enviroRate;
            that.output[0] = m.value = 1 / (source.length * m.scale);
        };

        that.init = function () {
            var r = that.rate;
            that.gen = (r === flock.rates.CONTROL || r === flock.rates.AUDIO) ? that.krGen : undefined;
            that.output[0] = that.model.value = 0.0;
            flock.ugen.buffer(that);
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.bufferPhaseStep", {
        rate: "constant",
        inputs: {
            buffer: null,
            channel: 0
        },
        ugenOptions: {
            model: {
                scale: 1,
                value: 0
            }
        }
    });

    /**
     * Constant-rate unit generator that outputs the environment's current audio sample rate.
     */
    flock.ugen.sampleRate = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        that.output[0] = that.options.audioSettings.rates.audio;
        return that;
    };

    fluid.defaults("flock.ugen.sampleRate", {
        rate: "constant",
        inputs: {}
    });


    /*********
     * Noise *
     *********/

    flock.ugen.dust = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                density = inputs.density.output[0], // Density is kr.
                threshold,
                scale,
                val,
                i;

            if (density !== m.density) {
                m.density = density;
                threshold = m.threshold = density * m.sampleDur;
                scale = m.scale = threshold > 0.0 ? 1.0 / threshold : 0.0;
            } else {
                threshold = m.threshold;
                scale = m.scale;
            }

            for (i = 0; i < numSamps; i++) {
                val = Math.random();
                output[i] = (val < threshold) ? val * scale : 0.0;
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.dust", {
        rate: "audio",
        inputs: {
            density: 1.0,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                density: 0.0,
                scale: 0.0,
                threshold: 0.0
            }
        }
    });


    flock.ugen.whiteNoise = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var out = that.output,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = Math.random();
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.whiteNoise", {
        rate: "audio",
        inputs: {
            mul: null,
            add: null
        }
    });


    /**
     * Implements Larry Tramiel's first Pink Noise algorithm
     * described at http://home.earthlink.net/~ltrammell/tech/pinkalg.htm,
     * based on a version by David Lowenfels posted to musicdsp:
     * http://www.musicdsp.org/showone.php?id=220.
     */
    flock.ugen.pinkNoise = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var state = that.model.state,
                a = that.a,
                p = that.p,
                offset = that.model.offset,
                out = that.output,
                i,
                j,
                rand,
                val;

            for (i = 0; i < numSamps; i++) {
                val = 0;
                for (j = 0; j < state.length; j++) {
                    rand = Math.random();
                    state[j] = p[j] * (state[j] - rand) + rand;
                    val += a[j] * state[j];
                }
                out[i] = val * 2 - offset;
            }

            that.mulAdd(numSamps);
        };

        that.init = function () {
            that.a = new Float32Array(that.options.coeffs.a);
            that.p = new Float32Array(that.options.coeffs.p);
            that.model.state = new Float32Array(that.a.length);

            for (var i = 0; i < that.a.length; i++) {
                that.model.offset += that.a[i];
            }

            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.pinkNoise", {
        rate: "audio",
        inputs: {
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                offset: 0
            },
            coeffs: {
                a: [0.02109238, 0.07113478, 0.68873558],
                p: [0.3190, 0.7756, 0.9613]
            }
        }
    });

    flock.ugen.lfNoise = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                freq = inputs.freq.output[0], // Freq is kr.
                remain = numSamps,
                out = that.output,
                currSamp = 0,
                sampsForLevel,
                i;

            freq = freq > 0.001 ? freq : 0.001;
            do {
                if (m.counter <= 0) {
                    m.counter = m.sampleRate / freq;
                    m.counter = m.counter > 1 ? m.counter : 1;
                    if (that.options.interpolation === "linear") {
                        m.start = m.value = m.end;
                        m.end = Math.random();
                        m.ramp = m.ramp = (m.end - m.start) / m.counter;
                    } else {
                        m.start = m.value = Math.random();
                        m.ramp = 0;
                    }
                }
                sampsForLevel = remain < m.counter ? remain : m.counter;
                remain -= sampsForLevel;
                m.counter -= sampsForLevel;
                for (i = 0; i < sampsForLevel; i++) {
                    out[currSamp] = m.value;
                    m.value += m.ramp;
                    currSamp++;
                }

            } while (remain);

            that.mulAdd(numSamps);
        };

        that.input = function () {
            that.model.end = Math.random();
            that.onInputChanged();
        };

        that.input();
        return that;
    };

    fluid.defaults("flock.ugen.lfNoise", {
        rate: "audio",
        inputs: {
            freq: 440,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                counter: 0,
                level: 0
            }
        }
    });

    /*****************************************************
     * Random distributions using Sim.js' Random library *
     *****************************************************/

    // TODO: Unit tests.
    flock.ugen.random = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var generator = that.generator,
                out = that.output,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = generator.uniform(-1, 1);
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function (inputName) {
            if (inputName === "seed") {
                that.initGenerator();
            }
            flock.onMulAddInputChanged(that);
        };

        that.initGenerator = function () {
            var seed = that.inputs.seed;
            that.generator = seed ? new Random(seed) : new Random();
        };

        that.init = function () {
            that.initGenerator();
            that.calculateStrides();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.random", {
        rate: "audio",
        inputs: {
            seed: null,
            mul: null,
            add: null
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.exponential = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var generator = that.generator,
                out = that.output,
                lambda = that.inputs.lambda.output,
                lambdaInc = that.model.strides.lambda,
                i,
                j;

            for (i = j = 0; i < numSamps; i++, j += lambdaInc) {
                out[i] = generator.exponential(lambda[j]);
            }

            that.mulAdd(numSamps);
        };

        return that;
    };

    fluid.defaults("flock.ugen.random.exponential", {
        rate: "audio",
        inputs: {
            seed: null,
            lambda: 1,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["lambda"]
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.gamma = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                generator = that.generator,
                out = that.output,
                alphaInc = m.strides.alpha,
                alpha = inputs.alpha.output,
                betaInc = m.strides.beta,
                beta = inputs.beta.output,
                i,
                j,
                k;

            for (i = j = k = 0; i < numSamps; i++, j += alphaInc, k += betaInc) {
                out[i] = generator.gamma(alpha[j], beta[k]);
            }

            that.mulAdd(numSamps);
        };

        return that;
    };

    fluid.defaults("flock.ugen.random.gamma", {
        rate: "audio",
        inputs: {
            seed: null,
            alpha: 1,
            beta: 2,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["alpha", "beta"]
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.normal = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                inputs = that.inputs,
                generator = that.generator,
                muInc = m.strides.mu,
                mu = inputs.mu.output,
                sigmaInc = m.strides.sigma,
                sigma = inputs.sigma.output,
                i,
                j,
                k;

            for (i = j = k = 0; i < numSamps; i++, j += muInc, k += sigmaInc) {
                out[i] = generator.normal(mu[j], sigma[k]);
            }

            that.mulAdd(numSamps);
        };

        return that;
    };

    fluid.defaults("flock.ugen.random.normal", {
        rate: "audio",
        inputs: {
            seed: null,
            mu: 0,
            sigma: 1,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["mu", "sigma"]
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.pareto = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var generator = that.generator,
                out = that.output,
                alphaInc = that.model.strides.alpha,
                alpha = that.inputs.alpha.output,
                i,
                j;

            for (i = j = 0; i < numSamps; i++, j += alphaInc) {
                out[i] = generator.pareto(alpha[j]);
            }

            that.mulAdd(numSamps);
        };

        return that;
    };

    fluid.defaults("flock.ugen.random.pareto", {
        rate: "audio",
        inputs: {
            seed: null,
            alpha: 5,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["alpha"]
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.triangular = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var generator = that.generator,
                out = that.output,
                modeInc = that.model.strides.mode,
                mode = that.inputs.mode.output,
                i,
                j;

            for (i = j = 0; i < numSamps; i++, j += modeInc) {
                out[i] = generator.triangular(-1, 1, mode[j]);
            }

            that.mulAdd(numSamps);
        };

        return that;
    };

    fluid.defaults("flock.ugen.random.triangular", {
        rate: "audio",
        inputs: {
            seed: null,
            mode: 0.5,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["mode"]
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.weibull = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                generator = that.generator,
                out = that.output,
                alphaInc = m.strides.alpha,
                alpha = inputs.alpha.output,
                betaInc = m.strides.beta,
                beta = inputs.beta.output,
                i,
                j,
                k;

            for (i = j = k = 0; i < numSamps; i++, j += alphaInc, k += betaInc) {
                out[i] = generator.weibull(alpha[j], beta[k]);
            }

            that.mulAdd(numSamps);
        };

        return that;
    };

    fluid.defaults("flock.ugen.random.weibull", {
        rate: "audio",
        inputs: {
            seed: null,
            alpha: 1,
            beta: 1,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["alpha", "beta"]
        }
    });


    /**************************************
     * Envelopes and Amplitude Processors *
     **************************************/

    flock.ugen.line = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                stepSize = m.stepSize,
                numSteps = m.numSteps,
                numLevelVals = numSteps >= numSamps ? numSamps : numSteps,
                numEndVals = numSamps - numLevelVals,
                level = m.level,
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

            m.level = level;
            m.numSteps = numSteps;

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            var m = that.model;

            // Any change in input value will restart the line.
            m.start = that.inputs.start.output[0];
            m.end = that.inputs.end.output[0];
            m.numSteps = Math.round(that.inputs.duration.output[0] * m.sampleRate); // Duration is seconds.
            if (m.numSteps === 0) {
                m.stepSize = 0.0;
                m.level = m.end;
            } else {
                m.stepSize = (m.end - m.start) / m.numSteps;
                m.level = m.start;
            }

            flock.onMulAddInputChanged(that);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.line", {
        rate: "control",
        inputs: {
            start: 0.0,
            end: 1.0,
            duration: 1.0,
            mul: null,
            add: null
        }
    });


    flock.ugen.xLine = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                multiplier = m.multiplier,
                numSteps = m.numSteps,
                numLevelVals = numSteps >= numSamps ? numSamps : numSteps,
                numEndVals = numSamps - numLevelVals,
                level = m.level,
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

            m.level = level;
            m.numSteps = numSteps;

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            var m = that.model;

            flock.onMulAddInputChanged(that);

            // Any change in input value will restart the line.
            m.start = that.inputs.start.output[0];
            if (m.start === 0.0) {
                m.start = Number.MIN_VALUE; // Guard against divide by zero by using the smallest possible number.
            }

            m.end = that.inputs.end.output[0];
            m.numSteps = Math.round(that.inputs.duration.output[0] * m.sampleRate);
            m.multiplier = Math.pow(m.end / m.start, 1.0 / m.numSteps);
            m.level = m.start;
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.xLine", {
        rate: "control",
        inputs: {
            start: 0.0,
            end: 1.0,
            duration: 1.0,
            mul: null,
            add: null
        }
    });

    /**
     * Loops through a linear ramp from start to end, incrementing the output by step.
     * Equivalent to SuperCollider's or CSound's Phasor unit generator.
     *
     * Inputs:
     *  start: the value to start ramping from
     *  end: the value to ramp to
     *  step: the value to increment per sample
     *  reset: the value to return to when the loop is reset by a trigger signal
     *  trigger: a trigger signal that, when it cross the zero line, will reset the loop back to the reset point
     */
    flock.ugen.phasor = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                step = inputs.step.output,
                trig = inputs.trigger.output,
                i,
                j,
                k;

            // TODO: Add sample priming to the ugen graph to remove this conditional.
            if (m.value === undefined) {
                m.value = inputs.start.output[0];
            }

            for (i = 0, j = 0, k = 0; i < numSamps; i++, j += m.strides.trigger, k += m.strides.step) {
                if ((trig[j] > 0.0 && m.prevTrig <= 0.0)) {
                    m.value = inputs.reset.output[0];
                }
                m.prevTrig = trig[j];

                if (m.value >= inputs.end.output[0]) {
                    m.value = inputs.start.output[0];
                }

                out[i] = m.value;
                m.value += step[k];
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged();

        return that;
    };

    fluid.defaults("flock.ugen.phasor", {
        rate: "control",
        inputs: {
            start: 0.0,
            end: 1.0,
            reset: 0.0,
            step: 0.1,
            trigger: 0.0,
            mul: null,
            add: null
        },
        ugenOptions: {
            strideInputs: [
                "trigger",
                "step"
            ]
        }
    });

    flock.ugen.env = {};

    // TODO: Better names for these inputs; harmonize them with flock.ugen.line
    // TODO: Make this a mul/adder.
    flock.ugen.env.simpleASR = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                prevGate = m.previousGate,
                gate = that.inputs.gate.output[0],
                level = m.level,
                stage = m.stage,
                currentStep = stage.currentStep,
                stepInc = stage.stepInc,
                numSteps = stage.numSteps,
                targetLevel = m.targetLevel,
                stepsNeedRecalc = false,
                stageTime,
                i;

            // Recalculate the step state if necessary.
            if (prevGate <= 0 && gate > 0) {
                // Starting a new attack stage.
                targetLevel = that.inputs.sustain.output[0];
                stageTime = that.inputs.attack.output[0];
                stepsNeedRecalc = true;
            } else if (gate <= 0 && currentStep >= numSteps) {
                // Starting a new release stage.
                targetLevel = that.inputs.start.output[0];
                stageTime = that.inputs.release.output[0];
                stepsNeedRecalc = true;
            }

            // TODO: Can we get rid of this extra branch without introducing code duplication?
            if (stepsNeedRecalc) {
                numSteps = Math.round(stageTime * m.sampleRate);
                stepInc = (targetLevel - level) / numSteps;
                currentStep = 0;
            }

            // Output the the envelope's sample data.
            for (i = 0; i < numSamps; i++) {
                out[i] = level;
                currentStep++;
                // Hold the last value if the stage is complete, otherwise increment.
                level = currentStep < numSteps ?
                    level + stepInc : currentStep === numSteps ?
                    targetLevel : level;
            }

            // Store instance state.
            m.level = level;
            m.targetLevel = targetLevel;
            m.previousGate = gate;
            stage.currentStep = currentStep;
            stage.stepInc = stepInc;
            stage.numSteps = numSteps;
        };

        that.init = function () {
            var m = that.model;
            m.level = that.inputs.start.output[0];
            m.targetLevel = that.inputs.sustain.output[0];
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.env.simpleASR", {
        rate: "control",
        inputs: {
            start: 0.0,
            attack: 0.01,
            sustain: 1.0,
            release: 1.0,
            gate: 0.0
        },
        ugenOptions: {
            model: {
                previousGate: 0.0,
                stage: {
                    currentStep: 0,
                    stepInc: 0,
                    numSteps: 0
                }
            }
        }
    });

    flock.ugen.amplitude = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                source = that.inputs.source.output,
                out = that.output,
                prevAtt = m.attackTime,
                nextAtt = that.inputs.attack.output[0],
                prevRel = m.releaseTime,
                nextRel = that.inputs.release.output[0],
                prevVal = m.prevVal,
                attCoef = m.attackCoef,
                relCoef = m.releaseCoef,
                i,
                val,
                coef;

            // Convert 60 dB attack and release times to coefficients if they've changed.
            if (nextAtt !== prevAtt) {
                m.attackTime = nextAtt;
                attCoef = m.attackCoef =
                    nextAtt === 0.0 ? 0.0 : Math.exp(flock.LOG01 / (nextAtt * m.sampleRate));
            }

            if (nextRel !== prevRel) {
                m.releaseTime = nextRel;
                relCoef = m.releaseCoef =
                    (nextRel === 0.0) ? 0.0 : Math.exp(flock.LOG01 / (nextRel * m.sampleRate));
            }

            for (i = 0; i < numSamps; i++) {
                val = Math.abs(source[i]);
                coef = val < prevVal ? relCoef : attCoef;
                out[i] = prevVal = val + (prevVal - val) * coef;
            }

            m.prevVal = prevVal;

            that.mulAdd(numSamps);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.amplitude", {
        rate: "audio",
        inputs: {
            source: null,
            attack: 0.01,
            release: 0.01,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                prevVal: 0.0
            }
        }
    });

    flock.ugen.normalize = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function () {
            var out = that.output,
                max = that.inputs.max.output[0], // Max is kr.
                source = that.inputs.source.output;

            // Note, this normalizes the source input ugen's output buffer directly in place.
            flock.normalize(source, max, out);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.normalize", {
        rate: "audio",
        inputs: {
            max: 1.0,
            source: null
        }
    });

    /**
     * A gate that allows the source input signal to pass whenever the sideChain input
     * signal is greater than the threshold.
     *
     * If sideChain isn't specifed, the source signal itself is used to open the gate.
     * By default, the gate will output 0.0 if it is closed, but setting the holdLastValue
     * option to true enables it to hold the value of the gate when it was last open.
     *
     * Inputs:
     *     source: the signal that will be outputted whenever the gate is open.
     *     sideChain: (optional) a side chain signal that will
     *         cause the gate to open and close
     *     threshold: the minimum value at which the gate will open
     * Options:
     *      holdLastValue: determines whether the gate should hold its last open value or output silence
     */
    flock.ugen.gate = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                strides = m.strides,
                out = that.output,
                inputs = that.inputs,
                source = inputs.source.output,
                sideChain = inputs.sideChain.output,
                sideChainInc = strides.sideChain,
                threshold = inputs.threshold.output,
                thresholdInc = strides.threshold,
                holdLast = that.options.holdLastValue,
                lastValue = m.lastValue,
                i,
                j,
                k;

            for (i = j = k = 0; i < numSamps; i++, j += sideChainInc, k += thresholdInc) {
                if (sideChain[j] >= threshold[k]) {
                    out[i] = lastValue = source[i];
                } else {
                    // TODO: Don't check holdLast on each sample.
                    out[i] = holdLast ? lastValue : 0;
                }
            }

            m.lastValue = lastValue;
            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            if (!that.inputs.sideChain) {
                that.inputs.sideChain = that.inputs.source;
            }

            flock.onMulAddInputChanged(that);
            that.calculateStrides();
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.gate", {
        rate: "audio",
        inputs: {
            source: null,
            sideChain: null,
            threshold: Number.MIN_VALUE,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                lastValue: 0.0
            },
            holdLastValue: false,
            strideInputs: ["sideChain", "threshold"]
        }
    });


    /**
     * An equal power stereo panner.
     *
     * This unit generator scales the left and right channels
     * with a quarter-wave sin/cos curve so that the levels at the centre
     * are more balanced than a linear pan, reducing the impression that
     * the sound is fading into the distance as it reaches the centrepoint.
     *
     * Inputs:
     *   source: the source (mono) unit signal
     *   pan: a value between -1 (hard left) and 1 (hard right)
     */
    flock.ugen.pan2 = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                outputs = that.output,
                left = outputs[0],
                right = outputs[1],
                inputs = that.inputs,
                source = inputs.source.output,
                pan = inputs.pan.output,
                i,
                j,
                sourceVal,
                panVal;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.pan) {
                sourceVal = source[i];
                panVal = pan[j] * 0.5 + 0.5;

                // TODO: Replace this with a lookup table.
                right[i] = sourceVal * Math.sin(panVal * flock.HALFPI);
                left[i] = sourceVal * Math.cos(panVal * flock.HALFPI);
            }

            // TODO: Add multichannel support for mul/add.
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.pan2", {
        rate: "audio",

        inputs: {
            source: null,
            pan: 0 // -1 (hard left)..0 (centre)..1 (hard right)
        },

        ugenOptions: {
            tags: ["flock.ugen.multiChannelOutput"],
            strideInputs: [
                "pan"
            ],
            numOutputs: 2
        }
    });

    /*******************
     * Bus-Level UGens *
     *******************/

    flock.ugen.out = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        // TODO: Implement a "straight out" gen function for cases where the number
        // of sources matches the number of output buses (i.e. where no expansion is necessary).
        that.gen = function (numSamps) {
            var sources = that.multiInputs.sources,
                buses = that.options.audioSettings.buses,
                bufStart = that.inputs.bus.output[0],
                expand = that.inputs.expand.output[0],
                numSources,
                numOutputBuses,
                i,
                j,
                source,
                rate,
                bus,
                inc,
                outIdx;

            numSources = sources.length;
            numOutputBuses = Math.max(expand, numSources);

            if (numSources < 1) {
                return;
            }

            for (i = 0; i < numOutputBuses; i++) {
                source = sources[i % numSources];
                rate = source.rate;
                bus = buses[bufStart + i];
                inc = rate === flock.rates.AUDIO ? 1 : 0;
                outIdx = 0;

                for (j = 0; j < numSamps; j++, outIdx += inc) {
                    // TODO: Support control rate interpolation.
                    // TODO: Don't attempt to write to buses beyond the available number.
                    //       Provide an error at onInputChanged time if the unit generator is configured
                    //       with more sources than available buffers.
                    bus[j] = bus[j] + source.output[outIdx];
                }
            }

            that.mulAdd(numSamps);
        };

        that.init = function () {
            that.sourceBuffers = [];
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.out", {
        rate: "audio",
        inputs: {
            sources: null,
            bus: 0,
            expand: 2
        },
        ugenOptions: {
            tags: ["flock.ugen.outputType"],
            multiInputNames: ["sources"]
        }
    });

    // Note: this unit generator currently only outputs values at control rate.
    // TODO: Unit tests.
    flock.ugen.valueOut = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.arraySourceGen = function () {
            var sources = that.inputs.sources,
                i;

            for (i = 0; i < sources.length; i++) {
                that.model.value[i] = sources[i].output[0];
            }
        };

        that.ugenSourceGen = function () {
            that.model.value = that.inputs.sources.output[0];
        };

        that.onInputChanged = function () {
            var sources = that.inputs.sources;
            if (flock.isIterable(sources)) {
                that.gen = that.arraySourceGen;
                that.model.value = new Float32Array(sources.length);
            } else {
                that.gen = that.ugenSourceGen;
            }
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.valueOut", {
        rate: "control",

        inputs: {
            sources: null
        },

        ugenOptions: {
            model: {
                value: null
            },

            tags: ["flock.ugen.outputType", "flock.ugen.valueType"]
        }
    });

    // TODO: fix naming.
    flock.ugen["in"] = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.singleBusGen = function (numSamps) {
            var out = that.output,
                busNum = that.inputs.bus.output[0] | 0,
                bus = that.options.audioSettings.buses[busNum],
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = bus[i];
            }

            that.mulAdd(numSamps);
        };

        that.multiBusGen = function (numSamps) {
            var busesInput = that.inputs.bus,
                enviroBuses = that.options.audioSettings.buses,
                out = that.output,
                i,
                j,
                busIdx;

            for (i = 0; i < numSamps; i++) {
                out[i] = 0; // Clear previous output values before summing a new set.
                for (j = 0; j < busesInput.length; j++) {
                    busIdx = busesInput[j].output[0] | 0;
                    out[i] += enviroBuses[busIdx][i];
                }
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            that.gen = flock.isIterable(that.inputs.bus) ? that.multiBusGen : that.singleBusGen;
            flock.onMulAddInputChanged(that);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.in", {
        rate: "audio",
        inputs: {
            bus: 0,
            mul: null,
            add: null
        }
    });

    flock.ugen.audioIn = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        // TODO: Complete cut and paste of flock.ugen.in.singleBusGen().
        that.gen = function (numSamps) {
            var out = that.output,
                busNum = that.inputs.bus.output[0] | 0,
                bus = that.options.audioSettings.buses[busNum],
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = bus[i];
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            // TODO: Direct reference to the shared environment.
            flock.enviro.shared.audioStrategy.startReadingAudioInput();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.audioIn", {
        rate: "audio",
        inputs: {
            bus: 2,
            mul: null,
            add: null
        }
    });


    /***********
     * Filters *
     ***********/

    /**
     * A generic FIR and IIR filter engine. You specify the coefficients, and this will do the rest.
     */
     // TODO: Unit tests.
    flock.ugen.filter = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function () {
            var m = that.model,
                inputs = that.inputs,
                q = inputs.q.output[0],
                freq = inputs.freq.output[0];

            if (m.prevFreq !== freq || m.prevQ !== q) {
                that.updateCoefficients(m, freq, q);
            }

            that.filterEngine.filter(that.output, that.inputs.source.output);

            m.prevQ = q;
            m.prevFreq = freq;
        };

        that.init = function () {
            var recipeOpt = that.options.recipe;
            var recipe = typeof (recipeOpt) === "string" ? flock.get(recipeOpt) : recipeOpt;

            if (!recipe) {
                throw new Error("Can't instantiate a flock.ugen.filter() without specifying a filter coefficient recipe.");
            }

            that.filterEngine = new Filter(recipe.sizes.b, recipe.sizes.a);
            that.model.coeffs = {
                a: that.filterEngine.a,
                b: that.filterEngine.b
            };

            that.updateCoefficients = flock.get(recipe, that.options.type);
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.filter", {
        rate: "audio",

        inputs: {
            freq: 440,
            q: 1.0,
            source: null
        }
    });

    /**
     * An optimized biquad filter unit generator.
     */
    // TODO: Unit tests.
    flock.ugen.filter.biquad = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                co = m.coeffs,
                freq = inputs.freq.output[0],
                q = inputs.q.output[0],
                source = inputs.source.output,
                i,
                w;

            if (m.prevFreq !== freq || m.prevQ !== q) {
                that.updateCoefficients(m, freq, q);
            }

            for (i = 0; i < numSamps; i++) {
                w = source[i] - co.a[0] * m.d0 - co.a[1] * m.d1;
                out[i] = co.b[0] * w + co.b[1] * m.d0 + co.b[2] * m.d1;
                m.d1 = m.d0;
                m.d0 = w;
            }

            m.prevQ = q;
            m.prevFreq = freq;
        };

        that.onInputChanged = function () {
            var typeOpt = that.options.type;
            that.updateCoefficients = typeof (typeOpt) === "string" ?
                flock.get(typeOpt) : typeOpt;
        };

        that.init = function () {
            that.model.d0 = 0.0;
            that.model.d1 = 0.0;
            that.model.coeffs = {
                a: new Float32Array(2),
                b: new Float32Array(3)
            };
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.filter.biquad", {
        inputs: {
            freq: 440,
            q: 1.0,
            source: null
        }
    });

    flock.ugen.filter.biquad.types = {
        "hp": {
            inputDefaults: {
                freq: 440,
                q: 1.0
            },
            options: {
                type: "flock.coefficients.butterworth.highPass"
            }
        },
        "rhp": {
            inputDefaults: {
                freq: 440,
                q: 1.0
            },
            options: {
                type: "flock.coefficients.rbj.highPass"
            }
        },
        "lp": {
            inputDefaults: {
                freq: 440,
                q: 1.0
            },
            options: {
                type: "flock.coefficients.butterworth.lowPass"
            }
        },
        "rlp": {
            inputDefaults: {
                freq: 440,
                q: 1.0
            },
            options: {
                type: "flock.coefficients.rbj.lowPass"
            }
        },
        "bp": {
            inputDefaults: {
                freq: 440,
                q: 4.0
            },
            options: {
                type: "flock.coefficients.butterworth.bandPass"
            }
        },
        "br": {
            inputDefaults: {
                freq: 440,
                q: 1.0
            },
            options: {
                type: "flock.coefficients.butterworth.bandReject"
            }
        }
    };

    // Convenience methods for instantiating common types of biquad filters.
    flock.aliasUGens("flock.ugen.filter.biquad", flock.ugen.filter.biquad.types);

    flock.coefficients = {
        butterworth: {
            sizes: {
                a: 2,
                b: 3
            },

            lowPass: function (model, freq) {
                var co = model.coeffs;
                var lambda = 1 / Math.tan(Math.PI * freq / model.sampleRate);
                var lambdaSquared = lambda * lambda;
                var rootTwoLambda = flock.ROOT2 * lambda;
                var b0 = 1 / (1 + rootTwoLambda + lambdaSquared);
                co.b[0] = b0;
                co.b[1] = 2 * b0;
                co.b[2] = b0;
                co.a[0] = 2 * (1 - lambdaSquared) * b0;
                co.a[1] = (1 - rootTwoLambda + lambdaSquared) * b0;
            },

            highPass: function (model, freq) {
                var co = model.coeffs;
                var lambda = Math.tan(Math.PI * freq / model.sampleRate);
                // Works around NaN values in cases where the frequency
                // is precisely half the sampling rate, and thus lambda
                // is Infinite.
                if (lambda === Infinity) {
                    lambda = 0;
                }
                var lambdaSquared = lambda * lambda;
                var rootTwoLambda = flock.ROOT2 * lambda;
                var b0 = 1 / (1 + rootTwoLambda + lambdaSquared);

                co.b[0] = b0;
                co.b[1] = -2 * b0;
                co.b[2] = b0;
                co.a[0] = 2 * (lambdaSquared - 1) * b0;
                co.a[1] = (1 - rootTwoLambda + lambdaSquared) * b0;
            },

            bandPass: function (model, freq, q) {
                var co = model.coeffs;
                var bw = freq / q;
                var lambda = 1 / Math.tan(Math.PI * bw / model.sampleRate);
                var theta = 2 * Math.cos(flock.TWOPI * freq / model.sampleRate);
                var b0 = 1 / (1 + lambda);

                co.b[0] = b0;
                co.b[1] = 0;
                co.b[2] = -b0;
                co.a[0] = -(lambda * theta * b0);
                co.a[1] = b0 * (lambda - 1);
            },

            bandReject: function (model, freq, q) {
                var co = model.coeffs;
                var bw = freq / q;
                var lambda = Math.tan(Math.PI * bw / model.sampleRate);
                var theta = 2 * Math.cos(flock.TWOPI * freq / model.sampleRate);
                var b0 = 1 / (1 + lambda);
                var b1 = -theta * b0;

                co.b[0] = b0;
                co.b[1] = b1;
                co.b[2] = b0;
                co.a[0] = b1;
                co.a[1] = (1 - lambda) * b0;
            }
        },

        // From Robert Brisow-Johnston's Filter Cookbook:
        // http://dspwiki.com/index.php?title=Cookbook_Formulae_for_audio_EQ_biquad_filter_coefficients
        rbj: {
            sizes: {
                a: 2,
                b: 3
            },

            lowPass: function (model, freq, q) {
                var co = model.coeffs;
                var w0 = flock.TWOPI * freq / model.sampleRate;
                var cosw0 = Math.cos(w0);
                var sinw0 = Math.sin(w0);
                var alpha = sinw0 / (2 * q);
                var oneLessCosw0 = 1 - cosw0;
                var a0 = 1 + alpha;
                var b0 = (oneLessCosw0 / 2) / a0;

                co.b[0] = b0;
                co.b[1] = oneLessCosw0 / a0;
                co.b[2] = b0;
                co.a[0] = (-2 * cosw0) / a0;
                co.a[1] = (1 - alpha) / a0;
            },

            highPass: function (model, freq, q) {
                var co = model.coeffs;
                var w0 = flock.TWOPI * freq / model.sampleRate;
                var cosw0 = Math.cos(w0);
                var sinw0 = Math.sin(w0);
                var alpha = sinw0 / (2 * q);
                var onePlusCosw0 = 1 + cosw0;
                var a0 = 1 + alpha;
                var b0 = (onePlusCosw0 / 2) / a0;

                co.b[0] = b0;
                co.b[1] = (-onePlusCosw0) / a0;
                co.b[2] = b0;
                co.a[0] = (-2 * cosw0) / a0;
                co.a[1] = (1 - alpha) / a0;
            },

            bandPass: function (model, freq, q) {
                var co = model.coeffs;
                var w0 = flock.TWOPI * freq / model.sampleRate;
                var cosw0 = Math.cos(w0);
                var sinw0 = Math.sin(w0);
                var alpha = sinw0 / (2 * q);
                var a0 = 1 + alpha;
                var qByAlpha = q * alpha;

                co.b[0] = qByAlpha / a0;
                co.b[1] = 0;
                co.b[2] = -qByAlpha / a0;
                co.a[0] = (-2 * cosw0) / a0;
                co.a[1] = (1 - alpha) / a0;
            },

            bandReject: function (model, freq, q) {
                var co = model.coeffs;
                var w0 = flock.TWOPI * freq / model.sampleRate;
                var cosw0 = Math.cos(w0);
                var sinw0 = Math.sin(w0);
                var alpha = sinw0 / (2 * q);
                var a0 = 1 + alpha;
                var ra0 = 1 / a0;
                var b1 = (-2 * cosw0) / a0;
                co.b[0] = ra0;
                co.b[1] = b1;
                co.b[2] = ra0;
                co.a[0] = b1;
                co.a[1] = (1 - alpha) / a0;
            }
        }
    };

    /**
     * A Moog-style 24db resonant low-pass filter.
     *
     * This unit generator is based on the following musicdsp snippet:
     * http://www.musicdsp.org/showArchiveComment.php?ArchiveID=26
     *
     * Inputs:
     *   - source: the source signal to process
     *   - cutoff: the cutoff frequency
     *   - resonance: the filter resonance [between 0 and 4, where 4 is self-oscillation]
     */
    // TODO: Unit tests.
    flock.ugen.filter.moog = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                source = inputs.source.output,
                sourceInc = m.strides.source,
                res = inputs.resonance.output,
                resInc = m.strides.resonance,
                cutoff = inputs.cutoff.output,
                cutoffInc = m.strides.cutoff,
                f = m.f,
                fSq = m.fSq,
                fSqSq = m.fSqSq,
                oneMinusF = m.oneMinusF,
                fb = m.fb,
                i,
                j,
                k,
                l,
                currCutoff,
                currRes,
                val;

            for (i = j = k = l = 0; i < numSamps; i++, j += sourceInc, k += resInc, l += cutoffInc) {
                currCutoff = cutoff[l];
                currRes = res[k];

                if (currCutoff !== m.prevCutoff) {
                    if (currCutoff > m.nyquistRate) {
                        currCutoff = m.nyquistRate;
                    }

                    f = m.f = (currCutoff / m.nyquistRate) * 1.16;
                    fSq = m.fSq = f * f;
                    fSqSq = m.fSqSq = fSq * fSq;
                    oneMinusF = m.oneMinusF = 1 - f;
                    m.prevRes = undefined; // Flag the need to update fb.
                }

                if (currRes !== m.prevRes) {
                    if (currRes > 4) {
                        currRes = 4;
                    } else if (currRes < 0) {
                        currRes = 0;
                    }

                    fb = m.fb = currRes * (1.0 - 0.15 * fSq);
                }

                val = source[j] - (m.out4 * fb);
                val *= 0.35013 * fSqSq;
                m.out1 = val + 0.3 * m.in1 + oneMinusF * m.out1;
                m.in1 = val;
                m.out2 = m.out1 + 0.3 * m.in2 + oneMinusF * m.out2;
                m.in2 = m.out1;
                m.out3 = m.out2 + 0.3 * m.in3 + oneMinusF * m.out3;
                m.in3 = m.out2;
                m.out4 = m.out3 + 0.3 * m.in4 + oneMinusF * m.out4;
                m.in4 = m.out3;
                out[i] = m.out4;
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.filter.moog", {
        rate: "audio",
        inputs: {
            cutoff: 3000,
            resonance: 3.99,
            source: null
        },
        ugenOptions: {
            model: {
                in1: 0,
                in2: 0,
                in3: 0,
                in4: 0,
                out1: 0,
                out2: 0,
                out3: 0,
                out4: 0,
                prevCutoff: undefined,
                prevResonance: undefined,
                f: undefined,
                fSq: undefined,
                fSqSq: undefined,
                oneMinusF: undefined,
                fb: undefined
            },
            strideInputs: ["source", "cutoff", "resonance"]
        }
    });

    flock.ugen.delay = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                source = inputs.source.output,
                time = inputs.time.output[0],
                delayBuffer = that.delayBuffer,
                i;

            if (time !== m.time) {
                m.time = time;
                m.delaySamps = time * that.model.sampleRate;
            }

            for (i = 0; i < numSamps; i++) {
                if (m.pos >= m.delaySamps) {
                    m.pos = 0;
                }
                out[i] = delayBuffer[m.pos];
                delayBuffer[m.pos] = source[i];
                m.pos++;
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function (inputName) {
            flock.onMulAddInputChanged(that);

            if (!inputName || inputName === "maxTime") {
                var delayBufferLength = that.model.sampleRate * that.inputs.maxTime.output[0];
                that.delayBuffer = new Float32Array(delayBufferLength);
            }
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.delay", {
        rate: "audio",
        inputs: {
            maxTime: 1.0,
            time: 1.0,
            source: null
        },
        ugenOptions: {
            model: {
                pos: 0
            }
        }
    });


    // Simple optimised delay for exactly 1 sample
    flock.ugen.delay1 = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                source = inputs.source.output,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = m.prevVal;
                m.prevVal = source[i];
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            flock.onMulAddInputChanged(that);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.delay1", {
        rate: "audio",
        inputs: {
            source: null
        },
        ugenOptions: {
            model: {
                prevVal: 0
            }
        }
    });


    flock.ugen.freeverb = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var o = that.options,
                inputs = that.inputs,
                out = that.output,
                tunings = o.tunings,
                allPassTunings = o.allPassTunings,
                source = inputs.source.output,
                mix = inputs.mix.output[0],
                roomSize = inputs.roomSize.output[0],
                damp = inputs.damp.output[0],
                dry = 1 - mix,
                room_scaled = roomSize * 0.28 + 0.7,
                damp1 = damp * 0.4,
                damp2 = 1.0 - damp1,
                i,
                j;

            for (i = 0; i < numSamps; i++) {
                // read inputs
                var inp = source[i];
                var inp_scaled = inp * 0.015;

                // read samples from the allpasses
                for (j = 0; j < that.buffers_a.length; j++) {
                    if (++that.bufferindices_a[j] === allPassTunings[j]) {
                        that.bufferindices_a[j] = 0;
                    }
                    that.readsamp_a[j] = that.buffers_a[j][that.bufferindices_a[j]];
                }

                // foreach comb buffer, we perform same filtering (only bufferlen differs)
                for (j = 0; j < that.buffers_c.length; j++) {
                    if (++that.bufferindices_c[j] === tunings[j]) {
                        that.bufferindices_c[j] = 0;
                    }
                    var readsamp_c = that.buffers_c[j][that.bufferindices_c[j]];
                    that.filterx_c[j] = (damp2 * that.filtery_c[j]) + (damp1 * that.filterx_c[j]);
                    that.buffers_c[j][that.bufferindices_c[j]] = inp_scaled + (room_scaled * that.filterx_c[j]);
                    that.filtery_c[j] = readsamp_c;
                }

                // each allpass is handled individually, with different calculations made and stored into the delaylines
                var ftemp8 = (that.filtery_c[6] + that.filtery_c[7]);

                that.buffers_a[3][that.bufferindices_a[3]] = ((((0.5 * that.filterx_a[3]) + that.filtery_c[0]) +
                    (that.filtery_c[1] + that.filtery_c[2])) +
                    ((that.filtery_c[3] + that.filtery_c[4]) + (that.filtery_c[5] + ftemp8)));
                that.filterx_a[3] = that.readsamp_a[3];
                that.filtery_a[3] = (that.filterx_a[3] -
                    (((that.filtery_c[0] + that.filtery_c[1]) + (that.filtery_c[2] + that.filtery_c[3])) +
                    ((that.filtery_c[4] + that.filtery_c[5]) + ftemp8)));
                that.buffers_a[2][that.bufferindices_a[2]] = ((0.5 * that.filterx_a[2]) + that.filtery_a[3]);
                that.filterx_a[2] = that.readsamp_a[2];
                that.filtery_a[2] = (that.filterx_a[2] - that.filtery_a[3]);

                that.buffers_a[1][that.bufferindices_a[1]] = ((0.5 * that.filterx_a[1]) + that.filtery_a[2]);
                that.filterx_a[1] = that.readsamp_a[1];
                that.filtery_a[1] = (that.filterx_a[1] - that.filtery_a[2]);

                that.buffers_a[0][that.bufferindices_a[0]] = ((0.5 * that.filterx_a[0]) + that.filtery_a[1]);
                that.filterx_a[0] = that.readsamp_a[0];
                that.filtery_a[0] = (that.filterx_a[0] - that.filtery_a[1]);
                out[i] = ((dry * inp) + (mix * that.filtery_a[0]));
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            flock.onMulAddInputChanged(that);
        };

        that.initDelayLines = function () {
            var o = that.options,
                tunings = o.tunings,
                allPassTunings = o.allPassTunings;

            // Initialise the delay lines
            that.buffers_c = [];
            that.bufferindices_c = new Int32Array(8);
            that.filterx_c = new Float32Array(8);
            that.filtery_c = new Float32Array(8);
            var spread = that.model.spread;
            var i, j;
            for (i = 0; i < that.buffers_c.length; i++) {
                that.buffers_c[i] = new Float32Array(tunings[i] + spread);
                that.bufferindices_c[i] = 0;
                that.filterx_c[i] = 0;
                that.filtery_c[i] = 0;
                for (j = 0; j < tunings[i] + spread; j++) {
                    that.buffers_c[i][j] = 0;
                }
            }
            that.buffers_a = [];
            that.bufferindices_a = new Int32Array(4);
            that.filterx_a = new Float32Array(4);
            that.filtery_a = new Float32Array(4);
            // "readsamp" vars are temporary values read back from the delay lines,
            // not stored but only used in the gen loop.
            that.readsamp_a = new Float32Array(4);

            for (i = 0; i < 4; i++) {
                that.bufferindices_a[i] = 0;
                that.filterx_a[i] = 0;
                that.filtery_a[i] = 0;
                that.readsamp_a[i] = 0;
                // TODO is this what the spread is meant to do?
                for (j = 0; j < allPassTunings.length; j++) {
                    allPassTunings[j] += spread;
                }
                that.buffers_a[i] = new Float32Array(allPassTunings[i]);
                for (j = 0; j < allPassTunings[i]; j++) {
                    that.buffers_a[i][j] = 0;
                }
            }
        };

        that.init = function () {
            that.initDelayLines();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.freeverb", {
        rate: "audio",
        inputs: {
            mix: 0.5,
            roomSize: 0.6,
            damp: 0.1,
            source: null,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                spread: 0
            },

            tunings: [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617],
            allPassTunings: [556, 441, 341, 225]
        }
    });


    flock.ugen.decay = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                source = inputs.source.output,
                time = inputs.time.output[0],
                i;

            if (time !== m.time) {
                m.time = time;
                m.coeff = time === 0.0 ? 0.0 : Math.exp(flock.LOG001 / (time * that.model.sampleRate));
            }

            // TODO: Optimize this conditional.
            if (m.coeff === 0.0) {
                for (i = 0; i < numSamps; i++) {
                    out[i] = source[i];
                }
            } else {
                for (i = 0; i < numSamps; i++) {
                    m.lastSamp = source[i] + m.coeff * m.lastSamp;
                    out[i] = m.lastSamp;
                }
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.decay", {
        rate: "audio",
        inputs: {
            source: null,
            time: 1.0
        },
        ugenOptions: {
            model: {
                time: 0,
                lastSamp: 0,
                coeff: 0
            }
        }
    });

    /****************************
     * Granular Synthesis UGens *
     ****************************/

    /**
     * Triggers grains from an audio buffer.
     *
     * Inputs:
     *   - dur: the duration of each grain (control or constant rate only)
     *   - trigger: a trigger signal that, when it move to a positive number, will start a grain
     *   - buffer: a bufferDef object describing the buffer to granulate
     *   - centerPos: the postion within the sound buffer when the grain will reach maximum amplitude
     *   - amp: the peak amplitude of the grain
     *   - speed: the rate at which grain samples are selected from the buffer; 1.0 is normal speed, -1.0 is backwards
     *
     * Options:
     *   - interpolation: "cubic", "linear", or "none"/undefined
     */
    // TODO: Unit tests.
    flock.ugen.triggerGrains = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                chan = inputs.channel.output[0],
                buf = that.buffer.data.channels[chan],
                dur = inputs.dur.output[0],
                amp = inputs.amp.output,
                centerPos = inputs.centerPos.output,
                trigger = inputs.trigger.output,
                speed = inputs.speed.output,
                posIdx = 0,
                trigIdx = 0,
                ampIdx = 0,
                speedIdx = 0,
                i,
                j,
                k,
                grain,
                start,
                samp;

            // Update the grain envelope if the grain duration input has changed.
            // TODO: What happens when this changes while older grains are still sounding?
            if (dur !== m.dur) {
                m.dur = dur > m.maxDur ? m.maxDur : dur;
                m.numGrainSamps = Math.round(m.sampleRate * m.dur);
                m.grainCenter = Math.round(m.numGrainSamps / 2);
                for (i = 0; i < m.numGrainSamps; i++) {
                    m.env[i] = Math.sin(Math.PI * i / m.numGrainSamps);
                }
            }

            // Trigger new grains.
            // TODO: Why does this constantly trigger new grains with an audio rate trigger signal,
            //       rarely or never cleaning old ones up?
            for (i = 0; i < numSamps; i++) {
                if (trigger[trigIdx] > 0.0 && m.prevTrigger <= 0.0 && m.activeGrains.length < m.maxNumGrains) {
                    grain = m.freeGrains.pop();
                    grain.sampIdx = 0;
                    grain.envIdx = 0;
                    grain.amp = amp[ampIdx];
                    start = (centerPos[posIdx] * m.sampleRate) - m.grainCenter;
                    while (start < 0) {
                        start += buf.length;
                    }
                    grain.readPos = Math.round(start);
                    grain.writePos = i;
                    grain.speed = speed[speedIdx];
                    m.activeGrains.push(grain);
                }
                m.prevTrigger = trigger[trigIdx];
                out[i] = 0.0;

                posIdx += m.strides.centerPos;
                trigIdx += m.strides.trigger;
                ampIdx += m.strides.amp;
                speedIdx += m.strides.speed;
            }

            // Output samples for all active grains.
            for (j = 0; j < m.activeGrains.length;) {
                grain = m.activeGrains[j];
                for (k = grain.writePos; k < Math.min(m.numGrainSamps - grain.sampIdx, numSamps); k++) {
                    samp = that.interpolate ? that.interpolate(grain.readPos, buf) : buf[grain.readPos | 0];
                    out[k] += samp * m.env[grain.envIdx] * grain.amp;
                    grain.readPos = (grain.readPos + grain.speed) % buf.length;
                    grain.sampIdx++;
                    grain.envIdx++;
                }
                if (grain.sampIdx >= m.numGrainSamps) {
                    m.freeGrains.push(grain);
                    m.activeGrains.splice(j, 1);
                } else {
                    j++;
                    grain.writePos = grain.writePos % that.options.audioSettings.blockSize;
                }
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.allocateGrains = function (numGrains) {
            numGrains = numGrains || that.model.maxNumGrains;

            for (var i = 0; i < numGrains; i++) {
                that.model.freeGrains.push({
                    sampIdx: 0,
                    envIdx: 0,
                    readPos: 0
                });
            }
        };

        that.init = function () {
            var m = that.model,
                maxGrainLength = Math.round(m.maxDur * m.sampleRate);

            flock.ugen.buffer(that);
            that.model.env = new Float32Array(maxGrainLength);
            that.allocateGrains();
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.triggerGrains", {
        rate: "audio",
        inputs: {
            centerPos: 0,
            channel: 0,
            amp: 1.0,
            dur: 0.1,
            speed: 1.0,
            buffer: null,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                maxDur: 30,
                maxNumGrains: 512,
                activeGrains: [],
                freeGrains: [],
                env: null,
                strides: {}
            },
            strideInputs: [
                "centerPos",
                "trigger",
                "amp",
                "speed"
            ],
            interpolation: "cubic"
        }
    });


    // TODO: Unit tests.
    flock.ugen.print = function (input, output, options) {
        var that = flock.ugen(input, output, options);

        that.gen = function (numSamps) {
            var inputs = that.inputs,
                m = that.model,
                label = m.label,
                chan = inputs.channel,
                // Basic multichannel support. This should be inproved
                // by factoring the multichannel input code out of flock.ugen.out.
                source = chan ? inputs.source.output[chan.output[0]] : inputs.source.output,
                trig = inputs.trigger.output[0],
                freq = inputs.freq.output[0],
                i;

            if (trig > 0.0 && m.prevTrig <= 0.0) {
                fluid.log(fluid.logLevel.IMPORTANT, label + source);
            }

            if (m.freq !== freq) {
                m.sampInterval = Math.round(m.sampleRate / freq);
                m.freq = freq;
                m.counter = m.sampInterval;
            }

            for (i = 0; i < numSamps; i++) {
                if (m.counter >= m.sampInterval) {
                    fluid.log(fluid.logLevel.IMPORTANT, label + source[i]);
                    m.counter = 0;
                }
                m.counter++;
                that.output[i] = source[i];
            }
        };

        that.init = function () {
            var o = that.options;
            that.model.label = o.label ? o.label + ": " : "";
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.print", {
        rate: "audio",
        inputs: {
            source: null,
            trigger: 0.0,
            freq: 1.0
        },
        ugenOptions: {
            model: {
                counter: 0
            }
        }
    });


    /**
     * Granulates a source signal using an integral delay line.
     * This implementation is particularly useful for live granulation.
     * Contributed by Mayank Sanganeria.
     *
     * Inputs:
     *   - grainDur: the duration of each grain (control or constant rate only)
     *   - delayDur: the duration of the delay line (control or constant rate only)
     *   - numGrains: the number of grains to generate (control or constant rate only)
     *   - mul: amplitude scale factor
     *   - add: amplide add
     */
    // TODO: Unit tests.
    flock.ugen.granulator = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                grainDur = inputs.grainDur.output[0],
                delayDur = inputs.delayDur.output[0],
                numGrains = inputs.numGrains.output[0],
                source = inputs.source.output,
                i,
                j,
                grainPos,
                windowPos,
                amp;

            // TODO: Probably too expensive to modulate delayDur at control rate.
            // Perhaps either move this into onInputChanged() and treat it as a constant input parameter
            // or introduce a maximum delay length and reuse the same array throughout (just changing indices).
            if (m.delayDur !== delayDur) {
                m.delayDur = delayDur;
                m.delayLength = (m.sampleRate * m.delayDur) | 0;
                that.delayLine = new Float32Array(that.model.delayLength);
            }

            if (m.grainDur !== grainDur) {
                m.grainDur = grainDur;
                m.grainLength = (m.sampleRate * m.grainDur) | 0;
                for (i = 0; i < m.grainLength; i++) {
                    m.windowFunction[i] = Math.sin(Math.PI * i / m.grainLength);
                }
            }

            // If numGrains has changed, zero the extra buffers.
            // Need to hold on to "raw" input so we can compare unrounded values.
            if (m.rawNumGrains !== numGrains) {
                m.rawNumGrains = numGrains;
                numGrains = Math.round(numGrains);
                for (i = m.numGrains; i < numGrains; i++) {
                    m.currentGrainPosition[i] = 0;
                    m.currentGrainWindowPosition[i] = (Math.random() * m.grainLength) | 0;
                }
                m.numGrains = numGrains;
            }

            for (i = 0; i < numSamps; i++) {
                // Update the delay line's write position
                that.delayLine[m.writePos] = source[i];
                m.writePos = (m.writePos + 1) % m.delayLength;

                // Clear the previous output.
                out[i] = 0;

                // Now fill with grains
                for (j = 0; j < m.numGrains; j++) {
                    grainPos = m.currentGrainPosition[j];
                    windowPos = m.currentGrainWindowPosition[j];
                    amp = m.windowFunction[windowPos];
                    out[i] += that.delayLine[grainPos] * amp;

                    // Update positions in the delay line and grain envelope arrays for next time.
                    m.currentGrainPosition[j] = (grainPos + 1) % m.delayLength;
                    m.currentGrainWindowPosition[j] = (windowPos + 1) % m.grainLength;

                    // Randomize the reset position of grains.
                    if (m.currentGrainWindowPosition[j] === 0) {
                        m.currentGrainPosition[j] = (Math.random() * m.delayLength) | 0;
                    }
                }

                // Normalize the output amplitude.
                out[i] /= m.numGrains;
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.granulator", {
        rate: "audio",
        inputs: {
            source: null,
            grainDur: 0.1,
            delayDur: 1,
            numGrains: 5,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                grainLength: 0,
                numGrains: 0,
                currentGrainPosition: [],
                currentGrainWindowPosition: [],
                windowFunction: [],
                writePos: 0
            }
        }
    });

    flock.ugen.sequence = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var list = that.inputs.list,
                inputs = that.inputs,
                freq = inputs.freq.output,
                loop = inputs.loop.output[0],
                m = that.model,
                scale = m.scale,
                out = that.output,
                start = inputs.start ? Math.round(inputs.start.output[0]) : 0,
                end = inputs.end ? Math.round(inputs.end.output[0]) : list.length,
                startItem,
                i,
                j;

            if (m.value === undefined) {
                startItem = list[start];
                m.value = (startItem === undefined) ? 0.0 : startItem;
            }

            if (m.nextIdx === undefined) {
                m.nextIdx = start;
            }

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.freq) {
                if (m.nextIdx >= end) {
                    if (loop > 0.0) {
                        m.nextIdx = start;
                    } else {
                        out[i] = m.value;
                        continue;
                    }
                }

                out[i] = m.value = list[m.nextIdx];
                m.phase += freq[j] * scale;

                if (m.phase >= 1.0) {
                    m.phase = 0.0;
                    m.nextIdx++;
                }
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            that.model.scale = that.rate !== flock.rates.DEMAND ? that.model.sampleDur : 1;

            if (!that.inputs.list) {
                that.inputs.list = [];
            }

            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.sequence", {
        rate: "control",

        inputs: {
            start: 0,
            freq: 1.0,
            loop: 0.0,
            list: []
        },

        ugenOptions: {
            model: {
                phase: 0
            },

            strideInputs: ["freq"],
            noExpand: ["list"]
        }
    });

    flock.ugen.midiFreq = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                a4 = m.a4,
                a4Freq = a4.freq,
                a4NoteNum = a4.noteNum,
                notesPerOctave = m.notesPerOctave,
                noteNum = that.inputs.source.output,
                out = that.output,
                i,
                j;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.source) {
                out[i] = flock.midiFreq(noteNum[j], a4Freq, a4NoteNum, notesPerOctave);
            }
        };

        that.init = function () {
            that.model.octaveScale = 1 / that.model.notesPerOctave;
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.midiFreq", {
        rate: "control",
        inputs: {
            source: null
        },
        ugenOptions: {
            model: {
                a4: {
                    noteNum: 69,
                    freq: 440
                },
                notesPerOctave: 12
            },
            strideInputs: [
                "source"
            ]
        }
    });
}());
