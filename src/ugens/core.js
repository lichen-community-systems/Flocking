/*
 * Flocking Core Unit Generators
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2014, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/
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

    var $ = fluid.registerNamespace("jQuery");

    flock.ugenDefaults = function (path, defaults) {
        if (arguments.length === 1) {
            return flock.ugenDefaults.store[path];
        }

        flock.ugenDefaults.store[path] = defaults;

        return defaults;
    };

    flock.ugenDefaults.store = {};


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
        flock.ugenDefaults(sourcePath + "." + aliasName, inputDefaults);
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

    flock.copyUGenDefinition = function (ugenName, alias) {
        var defaults = flock.ugenDefaults(ugenName),
            value = fluid.getGlobalValue(ugenName);

        fluid.setGlobalValue(alias, value);
        flock.ugenDefaults(alias, fluid.copy(defaults));
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
            that.mulAdd = that.mulAddFn = flock.noOp;
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

        that.mulAddFn = fn;

        that.mulAdd = function (numSamps) {
            that.mulAddFn(numSamps, that.output, that.inputs.mul, that.inputs.add);
        };
    };


    flock.ugen = function (inputs, output, options) {
        options = options || {};

        var that = {
            enviro: options.enviro || flock.environment,
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

                return flock.parse.ugenDef(ugenDef, that.enviro, {
                    audioSettings: that.options.audioSettings,
                    buses: that.buses,
                    buffers: that.buffers
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

            s = o.audioSettings = o.audioSettings || that.enviro.audioSystem.model;
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
                that.inputs.freq = flock.parse.ugenDef(valueDef, that.enviro);
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


    /**
     * Mixes buffer-related functionality into a unit generator.
     */
    flock.ugen.buffer = function (that) {
        that.onBufferInputChanged = function (inputName) {
            var m = that.model,
                inputs = that.inputs;

            if (m.bufDef !== inputs.buffer || inputName === "buffer") {
                m.bufDef = inputs.buffer;
                flock.parse.bufferForDef(m.bufDef, that, that.enviro);
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

            m.unscaledValue = inputs.value;

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

    flock.ugenDefaults("flock.ugen.value", {
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

    flock.ugenDefaults("flock.ugen.silence", {
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

    flock.ugenDefaults("flock.ugen.passThrough", {
        rate: "audio",

        inputs: {
            source: null,
            mul: null,
            add: null
        }
    });


    flock.ugen.out = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        // TODO: Implement a "straight out" gen function for cases where the number
        // of sources matches the number of output buses (i.e. where no expansion is necessary).
        // TODO: This function is marked as unoptimized by the Chrome profiler.
        that.gen = function (numSamps) {
            var m = that.model,
                sources = that.multiInputs.sources,
                buses = that.options.buses,
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
                outIdx,
                val;

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
                    val = source.output[outIdx];
                    // TODO: Support control rate interpolation.
                    // TODO: Don't attempt to write to buses beyond the available number.
                    //       Provide an error at onInputChanged time if the unit generator is configured
                    //       with more sources than available buffers.
                    bus[j] = bus[j] + val;
                }

                that.mulAddFn(numSamps, bus, that.inputs.mul, that.inputs.add);
            }

            // TODO: Consider how we should handle "value" when the number
            // of input channels for "sources" can be variable.
            // In the meantime, we just output the last source's last sample.
            m.value = m.unscaledValue = val;
        };

        that.init = function () {
            that.sourceBuffers = [];
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.out", {
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

    flock.ugenDefaults("flock.ugen.valueOut", {
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
    // TODO: Make this a proper multiinput ugen.
    flock.ugen["in"] = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.singleBusGen = function (numSamps) {
            var m = that.model,
                out = that.output;

            flock.ugen.in.readBus(numSamps, out, that.inputs.bus,
                that.options.buses);

            m.unscaledValue = flock.ugen.lastOutputValue(numSamps, out);
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.multiBusGen = function (numSamps) {
            var m = that.model,
                busesInput = that.inputs.bus,
                enviroBuses = that.options.buses,
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

    flock.ugenDefaults("flock.ugen.in", {
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
            var busNum = that.enviro.audioSystem.inputDeviceManager.openAudioDevice(options);
            that.bus = that.options.buses[busNum];
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.audioIn", {
        rate: "audio",
        inputs: {
            mul: null,
            add: null
        }
    });

}());
