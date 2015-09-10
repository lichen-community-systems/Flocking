/*
 * Flocking Debugging Unit Generators
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

    flock.ugenDefaults("flock.ugen.print", {
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

}());
