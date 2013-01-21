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

    var cubeb = require("cubeb");
    fluid.registerNamespace("flock.enviro");
    
    flock.enviro.nodejs = function (that) {
        
        that.startGeneratingSamples = function () {
            that.cubebState.stream.start();
        };

        that.writeSamples = function (frameCount) {
            var chans = that.audioSettings.chans,
                numSamps = frameCount * chans,
                kr = that.audioSettings.rates.control,
                playState = that.model,
                bufSize = that.audioSettings.bufferSize,
                sourceBufs = that.buses,
                offset = 0,
                i;
                
            // If there are no nodes providing samples, write out silence.
            if (that.nodes.length < 1) {
                that.cubebState.stream.write(new Buffer(flock.generate.silence(numSamps))); // TODO: Garbage heavy.
                return;
            }
            
            flock.interleavedWriter(that.outputArray, that.gen, sourceBufs, that.audioSettings);
            for (i = 0; i < that.outputArray.length; i++) {                
                that.outputBuffer.writeFloatLE(that.outputArray[i], i * 4);
            }
            that.cubebState.stream.write(that.outputBuffer);
            
            // TODO: This code is likely similar or identical in all environment strategies.
            playState.written += bufSize * chans;
            if (playState.written >= playState.total) {
                that.stop();
            }
        };
        
        that.stopGeneratingSamples = function () {
            that.cubebState.stream.stop();
        };
        
        that.init = function () {
            var settings = that.audioSettings,
                sampleFormatSpec = flock.enviro.nodejs.sampleFormats[settings.sampleFormat];
            
            that.outputArray = new Float32Array(settings.bufferSize * settings.chans);
            that.outputBuffer = new Buffer(settings.bufferSize * sampleFormatSpec.bytes * settings.chans);
            
            that.cubebState = {
                context: new cubeb.Context("Flocking Context")
            };
            
            that.cubebState.stream = new cubeb.Stream(
                that.cubebState.context,
                "Flocking Stream",
                sampleFormatSpec.cubebFormat,
                settings.chans,
                settings.rates.audio,
                settings.bufferSize,
                settings.latency,
                that.writeSamples,
                fluid.identity
            );
        };
        
        that.init();
    };
    
    flock.enviro.nodejs.sampleFormats = {
        "float32LE": {
            cubebFormat: cubeb.SAMPLE_FLOAT32LE,
            bytes: 4
        }
    };
    
}());
