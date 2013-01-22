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
            var settings = that.audioSettings,
                stream = that.cubebState.stream,
                playState = that.model;
                
            if (that.nodes.length < 1) {
                // If there are no nodes providing samples, write out silence.
                stream.write(that.silence);
            } else {
                // TODO: Inline interleavedWriter
                flock.interleavedWriter(that.outputArray, that.gen, that.buses, that.audioSettings);
                stream.write(that.outputBuffer);
            }
            
            // TODO: This code is likely similar or identical in all environment strategies.
            playState.written += settings.bufferSize * settings.chans;
            if (playState.written >= playState.total) {
                that.stop();
            }
        };
        
        that.stopGeneratingSamples = function () {
            that.cubebState.stream.stop();
        };
        
        that.init = function () {
            var settings = that.audioSettings,
                sampleFormatSpec = flock.enviro.nodejs.sampleFormats[settings.sampleFormat],
                numBufferSamps = settings.bufferSize * sampleFormatSpec.bytes * settings.chans;
            
            that.outputBuffer = new Buffer(numBufferSamps);
            that.outputArray = new Float32Array(that.outputBuffer);
            that.silence = flock.generate.silence(new Buffer(numBufferSamps));
            
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
        "float32NE": {
            cubebFormat: cubeb.SAMPLE_FLOAT32NE,
            bytes: 4
        }
    };
    
}());
