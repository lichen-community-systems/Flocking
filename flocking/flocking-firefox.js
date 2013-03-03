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
        
        that.audioEl = new Audio();
        that.model.bufferDur = (that.audioSettings.bufferSize / that.audioSettings.rates.audio) * 1000;
        that.model.queuePollInterval = Math.ceil(that.model.bufferDur / that.audioSettings.genPollIntervalFactor);
        that.audioEl.mozSetup(that.audioSettings.chans, that.audioSettings.rates.audio);
        
        var numSamps = that.audioSettings.bufferSize * that.audioSettings.chans;
        that.outBuffer = new Float32Array(numSamps);
        that.silentBuffer = new Float32Array(numSamps);
        
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
            that.genScheduler.clearRepeat(that.model.writeInterval);
            that.scheduled = false;
        };
    };

    fluid.demands("flock.enviro.audioStrategy", "flock.platform.moz", {
        funcName: "flock.enviro.moz"
    });

}());
