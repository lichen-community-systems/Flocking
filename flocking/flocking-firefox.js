/*
* Flocking Firefox-Specific Code
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Float32Array, Audio*/
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
    
    fluid.defaults("flock.enviro.moz", {
        gradeNames: ["flock.enviro.audioStrategy", "autoInit"],
        
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
        }
    });
    
    /**
     * Mixes in Firefox-specific Audio Data API implementations for outputting audio
     *
     * @param that the environment to mix into
     */
    flock.enviro.moz.finalInit = function (that) {
        
        that.startGeneratingSamples = function () {
            if (that.scheduled) {
                return;
            }
            
            if (flock.platform.isLinux && that.audioEl.mozCurrentSampleOffset() === 0) {
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
                audioSettings = that.options.audioSettings;
            
            if (queued > audioSettings.bufferSize || that.nodeEvaluator.nodes.length < 1) {
                return;
            }
            
            // TODO: Inline and mock out mozWriteAudio for unit testing.
            flock.enviro.moz.interleavedWriter(
                outBuf,
                that.nodeEvaluator.gen,
                that.nodeEvaluator.buses,
                that.model.krPeriods,
                audioSettings.blockSize,
                audioSettings.chans
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
            var audioSettings = that.options.audioSettings,
                rates = audioSettings.rates,
                bufSize = audioSettings.bufferSize,
                chans = audioSettings.chans,
                numSamps = bufSize * chans;
            
            that.outBuffer = new Float32Array(numSamps);
            that.silentBuffer = new Float32Array(numSamps);
            that.audioEl = new Audio();
            that.audioEl.mozSetup(chans, rates.audio);
            
            that.model.bufferDur = (bufSize / rates.audio) * 1000;
            that.model.queuePollInterval = Math.ceil(that.model.bufferDur / audioSettings.genPollIntervalFactor);
            that.model.krPeriods = bufSize / audioSettings.blockSize;
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
     * @param {Number} blockSize the control rate
     * @param {Number} chans the number of channels to output
     * @param {Object} audioSettings the current audio system settings
     * @return a channel-interleaved output buffer
     */
    flock.enviro.moz.interleavedWriter = function (outBuf, evalFn, sourceBufs, krPeriods, blockSize, chans) {
        for (var i = 0; i < krPeriods; i++) {
            evalFn();
            var offset = i * blockSize * chans;
            
            // Interleave each output channel.
            for (var chan = 0; chan < chans; chan++) {
                var sourceBuf = sourceBufs[chan];
                for (var sampIdx = 0; sampIdx < blockSize; sampIdx++) {
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
