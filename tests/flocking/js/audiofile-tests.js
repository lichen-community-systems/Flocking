/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global module, test, expect, ok, equals, deepEqual, Float32Array*/

var flock = flock || {};
flock.test = flock.test || {};

(function () {
    "use strict";
    
    var b64WAVData = "UklGRqIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YX4AAAABAF8GrwzdEtsYnh4KJCcpzi0MMsE19DiUO5o9Cj/QP/w/gD9lPqw8VTpvN/Qz/i+IK6QmYCHDG+YVyg+KCTADz/x49jTwHeo65KLeWtl71ADQDMyRyKvFVcObwX7ABsAuwPjAZsJqxA/HO8r4zS7S3dbz22ThJOcj7VHzofk=";
    var onePeriod700HzWAV = "data:audio/wav;base64," + b64WAVData;
    var onePeriod700HzAIFF = "data:audio/aiff;base64,Rk9STQAAAKxBSUZGQ09NTQAAABIAAQAAAD8AEEAOrEQAAAAAAABTU05EAAAAhgAAAAAAAAAAAAEGXgyxEtsY3R6dJAkpKS3MMg01wjjyO5Y9mD8LP88//j9+PmY8rDpUN3Ez8TABK4UmqCFcG8YV4w/NCYgDMfzP9nfwNuob5Dveo9lX1H/P/MwPyI/FrcNTwZzAfcAHwC3A+sJkxGvHD8o6zfnSLtbc2/XhYucl7SPzUPmj";
    
    module("flock.file.readDataUrl() tests");
    
    test("Read base 64-encoding in data URL", function () {
        var expectedData = window.atob(b64WAVData),
            dataFormatCombinations = [
                {
                    name: "base64-encoded with a MIME type",
                    url: onePeriod700HzWAV
                },
                {
                    name: "not base64 encoded with a MIME type",
                    url: "data:audio/wav," + expectedData
                },
                {
                    name: "base64-encoded with no MIME type",
                    url: "data:;base64," + b64WAVData
                },
                {
                    name: "not base64 encoded data URL with no MIME type",
                    url: "data:," + expectedData
                }
            ],
            i, formatSpec;
    
        for (i = 0; i < dataFormatCombinations.length; i++) {
            formatSpec = dataFormatCombinations[i];
            flock.file.readDataUrl(formatSpec.url, function (data, type) {
                equal(data, expectedData, "readDataUrl() should correctly parse and decode a data URL that is " + formatSpec.name);
            });    
        } 
    });
    
    var mimeTypeCombinations = {
        "wav": [
            "data:audio/wav;base64,xyz",
            "data:audio/wave;base64,xyz",
            "data:audio/x-wav;base64,xyz",
            "data:audio/wav,xyz",
            "data:audio/wave,xyz",
            "data:audio/x-wav,xyz"
        ],
        "aiff": [
            "data:audio/aiff;base64,xyz",
            "data:sound/aiff;base64,xyz",
            "data:audio/x-aiff;base64,xyz",
            "data:audio/aiff,xyz",
            "data:sound/aiff,xyz",
            "data:audio/x-aiff,xyz"
        ]
    };
    
    test("Parse MIME typed data URLs", function () {
        var expectedType, urls, i, url;
        for (expectedType in mimeTypeCombinations) {
            urls = mimeTypeCombinations[expectedType];
            for (i = 0; i < urls.length; i++) {
                url = urls[i];
                flock.file.readDataUrl(url, function (data, actualType) {
                    equal(actualType, expectedType, "readDataUrl() should recognize " + url + " as a " + expectedType + " file.");
                });
            }
        }
    });
    
    module("flock.audio.decode() tests");
    
    var testOnePeriod700HzHalfAmplitudeBuffer = function (decoded) {
        var buffer = decoded.channels[0];
        
        equal(decoded.numberOfChannels, 1, "The decoded audio file's metadata should indicate that there is only one channel.");
        equal(decoded.channels.length, 1, "The decoded audio should have only one channel buffer.");
        equal(decoded.bitDepth, 16, "The decoded audio file's metadata should indicate a bith depth of 16.");
        equal(decoded.sampleRate, 44100, "The decoded audio file's metadata should indicate a sample rate of 44100 samples per second.");
        equal(decoded.length, 63, "The decoded audio file's metadata should indicate that there is a total of 63 samples of data in the file.");
        
        flock.test.assertNotNaN(buffer, "The buffer should not output an NaN values");
        flock.test.assertNotSilent(buffer, "The buffer should not be silent.");
        flock.test.assertUnbroken(buffer, "The buffer should not have any significant gaps in it.");
        flock.test.assertWithinRange(buffer, -0.5, 0.5, "The buffer's amplitude should be no louder than 0.5");
        flock.test.assertContinuous(buffer, 0.1, "The buffer should be continuous");
        flock.test.assertSineish(buffer, 0.5, 0.01, "The buffer should resemble a sine wave.");
    };
    
    test("Decode .wav file", function () {
        flock.audio.decode(onePeriod700HzWAV, testOnePeriod700HzHalfAmplitudeBuffer);
    });
    
    test("Decode .aiff file", function () {
        flock.audio.decode(onePeriod700HzAIFF, testOnePeriod700HzHalfAmplitudeBuffer);
    });

})();
