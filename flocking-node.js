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

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var Speaker = require("speaker");
    var Readable = require("stream").Readable;
    
    // Override the default browser-based worker clocks with their same-thread equivalents.
    fluid.demands("flock.scheduler.webWorkerIntervalClock", ["flock.platform.nodejs", "flock.scheduler.async"], {
        funcName: "flock.scheduler.intervalClock"
    });
    
    fluid.demands("flock.scheduler.webWorkerScheduleClock", ["flock.platform.nodejs", "flock.scheduler.async"], {
        funcName: "flock.scheduler.scheduleClock"
    });


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
                playState = that.model.playState,
                kr = audioSettings.rates.control,
                chans = audioSettings.chans,
                out = that.outputBuffer;
            
            if (that.nodeEvaluator.nodes.length < 1) {
                // If there are no nodes providing samples, write out silence.
                out.push(that.silence);
            } else {
                // TODO: Some duplication with flock.enviro.moz.interleavedWriter().
                for (var i = 0; i < that.model.krPeriods; i++) {
                    that.nodeEvaluator.gen();
                    var offset = i * kr * chans;

                    // Interleave each output channel.
                    for (var chan = 0; chan < chans; chan++) {
                        var bus = that.nodeEvaluator.buses[chan];
                        for (var sampIdx = 0; sampIdx < kr; sampIdx++) {
                            var frameIdx = sampIdx * chans + offset;
                            out.writeFloatLE(bus[sampIdx], (frameIdx + chan) * 4);
                        }
                    }
                }

                that.outputStream.push(out);
            }

            playState.written += audioSettings.bufferSize * chans;
            if (playState.written >= playState.total) {
                that.stop();
            }
        };
        
        that.writeSamples = function (numBytes) {
            setTimeout(that.pushSamples, that.model.pushRate); // TODO: Adaptive scheduling, don't hardcode.
        };
        
        that.stopGeneratingSamples = function () {
            that.outputStream.unpipe(that.speaker);
            that.outputStream._read = undefined;
        };
        
        that.init = function () {
            var audioSettings = that.options.audioSettings,
                rates = audioSettings.rates,
                bufSize = audioSettings.bufferSize,
                numSamps = bufSize * audioSettings.chans,
                numBytes = numSamps * 4, // Flocking uses Float32s, hence * 4
                m = that.model;
            
            that.speaker = new Speaker({
                highWaterMark: audioSettings.bufferSize * audioSettings.chans * 4 // TODO: Necessary?
            });
            that.outputStream = flock.enviro.nodejs.setupOutputStream(audioSettings);
            that.outputBuffer = new Buffer(numBytes);
            that.silence = flock.generate.silence(new Buffer(numBytes));
            
            m.krPeriods = bufSize / rates.control;
            m.bufferDur = bufSize / rates.audio;
            // TODO: Hardcoded and ineffective.
            m.earlyDur = bufSize / 1500;
            m.pushRate = m.bufferDur * 1000 - m.earlyDur;
        };
        
        that.init();
    };
    
    flock.enviro.nodejs.setupOutputStream = function (audioSettings) {
        var outputStream = new Readable();
        
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
