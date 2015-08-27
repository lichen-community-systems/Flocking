/*
 * Flocking Oscillator Unit Generators
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2015, Colin Clark
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

    flock.ugenDefaults("flock.ugen.osc", {
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
            var defaults = flock.ugenDefaults("flock.ugen.osc"),
                merged = fluid.merge(null, defaults, options),
                s = merged.tableSize;
            inputs.table = flock.fillTable(s, tableFillFn);
            return flock.ugen.osc(inputs, output, options);
        };

        flock.ugenDefaults(name, flock.ugenDefaults("flock.ugen.osc"));
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

    flock.ugenDefaults("flock.ugen.sin", {
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

    flock.ugenDefaults("flock.ugen.lfSaw", {
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

    flock.ugenDefaults("flock.ugen.lfPulse", {
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

    flock.ugenDefaults("flock.ugen.impulse", {
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

}());
