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
                prevTrigVal,
                speedVal,
                samp;

            for (i = 0, j = 0, k = 0; i < numSamps; i++, j += m.strides.trigger, k += m.strides.speed) {
                trigVal = trig[j];
                prevTrigVal = m.prevTrig;
                speedVal = speed[k];
                m.prevTrig = trigVal;

                if (trigVal > 0.0 && prevTrigVal <= 0.0) {
                    bufIdx = flock.ugen.playBuffer.resetIndex(speedVal, start, end);
                } else if (bufIdx < start || bufIdx > end) {
                    if (loop > 0.0 && trigVal > 0.0) {
                        bufIdx = flock.ugen.playBuffer.resetIndex(speedVal, start, end);
                    } else {
                        out[i] = samp = 0.0;
                        continue;
                    }
                }

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



    /**
     * Provides a bank of buffers that are played back whenever a trigger fires.
     * In this implementation, buffers are always allowed to play until their end.
     * A subsequent trigger while a buffer is still blaying won't interrupt it; another will be added to the mix.
     */
    // TODO:
    //   - Remove ridiculous variable assignment block
    //   - Factor out voice logic into separate functions
    //   - Add support for sample rate conversion
    //   - Source buffers directly from the environment at gen time,
    //     rather than trying do so proactively (and failing if they're not there)
    flock.ugen.triggerBuffers = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                strides = m.strides,
                out = that.output,
                inputs = that.inputs,
                buffers = that.buffers,
                numBuffers = buffers.length - 1,
                prevTrigger = m.prevTrigger,
                maxVoices = m.maxVoices,
                activeVoices = m.activeVoices,
                freeVoices = m.freeVoices,
                trigger = inputs.trigger.output,
                triggerInc = strides.trigger,
                triggerIdx = 0,
                bufferIndex = inputs.bufferIndex.output,
                bufferIndexInc = strides.bufferIndex,
                bufferIndexIdx = 0,
                speed = inputs.speed.output,
                speedInc = strides.speed,
                speedIdx = 0,
                chan = that.inputs.channel.output[0],
                i,
                triggerVal,
                voice,
                bufIdx,
                bufDesc,
                j,
                buffer,
                numSampsToWriteForVoice,
                k,
                samp;

            // Create a data structure containing all the active voices.
            for (i = 0; i < numSamps; i++) {
                triggerVal = trigger[triggerIdx];
                if (triggerVal > 0.0 && prevTrigger <= 0.0 && activeVoices.length < maxVoices) {
                    bufIdx = Math.round(bufferIndex[bufferIndexIdx] * numBuffers);
                    bufIdx = Math.max(0, bufIdx);
                    bufIdx = Math.min(bufIdx, numBuffers);
                    bufDesc = buffers[bufIdx];
                    if (!bufDesc) {
                        continue;
                    }

                    // TODO: Split this out into a separate function.
                    voice = freeVoices.pop();
                    voice.speed = speed[speedIdx];
                    voice.currentIdx = 0;
                    voice.writePos = i;
                    voice.buffer = bufDesc.data.channels[chan];
                    //voice.sampleRate = bufDesc.format.sampRate;
                    activeVoices.push(voice);
                }

                // Update stride indexes.
                triggerIdx += triggerInc;
                speedIdx += speedInc;
                bufferIndexIdx += bufferIndexInc;

                // Clear out old values in the buffer.
                out[i] = 0.0;

                prevTrigger = triggerVal;
            }

            // Loop through each active voice and write it out to the block.
            for (j = 0; j < activeVoices.length;) {
                voice = activeVoices[j];
                buffer = voice.buffer;
                numSampsToWriteForVoice = Math.min(buffer.length - voice.currentIdx, numSamps);

                for (k = voice.writePos; k < numSampsToWriteForVoice; k++) {
                    // TODO: deal with speed and sample rate converstion.
                    samp = that.interpolate ? that.interpolate(voice.currentIdx, buffer) : buffer[voice.currentIdx | 0];
                    out[k] += samp;
                    voice.currentIdx += voice.speed;
                }

                if (voice.currentIdx >= buffer.length) {
                    // This voice is done.
                    freeVoices.push(voice);
                    activeVoices.splice(j, 1);
                } else {
                    voice.writePos = 0;
                    j++;
                }
            }

            m.prevTrigger = prevTrigger;
            m.unscaledValue = samp;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.init = function () {
            that.buffers = [];
            that.allocateVoices();
            that.onInputChanged();
        };

        that.allocateVoices = function () {
            for (var i = 0; i < that.model.maxVoices; i++) {
                that.model.freeVoices.push({});
            }
        };

        that.onInputChanged = function () {
            // TODO: This is a pretty lame way to manage buffers.
            var enviroBufs = that.enviro.buffers,
                bufIDs = that.options.bufferIDs,
                i,
                bufID,
                bufDesc;

            // Clear the list of buffers.
            that.buffers.length = 0;

            // TODO: This is broken.
            for (i = 0; i < bufIDs.length; i++) {
                bufID = bufIDs[i];
                bufDesc = enviroBufs[bufID];
                that.buffers.push(bufDesc);
            }

            flock.onMulAddInputChanged(that);
            that.calculateStrides();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.triggerBuffers", {
        inputs: {
            trigger: 0,
            bufferIndex: 0, // A value between 0 and 1.0
            speed: 1,
            channel: 0
        },
        ugenOptions: {
            model: {
                prevTrigger: 0,
                maxVoices: 128,
                activeVoices: [],
                freeVoices: [],
                channel: 0
            },
            bufferIDs: [],
            strideInputs: ["trigger", "bufferIndex", "speed"]
        }
    });


    flock.ugen.chopBuffer = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        flock.ugen.buffer(that);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output;

            flock.ugen.chopBuffer.prepareVoices(that, numSamps);
            flock.ugen.chopBuffer.generateSamplesForAllVoices(that, numSamps);

            m.unscaledValue = flock.ugen.lastOutputValue(numSamps, out);
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
            that.calculateStrides();
            flock.onMulAddInputChanged(that);
        };

        that.onBufferReady = function () {
            var m = that.model;
            m.stepSize = that.buffer.format.sampleRate / m.sampleRate;
            m.lastIdx = that.buffer.format.numSampleFrames - 1;
        };

        that.init = function () {
            flock.ugen.chopBuffer.initVoices(that);
            that.initBuffer();
            that.onInputChanged();

            var source = that.buffer.data.channels[that.inputs.channel.output[0]];
            that.model.lastIdx = source.length - 1;
        };

        that.init();

        return that;
    };

    flock.ugen.chopBuffer.initVoice = function () {
        return {
            currentStage: 4,
            samplesRemaining: 0,
            duration: 0.0,
            attackDur: 0.0,
            releaseDur: 0.0,
            hasTriggeredNextVoice: false,
            idx: 0.0,

            stages: [
                {
                    samplesRemaining: 0
                },
                {
                    samplesRemaining: 0
                },
                {
                    samplesRemaining: 0
                },
                {
                    samplesRemaining: 0
                }
            ]
        };
    };

    flock.ugen.chopBuffer.initVoices = function (that) {
        var m = that.model;

        for (var i = 0; i < that.options.maxVoices; i++) {
            var voice = flock.ugen.chopBuffer.initVoice(that);
            m.freeVoices[i] = voice;
        }
    };

    flock.ugen.chopBuffer.randomIndex = flock.randomValue;

    flock.ugen.chopBuffer.randomStartIndex = function (that) {
        var m = that.model,
            inputs = that.inputs,
            maxStartIdx = inputs.end.output[0] - m.inputState.numDurationSamps;

        maxStartIdx = Math.max(0, maxStartIdx);
        return flock.ugen.chopBuffer.randomIndex(inputs.start.output[0], maxStartIdx) * m.lastIdx;
    };

    flock.ugen.chopBuffer.allocateVoice = function (that) {
        var m = that.model,
            stageSampleState = m.stageSampleState;

        if (m.freeVoices.length < 1) {
            return; // We're maxed out on voices already.
        }

        var voice = m.freeVoices.pop();
        m.activeVoices.push(voice);

        for (var i = 0; i < stageSampleState.length; i++) {
            var stage = voice.stages[i];
            stage.samplesRemaining = stageSampleState[i];
        }

        voice.hasTriggeredNextVoice = false;
        voice.currentStage = flock.ugen.chopBuffer.stages.WAIT;
        voice.samplesRemaining = m.inputState.numDurationSamps + m.inputState.numGapSamps;
        voice.idx = flock.ugen.chopBuffer.randomStartIndex(that);

        return voice;
    };

    flock.ugen.chopBuffer.updateVoiceState = function (that, voice) {
        var m = that.model,
            stageSampleState = m.stageSampleState,
            inputState = m.inputState;

        for (var i = voice.currentStage; i < stageSampleState.length; i++) {
            var stage = voice.stages[i],
                stateForStage = stageSampleState[i];

            if (stage.samplesRemaining > stateForStage) {
                stage.samplesRemaining = stateForStage;
            }
        }

        if (voice.samplesRemaining > inputState.numDurationSamps) {
            voice.samplesRemaining = inputState.numDurationSamps;

            if (voice.currentStage === 0) {
                voice.samplesRemaining += inputState.numGapSamps;
            }
        }
    };

    flock.ugen.chopBuffer.triggerNextVoice = function (that, voice, numSamps, numDurationSamps, numGapSamps) {
        var numWaitSamps = voice.samplesRemaining + numGapSamps;
        if (numWaitSamps < numSamps) {
            that.model.stageSampleState[0] = numWaitSamps;
            flock.ugen.chopBuffer.allocateVoice(that);
            voice.hasTriggeredNextVoice = true;
        }
    };

    flock.ugen.chopBuffer.envLength = function (stageDuration, halfMinDuration, sampleRate) {
        return Math.floor((stageDuration > halfMinDuration ?
            halfMinDuration : stageDuration) * sampleRate);
    };

    flock.ugen.chopBuffer.deactivateVoice = function (that, voice) {
        var m = that.model,
            voiceIdx = m.activeVoices.indexOf(voice);

        if (voiceIdx > -1) {
            m.activeVoices.splice(voiceIdx, 1);
        }

        m.freeVoices.push(voice);
    };

    flock.ugen.chopBuffer.prepareVoice = function (that, voice, numSamps) {
        flock.ugen.chopBuffer.updateVoiceState(that, voice);

        if (voice.currentStage < flock.ugen.chopBuffer.stages.DONE) {
            // Allocate the next voice if it should be active within this block.
            if (!voice.hasTriggeredNextVoice) {
                flock.ugen.chopBuffer.triggerNextVoice(that, voice, numSamps);
            }
        } else {
            flock.ugen.chopBuffer.deactivateVoice(that, voice);
        }
    };

    flock.ugen.chopBuffer.durationSamples = function (minDuration, amount, m) {
        return amount === 0.0 ? m.lastIdx : Math.floor((minDuration / amount) * m.sampleRate);
    };

    flock.ugen.chopBuffer.updateInputState = function (inputs, m) {
        var inputState = m.inputState,
            amount = inputs.amount.output[0],
            minDuration = inputs.minDuration.output[0],
            halfMinDuration = minDuration / 2;

        inputState.numDurationSamps = flock.ugen.chopBuffer.durationSamples(minDuration, amount, m);
        inputState.numAttackSamps = flock.ugen.chopBuffer.envLength(inputs.attack.output[0], halfMinDuration, m.sampleRate);
        inputState.numReleaseSamps = flock.ugen.chopBuffer.envLength(inputs.release.output[0], halfMinDuration, m.sampleRate);
        inputState.numSustainSamps = inputState.numDurationSamps - inputState.numAttackSamps - inputState.numReleaseSamps;
        inputState.numGapSamps = Math.floor(inputs.gap.output[0] * m.sampleRate);

        return inputState;
    };

    flock.ugen.chopBuffer.prepareVoices = function (that, numSamps) {
        var m = that.model;

        // TODO: Sort out the relationship between "inputState" and "stageSampleState".
        flock.ugen.chopBuffer.updateInputState(that.inputs, m);
        m.stageSampleState[0] = m.inputState.numGapSamps;
        m.stageSampleState[1] = m.inputState.numAttackSamps;
        m.stageSampleState[3] = m.inputState.numReleaseSamps;
        m.stageSampleState[2] = m.inputState.numSustainSamps;

        for (var voiceIdx = 0; voiceIdx < m.activeVoices.length; voiceIdx++) {
            var voice = m.activeVoices[voiceIdx];
            flock.ugen.chopBuffer.prepareVoice(that, voice, numSamps);
        }

        if (m.activeVoices.length === 0) {
            flock.ugen.chopBuffer.allocateVoice(that);
        }
    };

    flock.ugen.chopBuffer.generateSamplesForVoice = function (that, voice, numSamps) {
        var m = that.model,
            out = that.output,
            inputs = that.inputs,
            speed = inputs.speed.output,
            source = that.buffer.data.channels[inputs.channel.output[0]];

        for (var i = 0, j = 0; i < Math.min(numSamps, voice.samplesRemaining); i++, j += m.strides.speed) {
            if (voice.currentStage >= flock.ugen.chopBuffer.stages.DONE) {
                break;
            }

            var step = m.stepSize * speed[j],
                stage = voice.stages[voice.currentStage];

            out[i] += that.interpolate(voice.idx, source);
            voice.samplesRemaining -= step;
            stage.samplesRemaining -= step;
            voice.idx += step;

            if (stage.samplesRemaining <= 0) {
                voice.currentStage++;
            }
        }

        if (voice.samplesRemaining <= 0 && voice.currentStage < flock.ugen.chopBuffer.stages.DONE) {
            voice.currentStage = flock.ugen.chopBuffer.stages.DONE;
        }
    };

    flock.ugen.chopBuffer.generateSamplesForAllVoices = function (that, numSamps) {
        var m = that.model;

        flock.clearBuffer(that.output);

        for (var voiceIdx = m.activeVoices.length - 1; voiceIdx >= 0; voiceIdx--) {
            var voice = m.activeVoices[voiceIdx];
            flock.ugen.chopBuffer.generateSamplesForVoice(that, voice, numSamps);
        }
    };

    flock.ugen.chopBuffer.stages = {
        WAIT: 0,
        ATTACK: 1,
        SUSTAIN: 2,
        RELEASE: 3,
        DONE: 4
    };

    flock.ugenDefaults("flock.ugen.chopBuffer", {
        rate: "audio",
        inputs: {
            buffer: null,
            channel: 0.0,       // Constant rate
            start: 0.0,         // Control, constant rate
            end: 1.0,           // Control, constant rate
            speed: 1.0,         // Audio, control, constant rate
            amount: 1.0,        // Control, constant rate
            minDuration: 0.1,   // Control, constant rate
            attack: 0.01,       // Control, constant rate
            release: 0.01,      // Control, constant rate
            gap: 0.0            // Control, constant rate
        },
        ugenOptions: {
            model: {
                stepSize: 1.0,
                activeVoices: [],
                freeVoices: [],
                stageSampleState: [0, 0, 0, 0],
                lastIdx: 0,
                inputState: {
                    numAttackSamps: 0,
                    numSustainSamps: 0,
                    numReleaseSamps: 0,
                    numDurationSamps: 0,
                    numGapSamps: 0
                }
            },
            interpolation: "linear",
            envelopeType: "linear",
            maxVoices: 2,
            strideInputs: ["speed"]
        }
    });
}());
