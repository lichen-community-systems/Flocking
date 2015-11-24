/*
 * Flocking Sequencing  Unit Generators
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2013-2015, Colin Clark
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
     * Changes from the <code>initial</code> input to the <code>target</code> input
     * at the specified <code>time</code>. An optional <code>crossfade</code> duration
     * may be specified to linearly crossfade between the two inputs.
     *
     * Can be used to schedule sample-accurate changes.
     * Note that the <code>target</code> input will be evaluated from the beginning,
     * even if its value isn't yet output.
     *
     */
    flock.ugen.change = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                initial = that.inputs.initial.output,
                initialInc = m.strides.initial,
                target = that.inputs.target.output,
                targetInc = m.strides.target,
                out = that.output,
                samplesLeft = m.samplesLeft,
                crossfadeLevel = m.crossfadeLevel,
                val;

            for (var i = 0, j = 0, k = 0; i < numSamps; i++, j += initialInc, k += targetInc) {
                if (samplesLeft > 0) {
                    // We haven't hit the scheduled time yet.
                    val = initial[j];
                    samplesLeft--;
                } else if (crossfadeLevel > 0.0) {
                    // We've hit the scheduled time, but we still need to peform the crossfade.
                    val = (initial[j] * crossfadeLevel) + (target[k] * (1.0 - crossfadeLevel));
                    crossfadeLevel -= m.crossfadeStepSize;
                } else {
                    // We're done.
                    val = target[k];
                }

                out[i] = val;
            }

            m.samplesLeft = samplesLeft;
            m.crossfadeLevel = crossfadeLevel;
            m.value = m.unscaledValue = val;
        };

        that.onInputChanged = function (inputName) {
            var m = that.model,
                inputs = that.inputs;

            if (inputName === "time" || !inputName) {
                m.samplesLeft = Math.round(inputs.time.output[0] * m.sampleRate);
            }

            if (inputName === "crossfade" || !inputName) {
                m.crossfadeStepSize = 1.0 / Math.round(inputs.crossfade.output[0] * m.sampleRate);
                m.crossfadeLevel = inputs.crossfade.output[0] > 0.0 ? 1.0 : 0.0;
            }

            that.calculateStrides();
        };

        that.onInputChanged();

        return that;
    };

    flock.ugenDefaults("flock.ugen.change", {
        rate: "audio",

        inputs: {
            /**
             * An input unit generator to output initially.
             * Can be audio, control, or constant rate.
             */
            initial: 0.0,

            /**
             * The unit generator to output after the specified time.
             * Can be audio, control, or constant rate.
             */
            target: 0.0,

            /**
             * The sample-accurate time (in seconds) at which the
             * the change should occur.
             */
            time: 0.0,

            /**
             * The duration of the optional linear crossfade between
             * the two values.
             */
            crossfade: 0.0
        },

        ugenOptions: {
            model: {
                samplesLeft: 0.0,
                crossfadeStepSize: 0,
                crossfadeLevel: 0.0,
                unscaledValue: 0.0,
                value: 0.0
            },
            strideInputs: ["initial", "target"]
        }
    });


    flock.ugen.listItem = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                list = that.inputs.list,
                maxIdx = list.length - 1,
                index = that.inputs.index.output,
                i,
                val,
                j,
                listIdx;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.index) {
                listIdx = Math.round(index[j] * maxIdx);
                listIdx = Math.max(0, listIdx);
                listIdx = Math.min(listIdx, maxIdx);
                val = list[listIdx];
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.listItem", {
        rate: "control",
        inputs: {
            index: 0, // A value between 0 and 1.0
            list: [0]
        },
        ugenOptions: {
            strideInputs: ["index"]
        }
    });


    flock.ugen.sequence = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var values = that.inputs.values,
                inputs = that.inputs,
                freq = inputs.freq.output,
                loop = inputs.loop.output[0],
                m = that.model,
                scale = m.scale,
                out = that.output,
                start = inputs.start ? Math.round(inputs.start.output[0]) : 0,
                end = inputs.end ? Math.round(inputs.end.output[0]) : values.length,
                startItem,
                i,
                j;

            if (m.unscaledValue === undefined) {
                startItem = values[start];
                m.unscaledValue = (startItem === undefined) ? 0.0 : startItem;
            }

            if (m.nextIdx === undefined) {
                m.nextIdx = start;
            }

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.freq) {
                if (m.nextIdx >= end) {
                    if (loop > 0.0) {
                        m.nextIdx = start;
                    } else {
                        out[i] = m.unscaledValue;
                        continue;
                    }
                }

                out[i] = m.unscaledValue = values[m.nextIdx];
                m.phase += freq[j] * scale;

                if (m.phase >= 1.0) {
                    m.phase = 0.0;
                    m.nextIdx++;
                }
            }

            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function () {
            that.model.scale = that.rate !== flock.rates.DEMAND ? that.model.sampleDur : 1;

            if ((!that.inputs.values || that.inputs.values.length === 0) && that.inputs.list) {
                flock.log.warn("The 'list' input to flock.ugen.sequence is deprecated. Use 'values' instead.");
                that.inputs.values = that.inputs.list;
            }

            if (!that.inputs.values) {
                that.inputs.values = [];
            }

            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.sequence", {
        rate: "control",

        inputs: {
            start: 0,
            freq: 1.0,
            loop: 0.0,
            values: []
        },

        ugenOptions: {
            model: {
                unscaledValue: undefined,
                value: 0.0,
                phase: 0
            },

            strideInputs: ["freq"]
        }
    });


    /**
     * A Sequencer unit generator outputs a sequence of values
     * for the specified sequence of durations.
     *
     * Optionally, when the resetOnNext flag is set,
     * the sequencer will reset its value to 0.0 for one sample
     * prior to moving to the next duration.
     * This is useful for sequencing envelope gates, for example.
     *
     * Inputs:
     *     durations: an array of durations (in seconds) to hold each value
     *     values: an array of values to output
     *     loop: if > 0, the unit generator will loop back to the beginning
     *         of the lists when it reaches the end; defaults to 0.
     */
    // TODO: Unit Tests!
    flock.ugen.sequencer = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                o = that.options,
                resetOnNext = o.resetOnNext,
                out = that.output,
                loop = that.inputs.loop.output[0],
                durations = that.inputs.durations,
                values = that.inputs.values,
                i,
                val;

            if (m.shouldValidateSequences) {
                m.shouldValidateSequences = false;
                flock.ugen.sequencer.validateSequences(durations, values);
            }

            for (i = 0; i < numSamps; i++) {
                if (values.length === 0 || durations.length === 0) {
                    // Nothing to output.
                    out[i] = val = 0.0;
                    continue;
                }

                if (m.samplesRemaining <= 0) {
                    // We've hit the end of a stage.
                    if (m.idx < durations.length - 1) {
                        // Continue to the next value/duration pair.
                        m.idx++;
                        val = flock.ugen.sequencer.nextStage(durations, values, resetOnNext, m);
                    } else if (loop > 0.0) {
                        // Loop back to the first value/duration pair.
                        m.idx = 0;
                        val = flock.ugen.sequencer.nextStage(durations, values, resetOnNext, m);
                    } else {
                        // Nothing left to do.
                        val = o.holdLastValue ? m.unscaledValue : 0.0;
                    }
                } else {
                    // Still in the midst of a stage.
                    val = values[m.idx];
                    m.samplesRemaining--;
                }

                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            var m = that.model,
                inputs = that.inputs;

            if (inputName === "durations" || inputs.durations !== m.prevDurations) {
                m.idx = 0;
                flock.ugen.sequencer.calcDurationsSamps(inputs.durations, that.model);
                flock.ugen.sequencer.validateInput("durations", that);
                m.prevDurations = inputs.durations;
            }

            if (inputName === "values" || inputs.values !== m.prevValues) {
                m.idx = 0;
                flock.ugen.sequencer.validateInput("values", that);
                m.prevValues = inputs.values;
            }

            that.model.shouldValidateSequences = true;
            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugen.sequencer.validateInput = function (inputName, that) {
        var input = that.inputs[inputName];
        if (!input || !flock.isIterable(input)) {
            flock.fail("No " + inputName + " array input was specified for flock.ugen.sequencer: " +
                fluid.prettyPrintJSON(that.options.ugenDef));
        }
    };

    flock.ugen.sequencer.validateSequences = function (durations, values) {
        if (durations.length !== values.length) {
            flock.fail("Mismatched durations and values array lengths for flock.ugen.sequencer. Durations: " +
                fluid.prettyPrintJSON(durations) + ", values: " + fluid.prettyPrintJSON(values));
        }
    };

    flock.ugen.sequencer.calcDurationsSamps = function (durations, m) {
        m.samplesRemaining = Math.floor(durations[m.idx] * m.sampleRate);
    };

    flock.ugen.sequencer.nextStage = function (durations, values, resetOnNext, m) {
        flock.ugen.sequencer.calcDurationsSamps(durations, m);
        m.samplesRemaining--;
        return resetOnNext ? 0.0 : values[m.idx];
    };

    flock.ugenDefaults("flock.ugen.sequencer", {
        rate: "audio",
        inputs: {
            // TODO: start,
            // TODO: end,
            // TODO: skip
            // TODO: direction,
            durations: [],
            values: [],
            loop: 0.0
        },
        ugenOptions: {
            model: {
                idx: 0,
                samplesRemaining: 0,
                unscaledValue: 0.0,
                value: 0.0,
                prevDurations: [],
                prevValues: []
            },
            resetOnNext: false,
            holdLastvalue: false
        }
    });

}());
