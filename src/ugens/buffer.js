/*
 * Flocking Buffer Unit Generators
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2015, Colin Clark
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

    flock.ugen.playBuffer = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.defaultKrTriggerGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                chan = that.inputs.channel.output[0],
                source = that.buffer.data.channels[chan],
                bufIdx = m.idx,
                loop = that.inputs.loop.output[0],
                trigVal = inputs.trigger.output[0],
                i,
                samp;

            if (trigVal > 0.0 && m.prevTrig <= 0.0) {
                bufIdx = 0;
            }
            m.prevTrig = trigVal;

            for (i = 0; i < numSamps; i++) {
                if (bufIdx > m.lastIdx) {
                    if (loop > 0.0 && trigVal > 0.0) {
                        bufIdx = 0;
                    } else {
                        out[i] = samp = 0.0;
                        continue;
                    }
                }

                samp = that.interpolate(bufIdx, source);
                out[i] = samp;
                bufIdx++;
            }

            m.idx = bufIdx;
            m.unscaledValue = samp;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.otherwiseGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                chan = that.inputs.channel.output[0],
                speed = that.inputs.speed.output,
                source = that.buffer.data.channels[chan],
                trig = inputs.trigger.output,
                bufIdx = m.idx,
                loop = that.inputs.loop.output[0],
                start = (that.inputs.start.output[0] * m.lastIdx) | 0,
                end = (that.inputs.end.output[0] * m.lastIdx) | 0,
                i,
                j,
                k,
                trigVal,
                speedVal,
                samp;

            for (i = 0, j = 0, k = 0; i < numSamps; i++, j += m.strides.trigger, k += m.strides.speed) {
                trigVal = trig[j];
                speedVal = speed[k];

                if (trigVal > 0.0 && m.prevTrig <= 0.0) {
                    bufIdx = flock.ugen.playBuffer.resetIndex(speedVal, start, end);
                } else if (bufIdx < start || bufIdx > end) {
                    if (loop > 0.0 && trigVal > 0.0) {
                        bufIdx = flock.ugen.playBuffer.resetIndex(speedVal, start, end);
                    } else {
                        out[i] = samp = 0.0;
                        continue;
                    }
                }
                m.prevTrig = trig[j];

                samp = that.interpolate(bufIdx, source);
                out[i] = samp;
                bufIdx += m.stepSize * speedVal;
            }

            m.idx = bufIdx;
            m.unscaledValue = samp;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            var inputs = that.inputs,
                speed = inputs.speed,
                start = inputs.start,
                end = inputs.end,
                trig = inputs.trigger;

            that.onBufferInputChanged(inputName);

            // TODO: Optimize for non-regular speed constant rate input.
            that.gen = (speed.rate === flock.rates.CONSTANT && speed.output[0] === 1.0) &&
                (start.rate === flock.rates.CONSTANT && start.output[0] === 0.0) &&
                (end.rate === flock.rates.CONSTANT && end.output[0] === 1.0) &&
                (trig.rate !== flock.rates.AUDIO) ?
                that.defaultKrTriggerGen : that.otherwiseGen;

            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.onBufferReady = function () {
            var m = that.model,
                end = that.inputs.end.output[0],
                chan = that.inputs.channel.output[0],
                buf = that.buffer.data.channels[chan],
                len = buf.length;

            m.idx = (end * len) | 0;
            m.lastIdx = len - 1;
            m.stepSize = that.buffer.format.sampleRate / m.sampleRate;
        };

        that.init = function () {
            flock.ugen.buffer(that);
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugen.playBuffer.resetIndex = function (speed, start, end) {
        return speed > 0 ? start : end;
    };

    flock.ugenDefaults("flock.ugen.playBuffer", {
        rate: "audio",
        inputs: {
            channel: 0,
            loop: 0.0,
            speed: 1.0,
            start: 0.0,
            end: 1.0,
            trigger: 1.0,
            buffer: null,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                finished: false,
                unscaledValue: 0.0,
                value: 0.0,
                idx: 0,
                stepSize: 0,
                prevTrig: 0,
                channel: undefined
            },
            strideInputs: ["trigger", "speed"],
            interpolation: "linear"
        }
    });

    /**
     * Reads values out of a buffer at the specified phase index.
     * This unit generator is typically used with flock.ugen.phasor or similar unit generator to
     * scan through the buffer at a particular rate.
     *
     * Inputs:
     *  - buffer: a bufDef representing the buffer to read from
     *  - channel: the channel of the buffer to read from
     *  - phase: the phase of the buffer to read (this should be a value between 0..1)
     */
    // TODO: This should be refactored based on the model of bufferPhaseStep below.
    flock.ugen.readBuffer = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                phaseS = m.strides.phase,
                out = that.output,
                chan = that.inputs.channel.output[0],
                phase = that.inputs.phase.output,
                source = that.buffer.data.channels[chan],
                sourceLen = source.length,
                i,
                bufIdx,
                j,
                val;

            for (i = j = 0; i < numSamps; i++, j += phaseS) {
                bufIdx = phase[j] * sourceLen;
                val = that.interpolate(bufIdx, source);
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            flock.ugen.buffer(that);
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.readBuffer", {
        rate: "audio",

        inputs: {
            buffer: null,
            channel: 0,
            phase: 0,
            mul: null,
            add: null
        },

        ugenOptions: {
            model: {
                channel: undefined,
                unscaledValue: 0.0,
                value: 0.0
            },
            strideInputs: [
                "phase"
            ],
            interpolation: "linear"
        }
    });

    /**
     * flock.ugen.writeBuffer writes its "source" input into a user-specified buffer.
     *
     * Inputs:
     *
     *   sources: the inputs to write to the buffer,
     *   buffer: a bufferDef to write to; the buffer will be created if it doesn't already exist
     *   start: the index into the buffer to start writing at; defaults to 0
     *   loop: a flag specifying if the unit generator should loop back to the beginning
     *         of the buffer when it reaches the end; defaults to 0.
     */
    flock.ugen.writeBuffer = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                inputs = that.inputs,
                buffer = that.buffer,
                sources = that.multiInputs.sources,
                numChans = sources.length,
                bufferChannels = buffer.data.channels,
                numFrames = buffer.format.numSampleFrames,
                startIdx = inputs.start.output[0],
                loop = inputs.loop.output[0],
                i,
                channelWriteIdx,
                j;

            if (m.prevStart !== startIdx) {
                m.prevStart = startIdx;
                m.writeIdx = Math.floor(startIdx);
            }

            for (i = 0; i < numChans; i++) {
                var inputChannel = sources[i].output;
                var bufferChannel = bufferChannels[i];
                var outputChannel = out[i];
                channelWriteIdx = m.writeIdx;

                for (j = 0; j < numSamps; j++) {
                    var samp = inputChannel[j];

                    // TODO: Remove this conditional by being smarter about dynamic outputs.
                    if (outputChannel) {
                        outputChannel[j] = samp;
                    }

                    if (channelWriteIdx < numFrames) {
                        bufferChannel[channelWriteIdx] = samp;
                    } else if (loop > 0) {
                        channelWriteIdx = Math.floor(startIdx);
                        bufferChannel[channelWriteIdx] = samp;
                    }
                    channelWriteIdx++;
                }
            }

            m.writeIdx = channelWriteIdx;
            that.mulAdd(numSamps);
        };

        that.createBuffer = function (that, bufDef) {
            var o = that.options,
                s = o.audioSettings,
                buffers = o.buffers,
                numChans = that.multiInputs.sources.length,
                duration = Math.round(that.options.duration * s.rates.audio),
                channels = new Array(numChans),
                i;

            // We need to make a new buffer.
            for (i = 0; i < numChans; i++) {
                channels[i] = new Float32Array(duration);
            }

            var buffer = flock.bufferDesc(channels, s.rates.audio, numChans);

            if (bufDef.id) {
                buffer.id = bufDef.id;
                buffers[bufDef.id] = buffer;
            }

            return buffer;
        };

        that.setupBuffer = function (bufDef) {
            bufDef = typeof bufDef === "string" ? {id: bufDef} : bufDef;

            var existingBuffer;
            if (bufDef.id) {
                // Check for an existing environment buffer.
                existingBuffer = that.options.buffers[bufDef.id];
            }

            that.buffer = existingBuffer || that.createBuffer(that, bufDef);

            return that.buffer;
        };

        that.onInputChanged = function (inputName) {
            if (!inputName) {
                that.collectMultiInputs();
                that.setupBuffer(that.inputs.buffer);
            } else if (inputName === "sources") {
                that.collectMultiInputs();
            } else if (inputName === "buffer") {
                that.setupBuffer(that.inputs.buffer);
            }

            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            that.onInputChanged();
        };

        that.init();

        return that;
    };

    flock.ugenDefaults("flock.ugen.writeBuffer", {
        rate: "audio",

        inputs: {
            sources: null,
            buffer: null,
            start: 0,
            loop: 0
        },

        ugenOptions: {
            model: {
                prevStart: undefined,
                writeIdx: 0
            },

            tags: ["flock.ugen.multiChannelOutput"],
            numOutputs: 2, // TODO: Should be dynamically set to sources.length; user has to override.
            multiInputNames: ["sources"],
            duration: 600 // In seconds. Default is 10 minutes.
        }
    });


    /**
     * Outputs the duration of the specified buffer. Runs at either constant or control rate.
     * Use control rate only when the underlying buffer may change dynamically.
     *
     * Inputs:
     *  buffer: a bufDef object specifying the buffer to track
     */
    flock.ugen.bufferDuration = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.krGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                chan = that.inputs.channel.output[0],
                source = that.buffer.data.channels[chan],
                rate = that.buffer.format.sampleRate,
                val = source.length / rate,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            flock.onMulAddInputChanged(that);
            that.onBufferInputChanged(inputName);
        };

        that.onBufferReady = function () {
            that.krGen(1);
        };

        that.init = function () {
            var r = that.rate;
            that.gen = (r === flock.rates.CONTROL || r === flock.rates.AUDIO) ? that.krGen : undefined;
            that.output[0] = 0.0;
            flock.ugen.buffer(that);
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.bufferDuration", {
        rate: "constant",
        inputs: {
            buffer: null,
            channel: 0
        },
        ugenOptions: {
            model: {
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });

    /**
     * Outputs the length of the specified buffer in samples. Runs at either constant or control rate.
     * Use control rate only when the underlying buffer may change dynamically.
     *
     * Inputs:
     *  buffer: a bufDef object specifying the buffer to track
     */
    flock.ugen.bufferLength = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.krGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                chan = that.inputs.channel.output[0],
                source = that.buffer.data.channels[chan],
                val = source.length,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            flock.onMulAddInputChanged(that);
            that.onBufferInputChanged(inputName);
        };

        that.onBufferReady = function () {
            that.krGen(1);
        };

        that.init = function () {
            var r = that.rate;
            that.gen = (r === flock.rates.CONTROL || r === flock.rates.AUDIO) ? that.krGen : undefined;
            that.output[0] = 0.0;
            flock.ugen.buffer(that);
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.bufferLength", {
        rate: "constant",
        inputs: {
            buffer: null,
            channel: 0
        },
        ugenOptions: {
            model: {
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });

    /**
     * Outputs a phase step value for playing the specified buffer at its normal playback rate.
     * This unit generator takes into account any differences between the sound file's sample rate and
     * the AudioSystem's audio rate.
     *
     * Inputs:
     *  buffer: a bufDef object specifying the buffer to track
     */
    flock.ugen.bufferPhaseStep = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.krGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                val = m.unscaledValue,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = val;
            }

            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
            flock.onMulAddInputChanged(that);
        };

        that.onBufferReady = function (buffer) {
            var m = that.model,
                chan = that.inputs.channel.output[0],
                source = buffer.data.channels[chan],
                enviroRate = that.options.audioSettings.rates.audio,
                bufferRate = that.buffer.format.sampleRate || enviroRate;

            m.scale = bufferRate / enviroRate;
            that.output[0] = m.unscaledValue = 1 / (source.length * m.scale);
        };

        that.init = function () {
            var r = that.rate;
            that.gen = (r === flock.rates.CONTROL || r === flock.rates.AUDIO) ? that.krGen : undefined;
            that.output[0] = 0.0;
            flock.ugen.buffer(that);
            that.initBuffer();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.bufferPhaseStep", {
        rate: "constant",
        inputs: {
            buffer: null,
            channel: 0
        },
        ugenOptions: {
            model: {
                scale: 1.0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });

    /**
     * Constant-rate unit generator that outputs the AudioSystem's current audio sample rate.
     */
    flock.ugen.sampleRate = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options),
            m = that.model;

        that.output[0] = m.value = m.unscaledValue = that.options.audioSettings.rates.audio;

        return that;
    };

    flock.ugenDefaults("flock.ugen.sampleRate", {
        rate: "constant",
        inputs: {}
    });

}());
