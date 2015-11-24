/*
 * Flocking Gate Unit Generators
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
     * A gate that allows the source input signal to pass whenever the sideChain input
     * signal is greater than the threshold.
     *
     * If sideChain isn't specifed, the source signal itself is used to open the gate.
     * By default, the gate will output 0.0 if it is closed, but setting the holdLastValue
     * option to true enables it to hold the value of the gate when it was last open.
     *
     * Inputs:
     *     source: the signal that will be outputted whenever the gate is open.
     *     sideChain: (optional) a side chain signal that will
     *         cause the gate to open and close
     *     threshold: the minimum value at which the gate will open
     * Options:
     *      holdLastValue: determines whether the gate should hold its last open value or output silence
     */
    flock.ugen.gate = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                strides = m.strides,
                out = that.output,
                inputs = that.inputs,
                source = inputs.source.output,
                sideChain = inputs.sideChain.output,
                sideChainInc = strides.sideChain,
                threshold = inputs.threshold.output,
                thresholdInc = strides.threshold,
                holdLast = that.options.holdLastValue,
                lastValue = m.lastValue,
                i,
                j,
                k,
                val;

            for (i = j = k = 0; i < numSamps; i++, j += sideChainInc, k += thresholdInc) {
                if (sideChain[j] >= threshold[k]) {
                    out[i] = val = lastValue = source[i];
                } else {
                    // TODO: Don't check holdLast on each sample.
                    out[i] = val = holdLast ? lastValue : 0;
                }
            }

            m.lastValue = lastValue;
            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function () {
            if (!that.inputs.sideChain) {
                that.inputs.sideChain = that.inputs.source;
            }

            flock.onMulAddInputChanged(that);
            that.calculateStrides();
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.gate", {
        rate: "audio",
        inputs: {
            source: null,
            sideChain: null,
            threshold: Number.MIN_VALUE,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                unscaledValue: 0.0,
                value: 0.0,
                lastValue: 0.0
            },
            holdLastValue: false,
            strideInputs: ["sideChain", "threshold"]
        }
    });

    /**
     * A triggerable timed gate.
     *
     * This unit generator will output 1.0 for the specified
     * duration whenever it is triggered.
     *
     * Similar to SuperCollider's Trig1 unit generator.
     *
     * Inputs:
     *     duration: the duration (in seconds) to remain open
     *     trigger: a trigger signal that will cause the gate to open
     */
    // TODO: Unit tests!
    flock.ugen.timedGate = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                trigger = that.inputs.trigger.output,
                duration = that.inputs.duration.output[0],
                currentTrig,
                i,
                j,
                val;

            if (duration !== m.duration) {
                m.duration = duration;
                m.durationSamps = Math.floor(duration * m.sampleRate);
            }

            for (i = j = 0; i < numSamps; i++, j += m.strides.trigger) {
                currentTrig = trigger[j];
                if (currentTrig > 0.0 && m.prevTrigger <= 0.0) {
                    // If we're already open, close the gate for one sample.
                    val = that.options.resetOnTrigger && m.sampsRemaining > 0 ? 0.0 : 1.0;
                    m.sampsRemaining = m.durationSamps;
                } else {
                    val = m.sampsRemaining > 0 ? 1.0 : 0.0;
                }

                out[i] = val;
                m.sampsRemaining--;

                m.prevTrigger = currentTrig;
            }

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

    flock.ugenDefaults("flock.ugen.timedGate", {
        rate: "audio",
        inputs: {
            trigger: 0.0,
            duration: 1.0
        },
        ugenOptions: {
            model: {
                unscaledValue: 0.0,
                value: 0.0,
                prevTrigger: 0.0,
                sampsRemaining: 0,
                durationSamps: 0,
                duration: 0.0
            },
            resetOnTrigger: true,
            strideInputs: ["trigger"]
        }
    });

    flock.ugen.latch = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.arGen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                source = inputs.source.output,
                trig = inputs.trigger,
                sourceInc = m.strides.source,
                out = that.output,
                i, j,
                currTrig,
                val;

            if (m.holdVal === undefined) {
                m.holdVal = source[0];
            }

            for (i = 0, j = 0; i < numSamps; i++, j += sourceInc) {
                currTrig = trig.output[i];
                if (currTrig > 0.0 && m.prevTrig <= 0.0) {
                    m.holdVal = source[j];
                }

                val = m.holdVal;
                out[i] = val;
                m.prevTrig = currTrig;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.krGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                currTrig = that.inputs.trigger.output[0],
                i;

            if (m.holdVal === undefined || currTrig > 0.0 && m.prevTrig <= 0.0) {
                m.holdVal = that.inputs.source.output[0];
            }
            m.prevTrig = currTrig;

            for (i = 0; i < numSamps; i++) {
                out[i] = m.holdVal;
            }

            m.unscaledValue = m.holdVal;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function () {
            that.calculateStrides();
            that.gen = that.inputs.trigger.rate === flock.rates.AUDIO ? that.arGen : that.krGen;
            flock.onMulAddInputChanged(that);
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.latch", {
        rate: "audio",
        inputs: {
            source: null,
            trigger: 0.0,
            mul: null,
            add: null
        },
        ugenOptions: {
            strideInputs: ["source"],
            model: {
                prevTrig: 0.0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });

}());
