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
    flock = fluid.registerNamespace("flock"),
    macaudio = require("macaudio");

(function () {
    "use strict";

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
            that.node.start();
        };

        that.writeSamples = function (e) {
            var m = that.model,
                hasInput = m.hasInput,
                krPeriods = m.krPeriods,
                evaluator = that.nodeEvaluator,
                buses = evaluator.buses,
                settings = that.options.audioSettings,
                blockSize = settings.blockSize,
                playState = m.playState,
                chans = settings.chans,
                chan,
                i,
                samp;

            // If there are no nodes providing samples, write out silence.
            if (evaluator.nodes.length < 1) {
                for (chan = 0; chan < chans; chan++) {
                    flock.generate.silence(e.getChannelData(chan));
                }
                return;
            }

            for (i = 0; i < krPeriods; i++) {
                var offset = i * blockSize;

                evaluator.clearBuses();
                evaluator.gen();

                // Output the environment's signal
                // to this node's output channels.
                for (chan = 0; chan < chans; chan++) {
                    var sourceBuf = buses[chan],
                        outBuf = e.getChannelData(chan);

                    // And output each sample.
                    for (samp = 0; samp < blockSize; samp++) {
                        outBuf[samp + offset] = sourceBuf[samp];
                    }
                }
            }

            playState.written += settings.bufferSize * chans;
            if (playState.written >= playState.total) {
                that.stop();
            }
        };

        that.stopGeneratingSamples = function () {
            that.node.stop();
        };

        // TODO: Implement audio input on Node.js.
        that.startReadingAudioInput = that.stopReadingAudioInput = function () {
            throw new Error("Audio input is not currently supported on Node.js");
        };

        that.init = function () {
            var settings = that.options.audioSettings,
                rates = settings.rates,
                bufSize = settings.bufferSize,
                m = that.model;

            m.krPeriods = bufSize / settings.blockSize;
            that.node = new macaudio.JavaScriptOutputNode(bufSize);
            that.node.onaudioprocess = that.writeSamples;
        };

        that.init();
    };

    fluid.demands("flock.enviro.audioStrategy", "flock.platform.nodejs", {
        funcName: "flock.enviro.nodejs"
    });

}());
