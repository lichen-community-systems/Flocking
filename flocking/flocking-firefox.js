/*
* Flocking Firefox-Specific Code
* http://github.com/colinbdclark/flocking
*
* Copyright 2013, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Float32Array, Audio*/
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";
    
    fluid.defaults("flock.enviro.moz", {
        gradeNames: ["fluid.modelComponent", "autoInit"],
        components: {
            genScheduler: {
                type: "flock.scheduler.async",
                options: {
                    components: {
                        timeConverter: {
                            type: "flock.convert.ms"
                        }
                    }
                }
            }
        },
        
        mergePolicy: {
            genFn: "nomerge",
            nodes: "nomerge",
            buses: "nomerge"
        }
    });
    
    /**
     * Mixes in Firefox-specific Audio Data API implementations for outputting audio
     *
     * @param that the environment to mix into
     */
    flock.enviro.moz.finalInit = function (that) {
        // TODO: Remove options unpacking.
        that.audioSettings = that.options.audioSettings;
        that.gen = that.options.genFn;
        that.nodes = that.options.nodes;
        that.buses = that.options.buses;
        
        that.startGeneratingSamples = function () {
            if (that.scheduled) {
                return;
            }
            
            if (flock.platform.isLinuxBased && that.audioEl.mozCurrentSampleOffset() === 0) {
                that.prebufferSilence();
            }
            
            that.genScheduler.repeat(that.model.queuePollInterval, that.writeSamples);
            that.scheduled = true;
        };
        
        that.prebufferSilence = function () {
            while (that.audioEl.mozCurrentSampleOffset() === 0) {
                that.audioEl.mozWriteAudio(that.silentBuffer);
            }
        };
        
        that.writeSamples = function () {
            var playState = that.model.playState,
                currentOffset = that.audioEl.mozCurrentSampleOffset(),
                queued = playState.written - currentOffset,
                outBuf = that.outBuffer,
                settings = that.audioSettings;
            
            if (queued > that.audioSettings.bufferSize || that.nodes.length < 1) {
                return;
            }
            
            flock.enviro.moz.interleavedWriter(
                outBuf,
                that.gen,
                that.buses,
                that.model.krPeriods,
                settings.rates.control,
                settings.chans
            );
            
            playState.written += that.audioEl.mozWriteAudio(outBuf);
            if (playState.written >= playState.total) {
                that.stop();
            }
        };
        
        that.stopGeneratingSamples = function () {
            that.genScheduler.clearRepeat(that.model.writeInterval);
            that.scheduled = false;
        };
        
        that.init = function () {
            var settings = that.audioSettings,
                numSamps = settings.bufferSize * settings.chans;
            
            that.outBuffer = new Float32Array(numSamps);
            that.silentBuffer = new Float32Array(numSamps);
            that.audioEl = new Audio();
            that.audioEl.mozSetup(settings.chans, settings.rates.audio);
            
            that.model.bufferDur = (settings.bufferSize / settings.rates.audio) * 1000;
            that.model.queuePollInterval = Math.ceil(that.model.bufferDur / settings.genPollIntervalFactor);
            that.model.krPeriods = settings.bufferSize / settings.rates.control;
        };
        
        that.init();
    };
    
    /**
     * Generates an interleaved audio buffer from the source buffers.
     * If the output buffer size isn't divisble by the control rate,
     * it will be rounded down to the nearest block size.
     *
     * @param {Array} outBuf the output buffer to write into
     * @param {Function} evalFn a function to invoke before writing each control block
     * @param {Array} sourceBufs the array of channel buffers to interleave and write out
     * @param {Number} krPeriods the number of control rate periods to generate
     * @param {Number} kr the control rate
     * @param {Number} chans the number of channels to output
     * @param {Object} audioSettings the current audio system settings
     * @return a channel-interleaved output buffer
     */
    flock.enviro.moz.interleavedWriter = function (outBuf, evalFn, sourceBufs, krPeriods, kr, chans) {
        for (var i = 0; i < krPeriods; i++) {
            evalFn();
            var offset = i * kr * chans;
            
            // Interleave each output channel.
            for (var chan = 0; chan < chans; chan++) {
                var sourceBuf = sourceBufs[chan];
                for (var sampIdx = 0; sampIdx < kr; sampIdx++) {
                    var frameIdx = sampIdx * chans + offset;
                    outBuf[frameIdx + chan] = sourceBuf[sampIdx];
                }
            }
        }
        
        return outBuf;
    };

    fluid.demands("flock.enviro.audioStrategy", "flock.platform.moz", {
        funcName: "flock.enviro.moz"
    });

}());
