/*
 * Flocking Multichannel Unit Generators
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

    flock.ugenDefaults("flock.ugen.pan2", {
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

}());
