/*
 * Flocking Math Unit Generators
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2014, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, Float32Array*/
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

    var ArrayMath = flock.requireModule("webarraymath", "ArrayMath");

    flock.ugen.math = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        that.expandedRight = new Float32Array(that.options.audioSettings.blockSize);

        that.krSourceKrInputGen = function () {
            var m = that.model,
                op = that.activeInput,
                input = that.inputs[op],
                out = that.output,
                left = that.inputs.source.output[0],
                right = flock.fillBufferWithValue(that.expandedRight, input.output[0]);

            ArrayMath[op](out, left, right);
            m.value = m.unscaledValue = out[out.length - 1];
        };

        that.krSourceArInputGen = function () {
            var m = that.model,
                op = that.activeInput,
                input = that.inputs[op],
                out = that.output,
                left = that.inputs.source.output[0],
                right = input.output;

            ArrayMath[op](out, left, right);
            m.value = m.unscaledValue = out[out.length - 1];
        };

        that.arSourceKrInputGen = function () {
            var m = that.model,
                op = that.activeInput,
                input = that.inputs[op],
                out = that.output,
                left = that.inputs.source.output,
                right = flock.fillBufferWithValue(that.expandedRight, input.output[0]);

            ArrayMath[op](out, left, right);
            m.value = m.unscaledValue = out[out.length - 1];
        };

        that.arSourceArInputGen = function () {
            var m = that.model,
                op = that.activeInput,
                input = that.inputs[op],
                out = that.output,
                left = that.inputs.source.output,
                right = input.output;

            ArrayMath[op](out, left, right);
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
            if (typeof (ArrayMath) === "undefined") {
                throw new Error("ArrayMath is undefined. Please include webarraymath.js to use the flock.math unit generator.");
            }
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.math", {
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
                i,
                val;

            for (i = 0; i < numSamps; i++) {
                val = source[i];
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.sumGen = function (numSamps) {
            var m = that.model,
                sources = that.inputs.sources,
                out = that.output,
                i,
                sourceIdx,
                sourceBuffer;

            flock.clearBuffer(out);

            for (sourceIdx = 0; sourceIdx < sources.length; sourceIdx++) {
                sourceBuffer = sources[sourceIdx].output;
                for (i = 0; i < numSamps; i++) {
                    out[i] += sourceBuffer[i];
                }
            }

            m.unscaledValue = flock.ugen.lastOutputValue(numSamps, out);
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function () {
            if (typeof (that.inputs.sources.length) === "number") {
                // We have an array of sources that need to be summed.
                that.gen = that.sumGen;
            } else {
                that.gen = that.copyGen;
            }

            flock.onMulAddInputChanged(that);
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.sum", {
        rate: "audio",
        inputs: {
            sources: null
        }
    });

}());
