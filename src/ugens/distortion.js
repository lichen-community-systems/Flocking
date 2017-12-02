/*
 * Flocking Distortion Unit Generators
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

    /**
     * A simple waveshaper-based distortion effect by Jon Watte.
     * Uses the polynomial y = (3/2) * x - (1/2) * x^3.
     *
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

    flock.ugenDefaults("flock.ugen.distortion", {
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
     * A tanh distortion effect.
     *
     * Inputs:
     *   - source: the input signal to distort
     */
    flock.ugen.distortion.tanh = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                source = that.inputs.source.output,
                sourceInc = m.strides.source,
                dist,
                i,
                j;

            for (i = j = 0; i < numSamps; i++, j += sourceInc) {
                dist = Math.tanh(source[j]);
                out[i] = dist;
            }

            m.unscaledValue = dist;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged();

        return that;
    };

    flock.ugenDefaults("flock.ugen.distortion.tanh", {
        rate: "audio",
        inputs: {
            source: null
        },
        ugenOptions: {
            strideInputs: ["source"]
        }
    });



    /**
     * A waveshaper-based distortion effect by Bram de Jong.
     * http://www.musicdsp.org/showone.php?id=41
     *
     * Inputs:
     *   - source: the input signal
     *   - amount: a value between 1 and Infinity that represents the amount of distortion
     *             to apply.
     */
    flock.ugen.distortion.deJong = function (inputs, output, options) {
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

    flock.ugenDefaults("flock.ugen.distortion.deJong", {
        rate: "audio",
        inputs: {
            source: null,
            amount: 2
        },
        ugenOptions: {
            strideInputs: ["source", "amount"]
        }
    });

    // Aliases the deJong distortion unit generator to its
    // original, misspelled name for backwards compatibility.
    //
    // The name "flock.ugen.distortion.deJonge" is deprecated
    // and will be removed in Flocking 0.3.0.
    flock.copyUGenDefinition("flock.ugen.distortion.deJong", "flock.ugen.distortion.deJonge");

    /**
     * A waveshaper-based distortion effect by Partice Tarrabia and Bram de Jong.
     * http://www.musicdsp.org/showone.php?id=46
     *
     * Inputs:
     *   - source: the input signal
     *   - amount: a value between -1 and 1 that represents the amount of distortion
     *             to apply.
     */
    flock.ugen.distortion.tarrabiaDeJong = function (inputs, output, options) {
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

    flock.ugenDefaults("flock.ugen.distortion.tarrabiaDeJong", {
        rate: "audio",
        inputs: {
            source: null,
            amount: 1.0
        },
        ugenOptions: {
            strideInputs: ["source", "amount"]
        }
    });


    // Alias the tarrabiaDeJong distortion unit generator to its
    // original, misspelled name for backwards compatibility.
    //
    // The name "flock.ugen.distortion.tarrabiaDeJonge" is deprecated
    // and will be removed in Flocking 0.3.0.
    flock.copyUGenDefinition("flock.ugen.distortion.tarrabiaDeJong", "flock.ugen.distortion.tarrabiaDeJonge");


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

    flock.ugenDefaults("flock.ugen.distortion.gloubiBoulga", {
        rate: "audio",
        inputs: {
            source: null,
            gain: 1.0
        },
        ugenOptions: {
            strideInputs: ["source", "gain"]
        }
    });

}());
