/*
* Flocking Audio File Benchmark Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2012-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global require, sheep*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.registerNamespace("flock.test");
    
	var testConfigs = [
        {
            name: "Decode 16 bit WAV file from base64-encoded dataURL",
            url: flock.test.audio.triangleInt16WAV
        },
        {
            name: "Decode 16 bit AIFF file from base64-encoded dataURL",
            url: flock.test.audio.triangleInt16AIFF
        }
    ];
	
    var emptyFn = function () {};
	
    var makeTestSpec = function (config) {
        return {
            name: config.name,
            test: function () {
                // TODO: This code assumes flock.audio.decode will run synchronously,
                // which it doesn't always do and can't be relied upon.
                flock.audio.decode(config.url, emptyFn);
            }
        };
    };
	
    flock.test.timeDecodeAudioFileFromDataURL = function () {
        var testSpecs = [],
            i, 
            config;
        
        for (i = 0; i < testConfigs.length; i++) {
            config = testConfigs[i];
            testSpecs.push(makeTestSpec(config));
        }
        
        sheep.test(testSpecs, true);
    };

}());
