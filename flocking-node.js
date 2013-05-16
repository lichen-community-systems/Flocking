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
                m = that.model,
                playState = m.playState,
                kr = audioSettings.rates.control,
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
                    that.nodeEvaluator.gen();
                    out = new Buffer(m.numBlockBytes);
                    
                    // Interleave each output channel.
                    for (var chan = 0; chan < chans; chan++) {
                        var bus = that.nodeEvaluator.buses[chan];
                        for (var sampIdx = 0; sampIdx < kr; sampIdx++) {
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
        
        that.init = function () {
            var audioSettings = that.options.audioSettings,
                rates = audioSettings.rates,
                bufSize = audioSettings.bufferSize,
                m = that.model;
            
            m.numBlockBytes = rates.control * audioSettings.chans * 4; // Flocking uses Float32s, hence * 4
            m.pushRate = (bufSize / rates.audio / 2) * 1000;
            that.speaker = new Speaker();
            that.outputStream = flock.enviro.nodejs.setupOutputStream(audioSettings);
            that.silence = flock.generate.silence(new Buffer(m.numBlockBytes));
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
