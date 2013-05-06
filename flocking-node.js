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
        gradeNames: ["fluid.modelComponent", "autoInit"],
        mergePolicy: {
            genFn: "nomerge",
            nodes: "nomerge",
            buses: "nomerge"
        }
    });
    
    flock.enviro.nodejs.finalInit = function (that) {
        that.audioSettings = that.options.audioSettings;
        that.gen = that.options.genFn;
        that.buses = that.options.buses;
        that.nodes = that.options.nodes;
        
        that.startGeneratingSamples = function () {
            that.outputStream._read = that.writeSamples;
            that.outputStream.pipe(that.speaker);
        };

        // TODO: The current implementation ignores the numBytes argument in favour of a fixed buffer size.
        // This may cause over or underruns in cases where node-speaker doesn't pull samples at a fixed rate.
        that.writeSamples = function (numBytes) {
            var settings = that.audioSettings,
                playState = that.model,
                kr = settings.rates.control,
                chans = settings.chans,
                out = that.outputBuffer;
            
            if (that.nodes.length < 1) {
                // If there are no nodes providing samples, write out silence.
                that.outputStream.push(that.silence);
            } else {
                // TODO: Some duplication with flock.enviro.moz.interleavedWriter().
                for (var i = 0; i < that.model.krPeriods; i++) {
                    that.gen();
                    var offset = i * kr * chans;
        
                    // Interleave each output channel.
                    for (var chan = 0; chan < chans; chan++) {
                        var bus = that.buses[chan];
                        for (var sampIdx = 0; sampIdx < kr; sampIdx++) {
                            var frameIdx = sampIdx * chans + offset;
                            out.writeFloatLE(bus[sampIdx], (frameIdx + chan) * 4);
                        }
                    }
                }
                
                that.outputStream.push(out);
            }
            
            playState.written += settings.bufferSize * settings.chans;
            if (playState.written >= playState.total) {
                that.stop();
            }
        };
        
        that.stopGeneratingSamples = function () {
            that.outputStream.unpipe(that.speaker);
            that.outputStream._read = undefined;
        };
        
        that.init = function () {
            var settings = that.audioSettings,
                numSamps = settings.bufferSize * settings.chans,
                numBytes = numSamps * 4; // Flocking uses Float32s, hence * 4
            
            that.speaker = new Speaker();
            that.outputStream = flock.enviro.nodejs.setupOutputStream(settings);
            that.outputBuffer = new Buffer(numBytes);
            that.silence = flock.generate.silence(new Buffer(numBytes));
            
            that.model.krPeriods = settings.bufferSize / settings.rates.control;
        };
        
        that.init();
    };
    
    flock.enviro.nodejs.setupOutputStream = function (settings) {
        var outputStream = new Readable();
        outputStream.bitDepth = 32;
        outputStream.float = true
        outputStream.signed = true;
        outputStream.channels = settings.chans;
        outputStream.sampleRate = settings.rates.audio;
        outputStream.samplesPerFrame = settings.bufferSize;
        
        return outputStream;
    };
    
    fluid.demands("flock.enviro.audioStrategy", "flock.platform.nodejs", {
        funcName: "flock.enviro.nodejs"
    });
    
}());
