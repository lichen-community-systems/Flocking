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
        DSP = flock.requireModule("dspapi", "DSP"),
        Filter = flock.requireModule("dspapi", "Filter");

    /*************
     * Utilities *
     *************/

    flock.isUGen = function (obj) {
        return obj && obj.tags && obj.tags.indexOf("flock.ugen") > -1;
    };

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
            that.mulAdd = flock.noOp;
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
            model: options.model || {
                unscaledValue: 0.0,
                value: 0.0
            },
            multiInputs: {},
            tags: ["flock.ugen"]
        };
        that.lastOutputIdx = that.output.length - 1;

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
                name,
                input;

            m.strides = m.strides || {};

            if (!strideNames) {
                return;
            }

            for (i = 0; i < strideNames.length; i++) {
                name = strideNames[i];
                input = inputs[name];

                if (input) {
                    m.strides[name] = input.rate === flock.rates.AUDIO ? 1 : 0;
                } else {
                    fluid.log(fluid.logLevel.WARN, "An invalid input ('" +
                        name + "') was found on a unit generator: " + that);
                }
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
            that.interpolate = flock.interpolate.none;
            if (o.interpolation) {
                var fn = flock.interpolate[o.interpolation];
                if (!fn) {
                    fluid.log(fluid.logLevel.IMPORTANT,
                        "An invalid interpolation type of '" + o.interpolation +
                        "' was specified. Defaulting to none.");
                } else {
                    that.interpolate = fn;
                }
            }

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

    flock.ugen.lastOutputValue = function (numSamps, out) {
        return out[numSamps - 1];
    };


    flock.ugen.value = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.value = function () {
            return that.model.value;
        };

        that.dynamicGen = function (numSamps) {
            var out = that.output,
                m = that.model;

            for (var i = 0; i < numSamps; i++) {
                out[i] = m.unscaledValue;
            }

            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function () {
            var inputs = that.inputs,
                m = that.model;

            m.value = m.unscaledValue = inputs.value;

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
            model: {
                unscaledValue: 1.0,
                value: 1.0
            },

            tags: ["flock.ugen.valueType"]
        }
    });


    flock.ugen.silence = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.onInputChanged = function () {
            for (var i = 0; i < that.output.length; i++) {
                that.output[i] = 0.0;
            }
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.silence", {
        rate: "constant"
    });


    flock.ugen.passThrough = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                source = that.inputs.source.output,
                out = that.output,
                i,
                val;

            for (i = 0; i < source.length; i++) {
                out[i] = val = source[i];
            }

            for (; i < numSamps; i++) {
                out[i] = val = 0.0;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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


    /**
     * Changes from the <code>initial</code> input to the <code>target</code> input
     * at the specified <code>time</code>. An optional <code>crossfade</code> duration
     * may be specified to linearly crossfade between the two inputs.
     *
     * Can be used to schedule sample-accurate changes.
     * Note that the <code>target</code> input will be evaluated from the beginning,
     * even if its value isn't yet output.
     *
     */
    flock.ugen.change = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                initial = that.inputs.initial.output,
                initialInc = m.strides.initial,
                target = that.inputs.target.output,
                targetInc = m.strides.target,
                out = that.output,
                samplesLeft = m.samplesLeft,
                crossfadeLevel = m.crossfadeLevel,
                val;

            for (var i = 0, j = 0, k = 0; i < numSamps; i++, j += initialInc, k += targetInc) {
                if (samplesLeft > 0) {
                    // We haven't hit the scheduled time yet.
                    val = initial[j];
                    samplesLeft--;
                } else if (crossfadeLevel > 0.0) {
                    // We've hit the scheduled time, but we still need to peform the crossfade.
                    val = (initial[j] * crossfadeLevel) + (target[k] * (1.0 - crossfadeLevel));
                    crossfadeLevel -= m.crossfadeStepSize;
                } else {
                    // We're done.
                    val = target[k];
                }

                out[i] = val;
            }

            m.samplesLeft = samplesLeft;
            m.crossfadeLevel = crossfadeLevel;
            m.value = m.unscaledValue = val;
        };

        that.onInputChanged = function (inputName) {
            var m = that.model,
                inputs = that.inputs;

            if (inputName === "time" || !inputName) {
                m.samplesLeft = Math.round(inputs.time.output[0] * m.sampleRate);
            }

            if (inputName === "crossfade" || !inputName) {
                m.crossfadeStepSize = 1.0 / Math.round(inputs.crossfade.output[0] * m.sampleRate);
                m.crossfadeLevel = inputs.crossfade.output[0] > 0.0 ? 1.0 : 0.0;
            }

            that.calculateStrides();
        };

        that.onInputChanged();

        return that;
    };

    fluid.defaults("flock.ugen.change", {
        rate: "audio",

        inputs: {
            /**
             * An input unit generator to output initially.
             * Can be audio, control, or constant rate.
             */
            initial: 0.0,

            /**
             * The unit generator to output after the specified time.
             * Can be audio, control, or constant rate.
             */
            target: 0.0,

            /**
             * The sample-accurate time (in seconds) at which the
             * the change should occur.
             */
            time: 0.0,

            /**
             * The duration of the optional linear crossfade between
             * the two values.
             */
            crossfade: 0.0
        },

        ugenOptions: {
            model: {
                samplesLeft: 0.0,
                crossfadeStepSize: 0,
                crossfadeLevel: 0.0,
                unscaledValue: 0.0,
                value: 0.0
            },
            strideInputs: ["initial", "target"]
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

            m.value = m.unscaledValue = val;
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
                unscaledValue: 0.0,
                value: 0.0,
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

            m.value = m.unscaledValue = flock.ugen.lastOutputValue(numSamps, out);
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
                unscaledValue: 0.0,
                value: 0.0,
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
            m.value = m.unscaledValue = sourceVal;
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
                unscaledValue: 0.0,
                value: 0.0,
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
            var m = that.model,
                op = that.activeInput,
                input = that.inputs[op],
                out = that.output,
                sourceBuf = flock.generate(that.expandedSource, that.inputs.source.output[0]);

            DSP[op](out, sourceBuf, input.output[0]);
            m.value = m.unscaledValue = out[out.length - 1];
        };

        that.krSourceArInputGen = function () {
            var m = that.model,
                op = that.activeInput,
                input = that.inputs[op],
                out = that.output,
                sourceBuf = flock.generate(that.expandedSource, that.inputs.source.output[0]);

            DSP[op](out, sourceBuf, input.output);
            m.value = m.unscaledValue = out[out.length - 1];
        };

        that.arSourceKrInputGen = function () {
            var m = that.model,
                op = that.activeInput,
                input = that.inputs[op],
                out = that.output,
                sourceBuf = that.inputs.source.output;

            DSP[op](out, sourceBuf, input.output[0]);
            m.value = m.unscaledValue = out[out.length - 1];
        };

        that.arSourceArInputGen = function () {
            var m = that.model,
                op = that.activeInput,
                input = that.inputs[op],
                out = that.output;

            DSP[op](that.output, that.inputs.source.output, input.output);
            m.value = m.unscaledValue = out[out.length - 1];
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
            var m = that.model,
                out = that.output,
                source = that.inputs.sources.output,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = source[i];
            }

            m.value = m.unscaledValue = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.sumGen = function (numSamps) {
            var m = that.model,
                sources = that.inputs.sources,
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

            m.value = m.unscaledValue = flock.ugen.lastOutputValue(numSamps, out);
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
                idx,
                val;

            for (i = 0, j = 0, k = 0; i < numSamps; i++, j += m.strides.phase, k += m.strides.freq) {
                idx = phase + phaseOffset[j] * tableIncRad;
                if (idx >= tableLen) {
                    idx -= tableLen;
                } else if (idx < 0) {
                    idx += tableLen;
                }
                out[i] = val = that.interpolate(idx, table);
                phase += freq[k] * tableIncHz;
                if (phase >= tableLen) {
                    phase -= tableLen;
                } else if (phase < 0) {
                    phase += tableLen;
                }
            }

            m.phase = phase;
            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            flock.ugen.osc.onInputChanged(that);

            // Precalculate table-related values.
            if (!inputName || inputName === "table") {
                var m = that.model,
                    table = that.inputs.table;

                if (table.length < 1) {
                    table = that.inputs.table = flock.ugen.osc.emptyTable;
                }

                m.tableLen = table.length;
                m.tableIncHz = m.tableLen / m.sampleRate;
                m.tableIncRad =  m.tableLen / flock.TWOPI;
            }
        };

        that.onInputChanged();
        return that;
    };

    flock.ugen.osc.emptyTable = new Float32Array([0, 0, 0]);

    flock.ugen.osc.onInputChanged = function (that) {
        that.calculateStrides();
        flock.onMulAddInputChanged(that);
    };

    fluid.defaults("flock.ugen.osc", {
        rate: "audio",
        inputs: {
            freq: 440.0,
            phase: 0.0,
            table: [],
            mul: null,
            add: null
        },
        ugenOptions: {
            interpolation: "linear",
            model: {
                phase: 0.0,
                unscaledValue: 0.0,
                value: 0.0
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
            inputs.table = flock.fillTable(s, tableFillFn);
            return flock.ugen.osc(inputs, output, options);
        };

        fluid.defaults(name, fluid.defaults("flock.ugen.osc"));
    };

    flock.ugen.osc.define("flock.ugen.sinOsc", flock.tableGenerators.sin);
    flock.ugen.osc.define("flock.ugen.triOsc", flock.tableGenerators.tri);
    flock.ugen.osc.define("flock.ugen.sawOsc", flock.tableGenerators.saw);
    flock.ugen.osc.define("flock.ugen.squareOsc", flock.tableGenerators.square);


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
                k,
                val;

            for (i = 0, j = 0, k = 0; i < numSamps; i++, j += m.strides.phase, k += m.strides.freq) {
                out[i] = val = Math.sin(phase + phaseOffset[j]);
                phase += freq[k] / sampleRate * flock.TWOPI;
            }

            m.phase = phase;
            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                phase: 0.0,
                unscaledValue: 0.0,
                value: 0.0
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
                j,
                val;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.freq) {
                out[i] = val = phase + phaseOffset;
                phase += freq[j] * scale;
                if (phase >= 1.0) {
                    phase -= 2.0;
                } else if (phase <= -1.0) {
                    phase += 2.0;
                }
            }

            m.phase = phase;
            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
            model: {
                phase: 0.0,
                freqInc: 1,
                unscaledValue: 0.0,
                value: 0.0
            },
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
                j,
                val;

            for (i = 0, j = 0; i < numSamps; i++, j += freqInc) {
                if (phase >= 1.0) {
                    phase -= 1.0;
                    out[i] = val = width < 0.5 ? 1.0 : -1.0;
                } else {
                    out[i] = val = phase < width ? 1.0 : -1.0;
                }
                phase += freq[j] * scale;
            }

            m.phase = phase;
            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
        },
        ugenOptions: {
            model: {
                phase: 0.0,
                freqInc: 1,
                unscaledValue: 0.0,
                value: 0.0
            }
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
            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                phase: 0.0,
                scale: 0.0,
                unscaledValue: 0.0,
                value: 0.0
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
                out = that.output,
                val;

            // Clear the output buffer.
            for (var i = 0; i < out.length; i++) {
                out[i] = val = 0.0;
            }

            // Write the trigger value to the audio stream if it's open.
            if (trig > 0.0 && m.prevTrig <= 0.0) {
                out[offset] = val = trig;
            }

            m.prevTrig = trig;
            m.value = m.unscaledValue = val;
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
                prevTrig: 0.0,
                unscaledValue: 0.0,
                value: 0.0
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
                currTrig,
                val;

            if (m.holdVal === undefined) {
                m.holdVal = source[0];
            }

            for (i = 0, j = 0; i < numSamps; i++, j += sourceInc) {
                currTrig = trig.output[i];
                out[i] = val = (currTrig > 0.0 && m.prevTrig <= 0.0) ? m.holdVal = source[j] : m.holdVal;
                m.prevTrig = currTrig;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.krGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                currTrig = that.inputs.trigger.output[0],
                i;

            if (m.holdVal === undefined || currTrig > 0.0 && m.prevTrig <= 0.0) {
                m.holdVal = that.inputs.source.output[0];
            }
            m.prevTrig = currTrig;

            for (i = 0; i < numSamps; i++) {
                out[i] = m.holdVal;
            }

            m.unscaledValue = m.holdVal;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                prevTrig: 0.0,
                unscaledValue: 0.0,
                value: 0.0
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

        that.defaultKrTriggerGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                chan = that.inputs.channel.output[0],
                source = that.buffer.data.channels[chan],
                bufIdx = m.idx,
                loop = that.inputs.loop.output[0],
                trigVal = inputs.trigger.output[0],
                i,
                samp;

            if (trigVal > 0.0 && m.prevTrig <= 0.0) {
                bufIdx = 0;
            }
            m.prevTrig = trigVal;

            for (i = 0; i < numSamps; i++) {
                if (bufIdx > m.lastIdx) {
                    if (loop > 0.0 && trigVal > 0.0) {
                        bufIdx = 0;
                    } else {
                        out[i] = samp = 0.0;
                        continue;
                    }
                }

                samp = that.interpolate(bufIdx, source);
                out[i] = samp;
                bufIdx++;
            }

            m.idx = bufIdx;
            m.unscaledValue = samp;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.otherwiseGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                chan = that.inputs.channel.output[0],
                speed = that.inputs.speed.output,
                source = that.buffer.data.channels[chan],
                trig = inputs.trigger.output,
                bufIdx = m.idx,
                loop = that.inputs.loop.output[0],
                start = (that.inputs.start.output[0] * m.lastIdx) | 0,
                end = (that.inputs.end.output[0] * m.lastIdx) | 0,
                i,
                j,
                k,
                trigVal,
                speedVal,
                samp;

            for (i = 0, j = 0, k = 0; i < numSamps; i++, j += m.strides.trigger, k += m.strides.speed) {
                trigVal = trig[j];
                speedVal = speed[k];

                if (trigVal > 0.0 && m.prevTrig <= 0.0) {
                    bufIdx = flock.ugen.playBuffer.resetIndex(speedVal, start, end);
                } else if (bufIdx < start || bufIdx > end) {
                    if (loop > 0.0 && trigVal > 0.0) {
                        bufIdx = flock.ugen.playBuffer.resetIndex(speedVal, start, end);
                    } else {
                        out[i] = samp = 0.0;
                        continue;
                    }
                }
                m.prevTrig = trig[j];

                samp = that.interpolate(bufIdx, source);
                out[i] = samp;
                bufIdx += m.stepSize * speedVal;
            }

            m.idx = bufIdx;
            m.unscaledValue = samp;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            var inputs = that.inputs,
                speed = inputs.speed,
                start = inputs.start,
                end = inputs.end,
                trig = inputs.trigger;

            that.onBufferInputChanged(inputName);

            // TODO: Optimize for non-regular speed constant rate input.
            that.gen = (speed.rate === flock.rates.CONSTANT && speed.output[0] === 1.0) &&
                (start.rate === flock.rates.CONSTANT && start.output[0] === 0.0) &&
                (end.rate === flock.rates.CONSTANT && end.output[0] === 1.0) &&
                (trig.rate !== flock.rates.AUDIO) ?
                that.defaultKrTriggerGen : that.otherwiseGen;

            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.onBufferReady = function () {
            var m = that.model,
                end = that.inputs.end.output[0],
                chan = that.inputs.channel.output[0],
                buf = that.buffer.data.channels[chan],
                len = buf.length;

            m.idx = (end * len) | 0;
            m.lastIdx = len - 1;
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

    flock.ugen.playBuffer.resetIndex = function (speed, start, end) {
        return speed > 0 ? start : end;
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
                finished: false,
                unscaledValue: 0.0,
                value: 0.0,
                idx: 0,
                stepSize: 0,
                prevTrig: 0,
                channel: undefined
            },
            strideInputs: ["trigger", "speed"],
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
                val = that.interpolate(bufIdx, source);
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                channel: undefined,
                unscaledValue: 0.0,
                value: 0.0
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
                out = that.output,
                chan = that.inputs.channel.output[0],
                source = that.buffer.data.channels[chan],
                rate = that.buffer.format.sampleRate,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = source.length / rate;
            }

            m.unscaledValue = m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
        };

        that.onBufferReady = function () {
            that.krGen(1);
        };

        that.init = function () {
            var r = that.rate;
            that.gen = (r === flock.rates.CONTROL || r === flock.rates.AUDIO) ? that.krGen : undefined;
            that.output[0] = 0.0;
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
                unscaledValue: 0.0,
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
                out = that.output,
                chan = that.inputs.channel.output[0],
                source = that.buffer.data.channels[chan],
                len = source.length,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = len;
            }

            m.value = m.unscaledValue = len;
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
        };

        that.onBufferReady = function () {
            that.krGen(1);
        };

        that.init = function () {
            var r = that.rate;
            that.gen = (r === flock.rates.CONTROL || r === flock.rates.AUDIO) ? that.krGen : undefined;
            that.output[0] = 0.0;
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
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });

    /**
     * Outputs a phase step value for playing the specified buffer at its normal playback rate.
     * This unit generator takes into account any differences between the sound file's sample rate and
     * the environment's audio rate.
     *
     * Inputs:
     *  buffer: a bufDef object specifying the buffer to track
     */
    flock.ugen.bufferPhaseStep = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.krGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                val = m.unscaledValue,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = val;
            }

            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
            that.output[0] = m.unscaledValue = 1 / (source.length * m.scale);
        };

        that.init = function () {
            var r = that.rate;
            that.gen = (r === flock.rates.CONTROL || r === flock.rates.AUDIO) ? that.krGen : undefined;
            that.output[0] = 0.0;
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
                scale: 1.0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });

    /**
     * Constant-rate unit generator that outputs the environment's current audio sample rate.
     */
    flock.ugen.sampleRate = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options),
            m = that.model;

        that.output[0] = m.value = m.unscaledValue = that.options.audioSettings.rates.audio;

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
                out = that.output,
                density = inputs.density.output[0], // Density is kr.
                threshold,
                scale,
                rand,
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
                rand = Math.random();
                val = (rand < threshold) ? rand * scale : 0.0;
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                threshold: 0.0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });


    flock.ugen.whiteNoise = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                i,
                val;

            for (i = 0; i < numSamps; i++) {
                out[i] = val = Math.random();
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
            var m = that.model,
                state = m.state,
                a = that.a,
                p = that.p,
                offset = m.offset,
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
                val = val * 2 - offset;
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                state: 0.0,
                unscaledValue: 0.0,
                value: 0.0,
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
                        m.start = m.unscaledValue = m.end;
                        m.end = Math.random();
                        m.ramp = m.ramp = (m.end - m.start) / m.counter;
                    } else {
                        m.start = m.unscaledValue = Math.random();
                        m.ramp = 0;
                    }
                }
                sampsForLevel = remain < m.counter ? remain : m.counter;
                remain -= sampsForLevel;
                m.counter -= sampsForLevel;
                for (i = 0; i < sampsForLevel; i++) {
                    out[currSamp] = m.unscaledValue;
                     // TODO: This reuse of "unscaledValue" will cause the model to be out of sync
                     // with the actual output of the unit generator.
                    m.unscaledValue += m.ramp;
                    currSamp++;
                }

            } while (remain);

            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                level: 0,
                unscaledValue: 0.0,
                value: 0.0
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
            var m = that.model,
                generator = that.generator,
                out = that.output,
                i,
                val;

            for (i = 0; i < numSamps; i++) {
                out[i] = val = generator.uniform(-1, 1);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
            var m = that.model,
                generator = that.generator,
                out = that.output,
                lambda = that.inputs.lambda.output,
                lambdaInc = that.model.strides.lambda,
                i,
                j,
                val;

            for (i = j = 0; i < numSamps; i++, j += lambdaInc) {
                out[i] = val = generator.exponential(lambda[j]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                k,
                val;

            for (i = j = k = 0; i < numSamps; i++, j += alphaInc, k += betaInc) {
                out[i] = val = generator.gamma(alpha[j], beta[k]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                k,
                val;

            for (i = j = k = 0; i < numSamps; i++, j += muInc, k += sigmaInc) {
                out[i] = val = generator.normal(mu[j], sigma[k]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
            var m = that.model,
                generator = that.generator,
                out = that.output,
                alphaInc = that.model.strides.alpha,
                alpha = that.inputs.alpha.output,
                i,
                j,
                val;

            for (i = j = 0; i < numSamps; i++, j += alphaInc) {
                out[i] = val = generator.pareto(alpha[j]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
            var m = that.model,
                generator = that.generator,
                out = that.output,
                modeInc = that.model.strides.mode,
                mode = that.inputs.mode.output,
                i,
                j,
                val;

            for (i = j = 0; i < numSamps; i++, j += modeInc) {
                out[i] = val = generator.triangular(-1, 1, mode[j]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                k,
                val;

            for (i = j = k = 0; i < numSamps; i++, j += alphaInc, k += betaInc) {
                out[i] = val = generator.weibull(alpha[j], beta[k]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
            if (m.unscaledValue === undefined) {
                m.unscaledValue = inputs.start.output[0];
            }

            for (i = 0, j = 0, k = 0; i < numSamps; i++, j += m.strides.trigger, k += m.strides.step) {
                if ((trig[j] > 0.0 && m.prevTrig <= 0.0)) {
                    m.unscaledValue = inputs.reset.output[0];
                }
                m.prevTrig = trig[j];

                if (m.unscaledValue >= inputs.end.output[0]) {
                    m.unscaledValue = inputs.start.output[0];
                }

                out[i] = m.unscaledValue;
                m.unscaledValue += step[k]; // TODO: Model out of sync with last output sample.
            }

            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
            model: {
                unscaledValue: undefined,
                value: 0.0
            },

            strideInputs: [
                "trigger",
                "step"
            ]
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

            m.unscaledValue = m.prevVal = prevVal;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                prevVal: 0.0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });

    flock.ugen.normalize = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function () {
            var m = that.model,
                out = that.output,
                max = that.inputs.max.output[0], // Max is kr.
                source = that.inputs.source.output;

            // Note, this normalizes the source input ugen's output buffer directly in place.
            flock.normalize(source, max, out);
            m.value = m.unscaledValue = out[out.length - 1];
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
                k,
                val;

            for (i = j = k = 0; i < numSamps; i++, j += sideChainInc, k += thresholdInc) {
                if (sideChain[j] >= threshold[k]) {
                    out[i] = val = lastValue = source[i];
                } else {
                    // TODO: Don't check holdLast on each sample.
                    out[i] = val = holdLast ? lastValue : 0;
                }
            }

            m.lastValue = lastValue;
            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                unscaledValue: 0.0,
                value: 0.0,
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
            var lastIdx = numSamps - 1;
            m.value[0] = outputs[0][lastIdx];
            m.value[1] = outputs[1][lastIdx];
        };

        that.init = function () {
            that.onInputChanged();
            that.model.unscaledValue = that.model.value;
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.pan2", {
        rate: "audio",

        inputs: {
            source: null,
            pan: 0 // -1 (hard left)..0 (centre)..1 (hard right)
        },

        ugenOptions: {
            model: {
                unscaledValue: [0.0, 0.0],
                value: [0.0, 0.0]
            },
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
        // TODO: This function is marked as unoptimized by the Chrome profiler.
        that.gen = function (numSamps) {
            var m = that.model,
                sources = that.multiInputs.sources,
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

            // TODO: Consider how we should handle "value" when the number
            // of input channels for "sources" can be variable.
            // In the meantime, we just output the last source's last sample.
            m.value = m.unscaledValue = source.output[outIdx];
            that.mulAdd(numSamps); // TODO: Does this even work?
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
            var m = that.model,
                sources = that.inputs.sources,
                i;

            for (i = 0; i < sources.length; i++) {
                m.value[i] = sources[i].output[0];
            }
        };

        that.ugenSourceGen = function () {
            that.model.value = that.model.unscaledValue = that.inputs.sources.output[0];
        };

        that.onInputChanged = function () {
            var m = that.model,
                sources = that.inputs.sources;

            if (flock.isIterable(sources)) {
                that.gen = that.arraySourceGen;
                m.value = new Float32Array(sources.length);
                m.unscaledValue = m.value;
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
                unscaledValue: null,
                value: null
            },

            tags: ["flock.ugen.outputType", "flock.ugen.valueType"]
        }
    });

    // TODO: fix naming.
    flock.ugen["in"] = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.singleBusGen = function (numSamps) {
            var m = that.model,
                out = that.output;

            flock.ugen.in.readBus(numSamps, out, that.inputs.bus,
                that.options.audioSettings.buses);

            m.unscaledValue = flock.ugen.lastOutputValue(numSamps, out);
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.multiBusGen = function (numSamps) {
            var m = that.model,
                busesInput = that.inputs.bus,
                enviroBuses = that.options.audioSettings.buses,
                out = that.output,
                i,
                j,
                busIdx,
                val;

            for (i = 0; i < numSamps; i++) {
                val = 0; // Clear previous output values before summing a new set.
                for (j = 0; j < busesInput.length; j++) {
                    busIdx = busesInput[j].output[0] | 0;
                    val += enviroBuses[busIdx][i];
                }
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function () {
            that.gen = flock.isIterable(that.inputs.bus) ? that.multiBusGen : that.singleBusGen;
            flock.onMulAddInputChanged(that);
        };

        that.onInputChanged();
        return that;
    };

    flock.ugen.in.readBus = function (numSamps, out, busInput, buses) {
        var busNum = busInput.output[0] | 0,
            bus = buses[busNum],
            i;

        for (i = 0; i < numSamps; i++) {
            out[i] = bus[i];
        }
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

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                bus = that.bus,
                i,
                val;

            for (i = 0; i < numSamps; i++) {
                out[i] = val = bus[i];
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function () {
            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            // TODO: Direct reference to the shared environment.
            var busNum = flock.enviro.shared.audioStrategy.inputDeviceManager.openAudioDevice(options);
            that.bus = that.options.audioSettings.buses[busNum];

            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.audioIn", {
        rate: "audio",
        inputs: {
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
                out = that.output,
                inputs = that.inputs,
                q = inputs.q.output[0],
                freq = inputs.freq.output[0];

            if (m.prevFreq !== freq || m.prevQ !== q) {
                that.updateCoefficients(m, freq, q);
            }

            that.filterEngine.filter(out, that.inputs.source.output);

            m.prevQ = q;
            m.prevFreq = freq;
            m.value = m.unscaledValue = out[out.length - 1];
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
            m.value = m.unscaledValue = flock.ugen.lastOutputValue(numSamps, out);
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

            m.unscaledValue = m.out4;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                in1: 0.0,
                in2: 0.0,
                in3: 0.0,
                in4: 0.0,
                out1: 0.0,
                out2: 0.0,
                out3: 0.0,
                out4: 0.0,
                prevCutoff: undefined,
                prevResonance: undefined,
                f: undefined,
                fSq: undefined,
                fSqSq: undefined,
                oneMinusF: undefined,
                fb: undefined,
                unscaledValue: 0.0,
                value: 0.0
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
                i,
                val;

            if (time !== m.time) {
                m.time = time;
                m.delaySamps = time * that.model.sampleRate;
            }

            for (i = 0; i < numSamps; i++) {
                if (m.pos >= m.delaySamps) {
                    m.pos = 0;
                }
                out[i] = val = delayBuffer[m.pos];
                delayBuffer[m.pos] = source[i];
                m.pos++;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                pos: 0,
                unscaledValue: 0.0,
                value: 0.0
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
                prevVal = m.prevVal,
                i,
                val;

            for (i = 0; i < numSamps; i++) {
                out[i] = val = prevVal;
                prevVal = source[i];
            }

            m.prevVal = prevVal;
            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                prevVal: 0.0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });


    flock.ugen.freeverb = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        that.tunings = that.options.tunings;
        that.allpassTunings = that.options.allpassTunings;

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                source = inputs.source.output,
                mix = inputs.mix.output[0],
                dry = 1 - mix,
                roomsize = inputs.room.output[0],
                room_scaled = roomsize * 0.28 + 0.7,
                damp = inputs.damp.output[0],
                damp1 = damp * 0.4,
                damp2 = 1.0 - damp1,
                i,
                j,
                val;

            for (i = 0; i < numSamps; i++) {
                // read inputs
                var inp = source[i];
                var inp_scaled = inp * 0.015;

                // read samples from the allpasses
                for (j = 0; j < that.buffers_a.length; j++) {
                    if (++that.bufferindices_a[j] === that.allpassTunings[j]) {
                        that.bufferindices_a[j] = 0;
                    }
                    that.readsamp_a[j] = that.buffers_a[j][that.bufferindices_a[j]];
                }

                // foreach comb buffer, we perform same filtering (only bufferlen differs)
                for (j = 0; j < that.buffers_c.length; j++) {
                    if (++that.bufferindices_c[j] === that.tunings[j]) {
                        that.bufferindices_c[j] = 0;
                    }
                    var bufIdx_c = that.bufferindices_c[j],
                        readsamp_c = that.buffers_c[j][bufIdx_c];
                    that.filterx_c[j] = (damp2 * that.filtery_c[j]) + (damp1 * that.filterx_c[j]);
                    that.buffers_c[j][bufIdx_c] = inp_scaled + (room_scaled * that.filterx_c[j]);
                    that.filtery_c[j] = readsamp_c;
                }

                // each allpass is handled individually,
                // with different calculations made and stored into the delaylines
                var ftemp8 = (that.filtery_c[6] + that.filtery_c[7]);

                that.buffers_a[3][that.bufferindices_a[3]] = ((((0.5 * that.filterx_a[3]) + that.filtery_c[0]) +
                    (that.filtery_c[1] + that.filtery_c[2])) +
                    ((that.filtery_c[3] + that.filtery_c[4]) + (that.filtery_c[5] + ftemp8)));
                that.filterx_a[3] = that.readsamp_a[3];
                that.filtery_a[3] = (that.filterx_a[3] - (((that.filtery_c[0] + that.filtery_c[1]) +
                    (that.filtery_c[2] + that.filtery_c[3])) +
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
                val = ((dry * inp) + (mix * that.filtery_a[0]));
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.initDelayLines = function () {
            // Initialise the delay lines
            that.buffers_c = new Array(8);
            that.bufferindices_c = new Int32Array(8);
            that.filterx_c = new Float32Array(8);
            that.filtery_c = new Float32Array(8);
            var spread = that.model.spread;
            var i, j;
            for(i = 0; i < that.buffers_c.length; i++) {
                that.buffers_c[i] = new Float32Array(that.tunings[i]+spread);
                that.bufferindices_c[i] = 0;
                that.filterx_c[i] = 0;
                that.filtery_c[i] = 0;
                for(j = 0; j < that.tunings[i]+spread; j++) {
                    that.buffers_c[i][j] = 0;
                }
            }
            that.buffers_a = new Array(4);
            that.bufferindices_a = new Int32Array(4);
            that.filterx_a = new Float32Array(4);
            that.filtery_a = new Float32Array(4);
            // "readsamp" vars are temporary values read back from the delay lines,
            // not stored but only used in the gen loop
            that.readsamp_a = new Float32Array(4);
            for (i = 0; i < that.buffers_a.length; i++) {
                that.bufferindices_a[i] = 0;
                that.filterx_a[i] = 0;
                that.filtery_a[i] = 0;
                that.readsamp_a[i] = 0;
                // TODO is this what the spread is meant to do?
                for (j = 0; j < that.allpassTunings.length; j++) {
                    that.allpassTunings[j] += spread;
                }
                that.buffers_a[i] = new Float32Array(that.allpassTunings[i]);
                for (j = 0; j < that.allpassTunings[i]; j++) {
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
            source: null,
            mix: 0.33,
            room: 0.5,
            damp: 0.5
        },
        ugenOptions: {
            model: {
                spread: 0,
                unscaledValue: 0.0,
                value: 0.0
            },

            tunings: [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617],
            allpassTunings: [556, 441, 341, 225]
        }
    });


    /**
     * A simple waveshaper-based distortion effect.
     * Uses the polynomial y = (3/2) * x - (1/2) * x^3.
     * http://www.musicdsp.org/showone.php?id=114
     *
     * Inputs:
     *   - source: the input signal to distort
     *   - gain: the gain factor to apply [1.0..Infinity]
     */
    flock.ugen.distortion = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                source = that.inputs.source.output,
                sourceInc = m.strides.source,
                gain = that.inputs.gain.output,
                gainInc = m.strides.gain,
                val,
                dist,
                i,
                j,
                k;

            for (i = j =  k = 0; i < numSamps; i++, j += sourceInc, k += gainInc) {
                val = source[j] * gain[k];
                dist = 1.5 * val - 0.5 * val * val * val;
                out[i] = dist;
            }

            m.unscaledValue = dist;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged();

        return that;
    };

    fluid.defaults("flock.ugen.distortion", {
        rate: "audio",
        inputs: {
            source: null,
            gain: 1.0
        },
        ugenOptions: {
            strideInputs: ["source", "gain"]
        }
    });


    /**
     * A simple waveshaper-based distortion effect by Bram de Jonge.
     * http://www.musicdsp.org/showone.php?id=41
     *
     * Inputs:
     *   - source: the input signal
     *   - amount: a value between 1 and Infinity that represents the amount of distortion
     *             to apply.
     */
    flock.ugen.distortion.deJonge = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                source = that.inputs.source.output,
                sourceInc = m.strides.source,
                amount = that.inputs.amount.output,
                amountInc = m.strides.amount,
                x,
                a,
                absX,
                dist,
                i,
                j,
                k;

            for (i = j = k = 0; i < numSamps; i++, j += sourceInc, k += amountInc) {
                x = source[j];
                a = amount[k];
                absX = Math.abs(x);
                dist = x * (absX + a) / ((x * x) + (a - 1) * absX + 1);
                out[i] = dist;
            }

            m.unscaledValue = dist;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged();

        return that;
    };

    fluid.defaults("flock.ugen.distortion.deJonge", {
        rate: "audio",
        inputs: {
            source: null,
            amount: 2
        },
        ugenOptions: {
            strideInputs: ["source", "amount"]
        }
    });


    /**
     * A simple waveshaper-based distortion effect by Partice Tarrabia and Bram de Jong.
     * http://www.musicdsp.org/showone.php?id=46
     *
     * Inputs:
     *   - source: the input signal
     *   - amount: a value between -1 and 1 that represents the amount of distortion
     *             to apply.
     */
    flock.ugen.distortion.tarrabiaDeJonge = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                source = that.inputs.source.output,
                sourceInc = m.strides.source,
                amount = that.inputs.amount.output,
                amountInc = m.strides.amount,
                x,
                a,
                dist,
                i,
                sIdx,
                aIdx,
                k;

            for (i = sIdx = aIdx = 0; i < numSamps; i++, sIdx += sourceInc, aIdx += amountInc) {
                x = source[sIdx];
                a = amount[aIdx];

                // Expects an amount value in the range of
                // -1.0 to 1.0, but NaNs are produced with exact 1.0s.
                if (a >= 1.0) {
                    a = 0.9999999999999999;
                } else if (a < -1.0) {
                    a = -1.0;
                }

                k = 2 * a / (1 - a);
                dist = (1 + k) * x / (1 + k * Math.abs(x));
                out[i] = dist;
            }

            m.unscaledValue = dist;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged();

        return that;
    };

    fluid.defaults("flock.ugen.distortion.tarrabiaDeJonge", {
        rate: "audio",
        inputs: {
            source: null,
            amount: 10
        },
        ugenOptions: {
            strideInputs: ["source", "amount"]
        }
    });


    /**
     * Waveshaper distortion by Laurent de Soras.
     * http://www.musicdsp.org/showone.php?id=86
     *
     * Inputs:
     *   - source: the signal to distort
     *   - gain: the gain factor to apply [1.0..Infinity]
     */
    flock.ugen.distortion.gloubiBoulga = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                source = that.inputs.source.output,
                sourceInc = m.strides.source,
                gain = that.inputs.gain.output,
                gainInc = m.strides.gain,
                val,
                dist,
                i,
                j,
                k,
                x,
                a,
                expX;

            for (i = j = k = 0; i < numSamps; i++, j += sourceInc, k += gainInc) {
                val = source[j] * gain[k];
                x = val * 0.686306;
                a = 1 + Math.exp(Math.sqrt(Math.abs(x)) * -0.75);
                expX = Math.exp(x);
                dist = (expX - Math.exp(-x * a)) / (expX + Math.exp(-x));
                out[i] = dist;
            }

            m.unscaledValue = dist;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged();

        return that;
    };

    fluid.defaults("flock.ugen.distortion.gloubiBoulga", {
        rate: "audio",
        inputs: {
            source: null,
            gain: 1.0
        },
        ugenOptions: {
            strideInputs: ["source", "gain"]
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
                i,
                val;

            if (time !== m.time) {
                m.time = time;
                m.coeff = time === 0.0 ? 0.0 : Math.exp(flock.LOG001 / (time * that.model.sampleRate));
            }

            // TODO: Optimize this conditional.
            if (m.coeff === 0.0) {
                for (i = 0; i < numSamps; i++) {
                    out[i] = val = source[i];
                }
            } else {
                for (i = 0; i < numSamps; i++) {
                    m.lastSamp = source[i] + m.coeff * m.lastSamp;
                    out[i] = val = m.lastSamp;
                }
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                coeff: 0,
                value: 0.0
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
                bufRate = that.buffer.format.sampleRate,
                dur = inputs.dur.output[0],
                amp = inputs.amp.output,
                centerPos = inputs.centerPos.output,
                trigger = inputs.trigger.output,
                speed = inputs.speed.output,
                grainEnv = that.options.grainEnv,
                lastOutIdx = numSamps - 1,
                posIdx = 0,
                trigIdx = 0,
                ampIdx = 0,
                speedIdx = 0,
                i,
                j,
                k,
                grain,
                start,
                samp,
                env;

            // Trigger new grains.
            for (i = 0; i < numSamps; i++) {
                if (trigger[trigIdx] > 0.0 && m.prevTrigger <= 0.0 && m.activeGrains.length < m.maxNumGrains) {
                    grain = m.freeGrains.pop();
                    grain.numSamps = m.sampleRate * dur;
                    grain.centerIdx = (grain.numSamps / 2) * m.stepSize;
                    grain.envScale = that.options.grainEnv.length / grain.numSamps;
                    grain.sampIdx = 0;
                    grain.amp = amp[ampIdx];
                    start = (centerPos[posIdx] * bufRate) - grain.centerIdx;
                    while (start < 0) {
                        start += buf.length;
                    }
                    grain.readPos = start;
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
                for (k = grain.writePos; k < Math.min(k + (grain.numSamps - grain.sampIdx), numSamps); k++) {
                    samp = that.interpolate(grain.readPos, buf);
                    env = flock.interpolate.linear(grain.sampIdx * grain.envScale, grainEnv);
                    out[k] += samp * env * grain.amp;
                    grain.readPos = (grain.readPos + (m.stepSize * grain.speed)) % buf.length;
                    grain.sampIdx++;
                }
                if (grain.sampIdx >= grain.numSamps) {
                    m.freeGrains.push(grain);
                    m.activeGrains.splice(j, 1);
                } else {
                    j++;
                    grain.writePos = k % numSamps;
                }
            }

            m.unscaledValue = out[lastOutIdx];
            that.mulAdd(numSamps);
            m.value = out[lastOutIdx];
        };

        that.onBufferReady = function () {
            var m = that.model;
            m.stepSize = that.buffer.format.sampleRate / m.sampleRate;
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
                    numSamps: 0,
                    centerIdx: 0.0,
                    envScale: 0.0,
                    sampIdx: 0,
                    amp: 0.0,
                    readPos: 0.0,
                    writePos: 0,
                    speed: 0.0
                });
            }
        };

        that.init = function () {
            flock.ugen.buffer(that);
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
            trigger: 0.0,
            buffer: null,
            mul: null,
            add: null
        },
        ugenOptions: {
            grainEnv: flock.fillTable(8192, flock.tableGenerators.hann),
            model: {
                unscaledValue: 0.0,
                value: 0.0,
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
                o = that.options,
                inputs = that.inputs,
                out = that.output,
                delayLine = that.delayLine,
                grainDur = inputs.grainDur.output[0],
                delayDur = inputs.delayDur.output[0],
                numGrains = inputs.numGrains.output[0],
                source = inputs.source.output,
                maxDelayDur = o.maxDelayDur,
                grainEnv = o.grainEnv,
                i,
                j,
                val,
                grainIdx,
                delayLineReadIdx,
                samp,
                windowPos,
                amp;

            // Update and clamp the delay line length.
            if (m.delayDur !== delayDur) {
                m.delayDur = delayDur;

                if (delayDur > maxDelayDur) {
                    delayDur = maxDelayDur;
                }

                m.delayLength = (delayDur * m.sampleRate) | 0;
                m.writePos = m.writePos % m.delayLength;
            }

            // Update the grain duration.
            if (m.grainDur !== grainDur) {
                m.grainDur = grainDur;
                m.grainLength = (m.sampleRate * m.grainDur) | 0;
                m.envScale = grainEnv.length / m.grainLength;
            }

            // TODO: This implementation will cause currently-sounding grains
            // to be stopped immediately, rather than being allowed to finish.
            numGrains = numGrains > o.maxNumGrains ? o.maxNumGrains : Math.round(numGrains);

            for (i = 0; i < numSamps; i++) {
                // Write into the delay line and update the write position.
                delayLine[m.writePos] = source[i];
                m.writePos = ++m.writePos % m.delayLength;

                // Clear the previous output.
                val = 0;

                // Now fill with grains
                for (j = 0; j < numGrains; j++) {
                    grainIdx = m.grainIdx[j];
                    delayLineReadIdx = m.delayLineIdx[j];

                    // Randomize the reset position of finished grains.
                    if (grainIdx > m.grainLength) {
                        grainIdx = 0;
                        delayLineReadIdx = (Math.random() * m.delayLength) | 0;
                    }

                    samp = delayLine[delayLineReadIdx];
                    windowPos = grainIdx * m.envScale;
                    amp = flock.interpolate.linear(windowPos, grainEnv);
                    val += samp * amp;

                    // Update positions in the delay line and grain envelope arrays for next time.
                    m.delayLineIdx[j] = ++delayLineReadIdx % m.delayLength;
                    m.grainIdx[j] = ++grainIdx;
                }

                val = val / numGrains;
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.initGrains = function () {
            var m = that.model;

            for (var i = 0; i < that.options.maxNumGrains; i++) {
                m.grainIdx[i] = 0;
                m.delayLineIdx[i] = Math.random() * m.delayLength;
            }
        };

        that.init = function () {
            var m = that.model,
                o = that.options,
                delayLineLen = (o.maxDelayDur * m.sampleRate) | 0;

            that.delayLine = new Float32Array(delayLineLen);
            m.delayLength = delayLineLen;
            m.delayLineIdx = new Uint32Array(o.maxNumGrains);
            m.grainIdx = new Uint32Array(o.maxNumGrains);

            that.initGrains();
            that.onInputChanged();
        };

        that.init();

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
            maxNumGrains: 512,
            maxDelayDur: 30,
            grainEnv: flock.fillTable(8192, flock.tableGenerators.sinWindow),
            model: {
                unscaledValue: 0.0,
                value: 0.0,
                grainLength: 0,
                writePos: 0
            }
        }
    });


    // TODO: Unit tests.
    flock.ugen.print = function (input, output, options) {
        var that = flock.ugen(input, output, options);

        that.gen = function (numSamps) {
            var inputs = that.inputs,
                out = that.output,
                m = that.model,
                label = m.label,
                chan = inputs.channel,
                // Basic multichannel support. This should be inproved
                // by factoring the multichannel input code out of flock.ugen.out.
                source = chan ? inputs.source.output[chan.output[0]] : inputs.source.output,
                trig = inputs.trigger.output[0],
                freq = inputs.freq.output[0],
                i,
                j,
                val;

            if (trig > 0.0 && m.prevTrig <= 0.0) {
                fluid.log(fluid.logLevel.IMPORTANT, label + source);
            }

            if (m.freq !== freq) {
                m.sampInterval = Math.round(m.sampleRate / freq);
                m.freq = freq;
                m.counter = m.sampInterval;
            }

            for (i = 0, j = 0 ; i < numSamps; i++, j += m.strides.source) {
                if (m.counter >= m.sampInterval) {
                    fluid.log(fluid.logLevel.IMPORTANT, label + source[j]);
                    m.counter = 0;
                }
                m.counter++;
                out[i] = val = source[i];
            }

            m.value = m.unscaledValue = val;
        };

        that.init = function () {
            var o = that.options;
            that.model.label = o.label ? o.label + ": " : "";
            that.onInputChanged();
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
                unscaledValue: 0.0,
                value: 0.0,
                counter: 0
            },
            strideInputs: ["source"]
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

            if (m.unscaledValue === undefined) {
                startItem = list[start];
                m.unscaledValue = (startItem === undefined) ? 0.0 : startItem;
            }

            if (m.nextIdx === undefined) {
                m.nextIdx = start;
            }

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.freq) {
                if (m.nextIdx >= end) {
                    if (loop > 0.0) {
                        m.nextIdx = start;
                    } else {
                        out[i] = m.unscaledValue;
                        continue;
                    }
                }

                out[i] = m.unscaledValue = list[m.nextIdx];
                m.phase += freq[j] * scale;

                if (m.phase >= 1.0) {
                    m.phase = 0.0;
                    m.nextIdx++;
                }
            }

            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
                unscaledValue: undefined,
                value: 0.0,
                phase: 0
            },

            strideInputs: ["freq"]
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
                j,
                val;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.source) {
                out[i] = val = flock.midiFreq(noteNum[j], a4Freq, a4NoteNum, notesPerOctave);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
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
            source: null // TODO: This input should be named "note"
        },
        ugenOptions: {
            model: {
                unscaledValue: 0.0,
                value: 0.0,
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
