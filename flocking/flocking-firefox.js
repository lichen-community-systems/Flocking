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
