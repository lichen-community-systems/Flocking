/*
* Flocking Bandlimited UGens
* http://github.com/colinbdclark/flocking
*
* Copyright 2015, Colin Clark
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

    flock.blit = function (p) {
        var val,
            t;

        if (p >= 2.0) {
            val = 0.0;
        } else if (p >= 1.0) {
            t = 2.0 - p;
            val = 0.16666666666666666 * t * t * t;
        } else if (p >= 0.0) {
            t = p * p;
            val = (0.6666666666666666 - t) + (0.5 * t * p);
        } else if (p >= -1.0) {
            t = p * p;
            val = (0.6666666666666666 - t) - (0.5 * t * p);
        } else if (p >= -2.0) {
            t = 2 + p;
            val = 0.16666666666666666 * t * t * t;
        } else {
            val = 0.0;
        }

        return val;
    };

    flock.blit.period = function (sampleRate, freq) {
        var d0 = sampleRate / freq;
        return d0 < 1.0 ? 1.0 : d0;
    };

    flock.blit.updatePeriodState = function (m, freq) {
        m.freq = freq < 0.000001 ? 0.000001 : freq;
        m.d0 = flock.blit.period(m.sampleRate, m.freq);
    };

    /**
     * A band-limited impulse train.
     *
     * This unit generator is based on the BLIT-FDF method documented in:
     * "Efficient Antialiasing Oscillator Algorithms Using Low-Order Fractional Delay Filters"
     * Juhan Nam, Vesa Valimaki, Jonathan S. Able, and Julius O. Smith
     * in IEEE Transactions on Audio, Speech, and Language Processing, Vol. 18, No. 4, May 2010.
     *
     * Inputs:
     *  - freq: the frequency of the impulse train;
     *          this can only be modulated every period,
     *          so there may be a delay before the frequency is updated at low frequencies
     *  - mul: the amplitude of the impulses
     *  - add: the amplitude offset of the impulses
     */
    flock.ugen.blit = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                freq = that.inputs.freq.output[0],
                p = m.phase,
                i,
                val;

            for (i = 0; i < numSamps; i++) {
                p -= 1.0;
                if (p < -2.0) {
                    // We've hit the end of the period.
                    flock.blit.updatePeriodState(m, freq);
                    p += m.d0;
                }

                val = flock.blit(p);
                out[i] = val;
            }

            m.phase = p;
            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.init = function () {
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.blit", {
        rate: "audio",

        inputs: {
            freq: 440.0,
            mul: null,
            add: null
        },

        ugenOptions: {
            model: {
                phase: -2.0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });

    /**
     * Generates a band-limited sawtooth wavefrom.
     *
     * This unit generator is based on the BLIT-FDF method documented in:
     * "Efficient Antialiasing Oscillator Algorithms Using Low-Order Fractional Delay Filters"
     * Juhan Nam, Vesa Valimaki, Jonathan S. Able, and Julius O. Smith
     * in IEEE Transactions on Audio, Speech, and Language Processing, Vol. 18, No. 4, May 2010.
     *
     * This unit generator is based on an algorithm that integrates bandlimited impulse trains,
     * and as a result can only change frequencies at the end of each waveform period.
     *
     * Inputs:
     *  - freq: the frequency of the saw;
     *          this can only be modulated every period,
     *          so there may be a delay before the frequency is updated at low frequencies
     *  - leakRate: the leak rate of the leaky integrator (between >0.0 and 1.0)
     *  - mul: the amplitude of the impulses
     *  - add: the amplitude offset of the impulses
     */
    flock.ugen.saw = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                freq = that.inputs.freq.output[0],
                leak = 1.0 - that.inputs.leakRate.output[0],
                p = m.phase,
                unscaledValue = m.unscaledValue,
                i;

            // TODO: This can be moved to init() when
            // we have ugen graph priming implemented.
            if (p === undefined) {
                flock.ugen.saw.updatePeriodState(m, freq);
                p = m.d0 / 2;
            }

            for (i = 0; i < numSamps; i++) {
                p -= 1.0;
                if (p < -2.0) {
                    // We've hit the end of the period.
                    flock.ugen.saw.updatePeriodState(m, freq);
                    p += m.d0;
                }

                // Saw is BLIT - dcOffset + (1 - leakRate) * prevVal
                out[i] = unscaledValue = flock.blit(p) - m.dcOffset + leak * unscaledValue;
            }

            m.phase = p;
            m.unscaledValue = unscaledValue;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.init = function () {
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugen.saw.updatePeriodState = function (m, freq) {
        flock.blit.updatePeriodState(m, freq);
        m.dcOffset = 1.0 / m.d0; // DC offset at steady state is 1 / d0.
    };

    fluid.defaults("flock.ugen.saw", {
        rate: "audio",

        inputs: {
            freq: 440.0,
            leakRate: 0.01,
            mul: null,
            add: null
        },

        ugenOptions: {
            model: {
                phase: undefined,
                dcOffset: undefined,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });

    /**
     * Generates a band-limited square wave.
     *
     * This unit generator is based on the BLIT-FDF method documented in:
     * "Efficient Antialiasing Oscillator Algorithms Using Low-Order Fractional Delay Filters"
     * Juhan Nam, Vesa Valimaki, Jonathan S. Able, and Julius O. Smith
     * in IEEE Transactions on Audio, Speech, and Language Processing, Vol. 18, No. 4, May 2010.
     *
     * This unit generator is based on an algorithm that integrates bandlimited impulse trains,
     * and as a result can only change frequencies at the end of each waveform period.
     *
     * Inputs:
     *  - freq: the frequency of the square;
     *          this can only be modulated every period,
     *          so there may be a delay before the frequency is updated at low frequencies
     *  - leakRate: the leak rate of the leaky integrator (between >0.0 and 1.0)
     *  - mul: the amplitude of the impulses
     *  - add: the amplitude offset of the impulses
     */
    flock.ugen.square = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                freq = that.inputs.freq.output[0],
                leak = 1.0 - that.inputs.leakRate.output[0],
                p = m.phase,
                unscaledValue = m.unscaledValue,
                i;

            // TODO: This can be moved to init() when
            // we have ugen graph priming implemented.
            if (p === undefined) {
                flock.ugen.square.updatePeriodState(m, freq);
                p = m.phaseResetValue;
            }

            for (i = 0; i < numSamps; i++) {
                out[i] = unscaledValue = (flock.blit(p) * m.sign) + leak * unscaledValue;

                if (p < -2.0) {
                    flock.ugen.square.updatePeriodState(m, freq);
                    // We've hit the end of the period.
                    p += m.phaseResetValue;
                }

                p -= 1.0;
            }

            m.phase = p;
            m.unscaledValue = unscaledValue;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.init = function () {
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugen.square.updatePeriodState = function (m, freq) {
        flock.blit.updatePeriodState(m, freq);
        m.phaseResetValue = m.d0 / 2;
        // Flip the sign of the output.
        m.sign *= -1.0;
    };

    fluid.defaults("flock.ugen.square", {
        rate: "audio",

        inputs: {
            freq: 440.0,
            leakRate: 0.01,
            mul: null,
            add: null
        },

        ugenOptions: {
            model: {
                phase: undefined,
                unscaledValue: 0.5,
                value: 0.5,
                sign: 1.0
            }
        }
    });


    /**
     * Generates a band-limited triangle wave.
     *
     * This unit generator is based on the BLIT-FDF method documented in:
     * "Efficient Antialiasing Oscillator Algorithms Using Low-Order Fractional Delay Filters"
     * Juhan Nam, Vesa Valimaki, Jonathan S. Able, and Julius O. Smith
     * in IEEE Transactions on Audio, Speech, and Language Processing, Vol. 18, No. 4, May 2010.
     *
     * This unit generator is based on an algorithm that integrates bandlimited impulse trains,
     * and as a result can only change frequencies at the end of each waveform period.
     *
     * It will noticeably distort at frequencies above 6000 Hz unless you adjust the
     * leakRate accordingly.
     *
     * Inputs:
     *  - freq: the frequency of the square;
     *          this can only be modulated every period,
     *          so there may be a delay before the frequency is updated at low frequencies
     *  - leakRate: the leak rate of the leaky integrator (between >0.0 and 1.0)
     *  - mul: the amplitude of the impulses
     *  - add: the amplitude offset of the impulses
     */
    flock.ugen.tri = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                freq = that.inputs.freq.output[0],
                leak = 1.0 - that.inputs.leakRate.output[0],
                p = m.phase,
                unscaledValue = m.unscaledValue,
                secondPrevVal = m.secondPrevVal,
                i,
                firstIntegrate,
                secondIntegrate;

            // TODO: This can be moved to init() when
            // we have ugen graph priming implemented.
            if (p === undefined) {
                flock.ugen.tri.updatePeriodState(m, freq);
                p = m.d0 / 4;
            }

            for (i = 0; i < numSamps; i++) {
                firstIntegrate = (flock.blit(p) * m.sign) + leak * unscaledValue;
                unscaledValue = firstIntegrate;
                secondIntegrate = firstIntegrate + leak * secondPrevVal;
                secondPrevVal = secondIntegrate;
                out[i] = secondIntegrate * m.ampScale;

                p -= 1.0;
                if (p < -2.0) {
                    flock.ugen.tri.updatePeriodState(m, freq);
                    p += m.phaseResetValue;
                }
            }

            m.phase = p;
            m.unscaledValue = unscaledValue;
            m.secondPrevVal = secondPrevVal;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.init = function () {
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugen.tri.updatePeriodState = function (m, freq) {
        flock.blit.updatePeriodState(m, freq);
        m.phaseResetValue = m.d0 / 2;
        m.ampScale = 2 / m.d0;
        // Flip the sign of the output.
        m.sign *= -1.0;
    };

    fluid.defaults("flock.ugen.tri", {
        rate: "audio",

        inputs: {
            freq: 440.0,
            leakRate: 0.01,
            mul: null,
            add: null
        },

        ugenOptions: {
            model: {
                phase: undefined,
                value: 0.5,
                unscaledValue: 0.5,
                secondPrevVal: 0.0,
                sign: 1.0,
                ampScale: undefined,
                phaseResetValue: undefined
            }
        }
    });
}());
