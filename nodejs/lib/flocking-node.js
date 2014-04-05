/*
* Flocking Node.js-Specific Code
* http://github.com/colinbdclark/flocking
*
* Copyright 2013, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global */
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var fs = require("fs"),
    url = require("url"),
    fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var Speaker = require("speaker");
    var Readable = require("stream").Readable;

    /*********************************************************
     * Override default clocks with same-thread alternatives *
     *********************************************************/

    fluid.demands("flock.scheduler.webWorkerIntervalClock", ["flock.platform.nodejs", "flock.scheduler.async"], {
        funcName: "flock.scheduler.intervalClock"
    });

    fluid.demands("flock.scheduler.webWorkerScheduleClock", ["flock.platform.nodejs", "flock.scheduler.async"], {
        funcName: "flock.scheduler.scheduleClock"
    });


    /********************************************
     * Override buffer loading implementations. *
     ********************************************/

    fluid.registerNamespace("flock.file");

    flock.file.readFromPath = function (options) {
        var path = options.src;

        fs.exists(path, function (exists) {
            if (!exists && options.error) {
                options.error(path + " doesn't exist.");
                return;
            }

            fs.stat(path, function (error, stats) {
                fs.open(path, "r", function (error, fd) {
                    var buf = new Buffer(stats.size);
                    fs.read(fd, buf, 0, buf.length, null, function (error, bytesRead) {
                        var type = flock.file.parseFileExtension(path);
                        var arr = new Int8Array(buf);
                        options.success(arr.buffer, type);
                    });
                });
            });
        })
    };

    fluid.registerNamespace("flock.net");

    flock.net.readBufferFromUrl = function (options) {
        throw new Error("Loading files from URLs is not currently supported in Node.js.");
    };

    fluid.registerNamespace("flock.audio.loadBuffer");

    flock.audio.loadBuffer.readerForSource = function (src) {
        if (typeof (src) !== "string") {
            throw new Error("Flocking error: Can't load a buffer from an unknown type of source. " +
                "Only paths and URLs are currently supported on Node.js.");
        }
        var parsed = url.parse(src);
        return parsed.protocol === "data:" ? flock.file.readBufferFromDataUrl :
            !parsed.protocol ? flock.file.readFromPath : flock.net.readBufferFromUrl;
    };

    fluid.registerNamespace("flock.audio.decode");

    // TODO: Use a stream-style interface for decoding rather than just dumping the whole job on nextTick().
    flock.audio.decode.async = function (options) {
        process.nextTick(function () {
            flock.audio.decode.sync(options);
        });
    };


    /*********************************************
     * Node.js-based Environment implementation. *
     *********************************************/

    fluid.registerNamespace("flock.enviro");

    fluid.defaults("flock.enviro.nodejs", {
        gradeNames: ["flock.enviro.audioStrategy", "autoInit"]
    });

    flock.enviro.nodejs.finalInit = function (that) {
        that.startGeneratingSamples = function () {
            that.outputStream._read = that.writeSamples;
            that.outputStream.pipe(that.speaker);
        };

        that.pushSamples = function () {
            var audioSettings = that.options.audioSettings,
                m = that.model,
                playState = m.playState,
                blockSize = audioSettings.blockSize,
                chans = audioSettings.chans,
                more = true,
                out;

            if (that.nodeEvaluator.nodes.length < 1) {
                // If there are no nodes providing samples, write out silence.
                while (more) {
                    more = that.outputStream.push(that.silence);
                }
            } else {
                while (more) {
                    that.nodeEvaluator.clearBuses();
                    that.nodeEvaluator.gen();
                    out = new Buffer(m.numBlockBytes);

                    // Interleave each output channel.
                    for (var chan = 0; chan < chans; chan++) {
                        var bus = that.nodeEvaluator.buses[chan];
                        for (var sampIdx = 0; sampIdx < blockSize; sampIdx++) {
                            var frameIdx = sampIdx * chans;
                            out.writeFloatLE(bus[sampIdx], (frameIdx + chan) * 4);
                        }
                    }

                    more = that.outputStream.push(out);
                }
            }

            playState.written += audioSettings.bufferSize * chans;
            if (playState.written >= playState.total) {
                that.stop();
            }
        };

        that.writeSamples = function (numBytes) {
            setTimeout(that.pushSamples, that.model.pushRate);
        };

        that.stopGeneratingSamples = function () {
            that.outputStream.unpipe(that.speaker);
            that.outputStream._read = undefined;
        };

        // TODO: Implement audio input on Node.js.
        that.startReadingAudioInput = that.stopReadingAudioInput = function () {
            throw new Error("Audio input is not currently supported on Node.js");
        };
        
        that.init = function () {
            var audioSettings = that.options.audioSettings,
                rates = audioSettings.rates,
                bufSize = audioSettings.bufferSize,
                m = that.model;

            m.numBlockBytes = audioSettings.blockSize * audioSettings.chans * 4; // Flocking uses Float32s, hence * 4
            m.pushRate = (bufSize / rates.audio) * 1000;
            that.speaker = new Speaker();
            that.outputStream = flock.enviro.nodejs.setupOutputStream(audioSettings);
            that.silence = flock.generate.silence(new Buffer(m.numBlockBytes));
        };

        that.init();
    };

    flock.enviro.nodejs.setupOutputStream = function (audioSettings) {
        var outputStream = new Readable({
            highWaterMark: audioSettings.bufferSize * audioSettings.chans * 4
        });

        outputStream.bitDepth = 32;
        outputStream.float = true
        outputStream.signed = true;
        outputStream.channels = audioSettings.chans;
        outputStream.sampleRate = audioSettings.rates.audio;
        outputStream.samplesPerFrame = audioSettings.bufferSize;

        return outputStream;
    };

    fluid.demands("flock.enviro.audioStrategy", "flock.platform.nodejs", {
        funcName: "flock.enviro.nodejs"
    });

}());
