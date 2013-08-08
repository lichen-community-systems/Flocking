/*
* Flocking WebAudio Strategy
* http://github.com/colinbdclark/flocking
*
* Copyright 2013, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Float32Array, AudioContext, webkitAudioContext*/
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";
    
    /**
     * Web Audio API Audio Strategy
     */
    fluid.defaults("flock.enviro.webAudio", {
        gradeNames: ["flock.enviro.audioStrategy", "autoInit"]
    });
    
    flock.enviro.webAudio.finalInit = function (that) {
        
        that.startGeneratingSamples = function () {
            that.jsNode.onaudioprocess = that.writeSamples; // TODO: When Firefox ships, is this still necessary?
            that.jsNode.connect(that.context.destination);
            
            // Work around a bug in iOS Safari where it now requires a noteOn() 
            // message to be invoked before sound will work at all. Just connecting a 
            // ScriptProcessorNode inside a user event handler isn't sufficient.
            if (that.model.shouldInitIOS) {
                var s = that.source;
                (s.start || s.noteOn).call(that.source, 0);
                (s.stop || s.noteOff).call(that.source, 0);
                that.model.shouldInitIOS = false;
            }
        };
        
        that.stopGeneratingSamples = function () {
            that.jsNode.disconnect(0);
            that.jsNode.onaudioprocess = undefined;
        };
        
        that.writeSamples = function (e) {
            var audioSettings = that.options.audioSettings,
                kr = audioSettings.rates.control,
                playState = that.model.playState,
                chans = audioSettings.chans,
                outBufs = e.outputBuffer;
                
            // If there are no nodes providing samples, write out silence.
            if (that.nodeEvaluator.nodes.length < 1) {
                for (chan = 0; chan < chans; chan++) {
                    flock.generate.silence(outBufs.getChannelData(chan));
                }
                return;
            }

            for (var i = 0; i < that.model.krPeriods; i++) {
                that.nodeEvaluator.gen();
                var offset = i * kr;

                // Loop through each channel.
                for (var chan = 0; chan < chans; chan++) {
                    var sourceBuf = that.nodeEvaluator.buses[chan],
                        outBuf = outBufs.getChannelData(chan);
                    
                    // And output each sample.
                    for (var samp = 0; samp < kr; samp++) {
                        outBuf[samp + offset] = sourceBuf[samp];
                    }
                }
            }
            
            playState.written += audioSettings.bufferSize * chans;
            if (playState.written >= playState.total) {
                that.stop();
            }
        };
        
        that.init = function () {
            var settings = that.options.audioSettings;
            that.model.krPeriods = settings.bufferSize / settings.rates.control;
            
            // Singleton AudioContext since the WebKit implementation
            // freaks if we try to instantiate a new one.
            if (!flock.enviro.webAudio.audioContext) {
                flock.enviro.webAudio.audioContext = new flock.enviro.webAudio.contextConstructor();
            }
            
            that.context = flock.enviro.webAudio.audioContext;
            settings.rates.audio = that.context.sampleRate;
            that.source = that.context.createBufferSource();
            that.jsNode = that.context.createJavaScriptNode(settings.bufferSize);
            that.source.connect(that.jsNode);
            
            that.model.shouldInitIOS = flock.platform.isIOS;
        };
        
        that.init();
    };
    
    flock.enviro.webAudio.contextConstructor = window.AudioContext || window.webkitAudioContext;
    
    fluid.demands("flock.enviro.audioStrategy", "flock.platform.webAudio", {
        funcName: "flock.enviro.webAudio"
    });

}());
