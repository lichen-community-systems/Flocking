/*
 * Flocking Granular Synthesis Unit Generators
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
     * Triggers grains from an audio buffer.
     *
     * Inputs:
     *   - dur: the duration of each grain (control or constant rate only)
     *   - trigger: a trigger signal that, when it move to a positive number, will start a grain
     *   - buffer: a bufferDef object describing the buffer to granulate
     *   - centerPos: the postion within the sound buffer where the grain will reach maximum amplitude (in seconds)
     *   - amp: the peak amplitude of the grain
     *   - speed: the rate at which grain samples are selected from the buffer; 1.0 is normal speed, -1.0 is backwards
     *
     * Options:
     *   - interpolation: "cubic", "linear", or "none"/undefined
     */
    // TODO: Unit tests.
    flock.ugen.triggerGrains = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                chan = inputs.channel.output[0],
                buf = that.buffer.data.channels[chan],
                bufRate = that.buffer.format.sampleRate,
                dur = inputs.dur.output[0],
                amp = inputs.amp.output,
                centerPos = inputs.centerPos.output,
                trigger = inputs.trigger.output,
                speed = inputs.speed.output,
                grainEnv = that.options.grainEnv,
                lastOutIdx = numSamps - 1,
                posIdx = 0,
                trigIdx = 0,
                ampIdx = 0,
                speedIdx = 0,
                i,
                j,
                k,
                grain,
                start,
                samp,
                env;

            // Trigger new grains.
            for (i = 0; i < numSamps; i++) {
                if (trigger[trigIdx] > 0.0 && m.prevTrigger <= 0.0 && m.activeGrains.length < m.maxNumGrains) {
                    grain = m.freeGrains.pop();
                    grain.numSamps = m.sampleRate * dur;
                    grain.centerIdx = (grain.numSamps / 2) * m.stepSize;
                    grain.envScale = that.options.grainEnv.length / grain.numSamps;
                    grain.sampIdx = 0;
                    grain.amp = amp[ampIdx];
                    start = (centerPos[posIdx] * bufRate) - grain.centerIdx;
                    while (start < 0) {
                        start += buf.length;
                    }
                    grain.readPos = start;
                    grain.writePos = i;
                    grain.speed = speed[speedIdx];
                    m.activeGrains.push(grain);
                }

                m.prevTrigger = trigger[trigIdx];
                out[i] = 0.0;

                posIdx += m.strides.centerPos;
                trigIdx += m.strides.trigger;
                ampIdx += m.strides.amp;
                speedIdx += m.strides.speed;
            }

            // Output samples for all active grains.
            for (j = 0; j < m.activeGrains.length;) {
                grain = m.activeGrains[j];
                for (k = grain.writePos; k < Math.min(k + (grain.numSamps - grain.sampIdx), numSamps); k++) {
                    samp = that.interpolate(grain.readPos, buf);
                    env = flock.interpolate.linear(grain.sampIdx * grain.envScale, grainEnv);
                    out[k] += samp * env * grain.amp;
                    grain.readPos = (grain.readPos + (m.stepSize * grain.speed)) % buf.length;
                    grain.sampIdx++;
                }
                if (grain.sampIdx >= grain.numSamps) {
                    m.freeGrains.push(grain);
                    m.activeGrains.splice(j, 1);
                } else {
                    j++;
                    grain.writePos = k % numSamps;
                }
            }

            m.unscaledValue = out[lastOutIdx];
            that.mulAdd(numSamps);
            m.value = out[lastOutIdx];
        };

        that.onBufferReady = function () {
            var m = that.model;
            m.stepSize = that.buffer.format.sampleRate / m.sampleRate;
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.allocateGrains = function (numGrains) {
            numGrains = numGrains || that.model.maxNumGrains;

            for (var i = 0; i < numGrains; i++) {
                that.model.freeGrains.push({
                    numSamps: 0,
                    centerIdx: 0.0,
                    envScale: 0.0,
                    sampIdx: 0,
                    amp: 0.0,
                    readPos: 0.0,
                    writePos: 0,
                    speed: 0.0
                });
            }
        };

        that.init = function () {
            flock.ugen.buffer(that);
            that.allocateGrains();
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.triggerGrains", {
        rate: "audio",
        inputs: {
            centerPos: 0,
            channel: 0,
            amp: 1.0,
            dur: 0.1,
            speed: 1.0,
            trigger: 0.0,
            buffer: null,
            mul: null,
            add: null
        },
        ugenOptions: {
            grainEnv: flock.fillTable(8192, flock.tableGenerators.hann),
            model: {
                unscaledValue: 0.0,
                value: 0.0,
                maxNumGrains: 512,
                activeGrains: [],
                freeGrains: [],
                env: null,
                strides: {}
            },
            strideInputs: [
                "centerPos",
                "trigger",
                "amp",
                "speed"
            ],
            interpolation: "cubic"
        }
    });


    /**
     * Granulates a source signal using an integral delay line.
     * This implementation is particularly useful for live granulation.
     * Contributed by Mayank Sanganeria.
     *
     * Inputs:
     *   - grainDur: the duration of each grain (control or constant rate only)
     *   - delayDur: the duration of the delay line (control or constant rate only)
     *   - numGrains: the number of grains to generate (control or constant rate only)
     *   - mul: amplitude scale factor
     *   - add: amplide add
     */
    // TODO: Unit tests.
    flock.ugen.granulator = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                o = that.options,
                inputs = that.inputs,
                out = that.output,
                delayLine = that.delayLine,
                grainDur = inputs.grainDur.output[0],
                delayDur = inputs.delayDur.output[0],
                numGrains = inputs.numGrains.output[0],
                source = inputs.source.output,
                maxDelayDur = o.maxDelayDur,
                grainEnv = o.grainEnv,
                i,
                j,
                val,
                grainIdx,
                delayLineReadIdx,
                samp,
                windowPos,
                amp;

            // Update and clamp the delay line length.
            if (m.delayDur !== delayDur) {
                m.delayDur = delayDur;

                if (delayDur > maxDelayDur) {
                    delayDur = maxDelayDur;
                }

                m.delayLength = (delayDur * m.sampleRate) | 0;
                m.writePos = m.writePos % m.delayLength;
            }

            // Update the grain duration.
            if (m.grainDur !== grainDur) {
                m.grainDur = grainDur;
                m.grainLength = (m.sampleRate * m.grainDur) | 0;
                m.envScale = grainEnv.length / m.grainLength;
            }

            // TODO: This implementation will cause currently-sounding grains
            // to be stopped immediately, rather than being allowed to finish.
            numGrains = numGrains > o.maxNumGrains ? o.maxNumGrains : Math.round(numGrains);

            for (i = 0; i < numSamps; i++) {
                // Write into the delay line and update the write position.
                delayLine[m.writePos] = source[i];
                m.writePos = ++m.writePos % m.delayLength;

                // Clear the previous output.
                val = 0;

                // Now fill with grains
                for (j = 0; j < numGrains; j++) {
                    grainIdx = m.grainIdx[j];
                    delayLineReadIdx = m.delayLineIdx[j];

                    // Randomize the reset position of finished grains.
                    if (grainIdx > m.grainLength) {
                        grainIdx = 0;
                        delayLineReadIdx = (Math.random() * m.delayLength) | 0;
                    }

                    samp = delayLine[delayLineReadIdx];
                    windowPos = grainIdx * m.envScale;
                    amp = flock.interpolate.linear(windowPos, grainEnv);
                    val += samp * amp;

                    // Update positions in the delay line and grain envelope arrays for next time.
                    m.delayLineIdx[j] = ++delayLineReadIdx % m.delayLength;
                    m.grainIdx[j] = ++grainIdx;
                }

                val = val / numGrains;
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.initGrains = function () {
            var m = that.model;

            for (var i = 0; i < that.options.maxNumGrains; i++) {
                m.grainIdx[i] = 0;
                m.delayLineIdx[i] = Math.random() * m.delayLength;
            }
        };

        that.init = function () {
            var m = that.model,
                o = that.options,
                delayLineLen = (o.maxDelayDur * m.sampleRate) | 0;

            that.delayLine = new Float32Array(delayLineLen);
            m.delayLength = delayLineLen;
            m.delayLineIdx = new Uint32Array(o.maxNumGrains);
            m.grainIdx = new Uint32Array(o.maxNumGrains);

            that.initGrains();
            that.onInputChanged();
        };

        that.init();

        return that;
    };

    flock.ugenDefaults("flock.ugen.granulator", {
        rate: "audio",

        inputs: {
            source: null,
            grainDur: 0.1,
            delayDur: 1,
            numGrains: 5,
            mul: null,
            add: null
        },

        ugenOptions: {
            maxNumGrains: 512,
            maxDelayDur: 30,
            grainEnv: flock.fillTable(8192, flock.tableGenerators.sinWindow),
            model: {
                unscaledValue: 0.0,
                value: 0.0,
                grainLength: 0,
                writePos: 0
            }
        }
    });

}());
