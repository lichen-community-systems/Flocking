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

var flock = flock || {};

(function () {
    "use strict";
    
    /**
     * Generates an interleaved audio buffer from the source buffers.
     * If the output buffer size isn't divisble by the control rate,
     * it will be rounded down to the nearest block size.
     *
     * @param {Array} outBuf the output buffer to write into
     * @param {Function} evalFn a function to invoke before writing each control block
     * @param {Array} sourceBufs the array of channel buffers to interleave and write out
     * @param {Object} audioSettings the current audio system settings
     * @return a channel-interleaved output buffer
     */
    flock.interleavedWriter = function (outBuf, evalFn, sourceBufs, audioSettings) {
        var kr = audioSettings.rates.control,
            chans = audioSettings.chans,
            numKRBufs = audioSettings.bufferSize / kr,
            i,
            chan,
            samp;
            
        for (i = 0; i < numKRBufs; i++) {
            evalFn();
            var offset = i * kr * chans;
            
            // Interleave each output channel.
            for (chan = 0; chan < chans; chan++) {
                var sourceBuf = sourceBufs[chan];
                for (samp = 0; samp < kr; samp++) {
                    var frameIdx = samp * chans + offset;
                    outBuf[frameIdx + chan] = sourceBuf[samp];
                }
            }
        }
        
        return outBuf;
    };
    
    /**
     * Mixes in Firefox-specific Audio Data API implementations for outputting audio
     *
     * @param that the environment to mix into
     */
    flock.enviro.moz = function (that) {
        that.audioEl = new Audio();
        that.model.bufferDur = (that.audioSettings.bufferSize / that.audioSettings.rates.audio) * 1000;
        that.model.queuePollInterval = Math.ceil(that.model.bufferDur / 20);
        that.audioEl.mozSetup(that.audioSettings.chans, that.audioSettings.rates.audio);
        that.outBuffer = new Float32Array(that.audioSettings.bufferSize * that.audioSettings.chans);
        
        that.startGeneratingSamples = function () {
            if (that.scheduled) {
                return;
            }
            that.asyncScheduler.repeat(that.model.queuePollInterval, that.writeSamples);
            that.scheduled = true;
        };
        
        that.writeSamples = function () {
            var playState = that.model.playState,
                currentOffset = that.audioEl.mozCurrentSampleOffset(),
                queued = playState.written - currentOffset,
                outBuf = that.outBuffer;
            
            if (queued > that.audioSettings.bufferSize || that.nodes.length < 1) {
                return;
            }
            
            flock.interleavedWriter(outBuf, that.gen, that.buses, that.audioSettings);
            playState.written += that.audioEl.mozWriteAudio(outBuf);
            
            if (playState.written >= playState.total) {
                that.stop();
            }
        };
        
        that.stopGeneratingSamples = function () {
            that.asyncScheduler.clearRepeat(that.model.writeInterval);
            that.scheduled = false;
        };
    };

}());
