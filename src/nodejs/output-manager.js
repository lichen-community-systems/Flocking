/*
 * Flocking Node.js Output Manager
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2014-2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true,
    browser: false, node: true, forin: true, continue: true, nomen: true,
    bitwise: true, maxerr: 100, indent: 4 */

"use strict";

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock"),
    Speaker = require("speaker"),
    Readable = require("stream").Readable;

fluid.defaults("flock.nodejs.outputManager", {
    gradeNames: ["flock.outputManager"],

    bytesPerSample: 4, // Flocking uses Float32s, hence 4 bytes.

    model: {
        bytesPerBlock: {
            expander: {
                funcName: "flock.nodejs.outputManager.calcBlockBytes",
                args: ["{audioSystem}.model", "{that}.options.bytesPerSample"]
            }
        }
    },

    members: {
        speaker: {
            expander: {
                funcName: "flock.nodejs.outputManager.createSpeaker",
                args: "{audioSystem}.model"
            }
        },

        outputStream: {
            expander: {
                funcName: "flock.nodejs.outputManager.createOutputStream",
                args: "{audioSystem}.model"
            }
        },

        sampleWriter: {
            expander: {
                funcName: "flock.nodejs.outputManager.makeSampleWriter",
                args: [
                    "{that}.model",
                    "{that}.options.bytesPerSample",
                    "{that}.outputStream",
                    "{busManager}.buses",
                    "{enviro}.nodeList.nodes"
                ]
            }
        }
    },

    invokers: {
        startReadingAudioInput: {
            funcName: "flock.fail",
            args: "Audio input is not currently supported on Node.js"
        },

        stopReadingAudioInput: "{that}.startReadingAudioInput"
    },

    listeners: {
        "onStart.startGenerating": [
            {
                funcName: "flock.nodejs.outputManager.startGeneratingSamples",
                args: ["{that}"]
            }
        ],

        "onStop.stopGenerating": [
            {
                funcName: "flock.nodejs.outputManager.stopGeneratingSamples",
                args: ["{that}.outputStream", "{that}.speaker"]
            }
        ]
    }
});

flock.nodejs.outputManager.calcBlockBytes = function (audioSettings, bytesPerSample) {
    return audioSettings.blockSize * audioSettings.chans * bytesPerSample;
};

flock.nodejs.outputManager.createSpeaker = function (audioSettings) {
    return new Speaker({
        channels: audioSettings.chans,
        bitDepth: 32,
        sampleRate: audioSettings.rates.audio,
        signed: true,
        float: true,
        samplesPerFrame: audioSettings.bufferSize,
        endianness: "LE"
    });
};

flock.nodejs.outputManager.createOutputStream = function () {
    return new Readable();
};

flock.nodejs.outputManager.startGeneratingSamples = function (that) {
    that.outputStream._read = that.sampleWriter;
    that.outputStream.pipe(that.speaker);
};

flock.nodejs.outputManager.stopGeneratingSamples = function (outputStream, speaker) {
    outputStream.unpipe(speaker);
    outputStream._read = undefined;
};

flock.nodejs.outputManager.makeSampleWriter = function (model, bytesPerSample, outputStream, buses, nodes) {
    return function (numBytes) {
        var m = model,
            s = m.audioSettings,
            blockSize = s.blockSize,
            chans = s.chans,
            krPeriods = numBytes / m.bytesPerBlock,
            out = new Buffer(numBytes);

        if (numBytes < m.bytesPerBlock) {
            return;
        }

        if (nodes.length < 1) {
            // If there are no nodes providing samples, write out silence.
            flock.generate.silence(out);
        } else {
            for (var i = 0, offset = 0; i < krPeriods; i++, offset += m.bytesPerBlock) {
                flock.evaluate.clearBuses(buses, s.numBuses, s.blockSize);
                flock.evaluate.synths(nodes);

                // Interleave each output channel.
                for (var chan = 0; chan < chans; chan++) {
                    var bus = buses[chan];
                    for (var sampIdx = 0; sampIdx < blockSize; sampIdx++) {
                        var frameIdx = (sampIdx * chans + chan) * bytesPerSample;
                        out.writeFloatLE(bus[sampIdx], offset + frameIdx);
                    }
                }
            }
        }

        outputStream.push(out);
    };
};
