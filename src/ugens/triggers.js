/*
 * Flocking Trigger Unit Generators
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

            if (inputName === "source" && that.options.triggerOnSetSameValue) {
                // Force a trigger to be output whenever the input is changed,
                // even if it's the same value as was previously held.
                that.model.prevVal = null;
            }
        };

        that.calculateStrides();
        return that;
    };

    flock.ugenDefaults("flock.ugen.valueChangeTrigger", {
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

            triggerOnSetSameValue: true,
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

    flock.ugenDefaults("flock.ugen.inputChangeTrigger", {
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

    flock.ugenDefaults("flock.ugen.triggerCallback", {
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

    flock.ugenDefaults("flock.ugen.t2a", {
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

}());
