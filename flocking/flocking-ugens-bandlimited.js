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
        m.d0 = flock.blit.period(m.sampleRate, freq);
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
                i;

            // TODO: This code can be moved to .onInputChanged() when
            // we have signal graph priming.
            if (p === undefined) {
                flock.blit.updatePeriodState(m, freq);
                p = m.d0;
            }

            for (i = 0; i < numSamps; i++) {
                out[i] = flock.blit(p);

                if (p < -2.0) {
                    // We've hit the end of the period.
                    flock.blit.updatePeriodState(m, freq);
                    p += m.d0;
                }

                p -= 1.0;
            }

            m.phase = p;
            that.mulAdd(numSamps);
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
                phase: undefined
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
                prevVal = m.prevVal,
                i;

            // TODO: This code can be moved to .onInputChanged() when
            // we have signal graph priming.
            if (p === undefined) {
                flock.ugen.saw.updatePeriodState(m, freq);
                p = m.d0;
            }

            for (i = 0; i < numSamps; i++) {
                // Saw is BLIT - dcOffset + (1 - leakRate) * prevVal
                out[i] = prevVal = flock.blit(p) - m.dcOffset + leak * prevVal;

                if (p < -2.0) {
                    // We've hit the end of the period.
                    flock.ugen.saw.updatePeriodState(m, freq);
                    p += m.d0;
                }

                p -= 1.0;
            }

            m.phase = p;
            m.prevVal = prevVal;
            that.mulAdd(numSamps);
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
                // These will be calculated on the fly based on d0.
                phase: undefined,
                dcOffset: undefined,

                // The initial state (i.e. y(n-1)) for the leaky integrator
                // should be the initial phase of the counter / d0 - 0.5.
                // Since we initialize the phase counter to d0, the
                // initial leaky intergrator value should be 0.5.
                prevVal: 0.5
            }
        }
    });

}());
