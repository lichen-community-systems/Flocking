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

    /**
     * Generates a band-limited impulse train.
     *
     * This unit generator is based on the BLIT-FDF method documented in:
     * "Efficient Antialiasing Oscillator Algorithms Using Low-Order Fractional Delay Filters"
     * Juhan Nam, Vesa Valimaki, Jonathan S. Able, and Julius O. Smith
     * in IEEE Transactions on Audio, Speech, and Language Processing, Vol. 18, No. 4, May 2010.
     *
     * Inputs:
     *  - freq: the frequency of the impulse train
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
                d0,
                i,
                t,
                val;

            freq = freq < 0.000001 ? 0.000001 : freq;
            d0 = m.sampleRate / freq;
            d0 = d0 < 1.0 ? 1.0 : d0;

            for (i = 0; i < numSamps; i++) {
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
                    // End of the period.
                    val = 0.0;
                    p += d0;
                }

                out[i] = val;
                p -= 1.0;
            }

            m.phase = p;
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
                phase: 2.0
            }
        }
    });

}());
