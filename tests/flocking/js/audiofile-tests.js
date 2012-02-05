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
    
    var expectedData =  [
    	0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 
    	0.0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 0.0
    ];
    var b64Int16WAVData = "UklGRnYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVIAAAAAAM0MmRlmJjMzAEDMTJlZZmYyc/9/MnNmZplZzEwAQDMzZiaZGc0MAAAz82fmmtnNzADANLNnppqZzowBgM6MmplnpjSzAMDNzJrZZ+Yz8wAA";
    var triangleInt16WAV = "data:audio/wav;base64," + b64Int16WAVData;
    var triangleInt16AIFF = "data:audio/aiff;base64,Rk9STQAAAIBBSUZGQ09NTQAAABIAAQAAACkAEEAOrEQAAAAAAABTU05EAAAAWgAAAAAAAAAAAAAMzRmZJmYzM0AATMxZmWZmczJ//3MyZmZZmUzMQAAzMyZmGZkMzQAA8zPmZ9mazM3AALM0pmeZmozOgAGMzpmapmezNMAAzM3ZmuZn8zMAAA==";
    
    module("flock.file.readDataUrl() tests");
    
    test("Read base 64-encoding in data URL", function () {
        var expectedData = window.atob(b64Int16WAVData),
            dataFormatCombinations = [
                {
                    name: "base64-encoded with a MIME type",
                    url: triangleInt16WAV
                },
                {
                    name: "not base64 encoded with a MIME type",
                    url: "data:audio/wav," + expectedData
                },
                {
                    name: "base64-encoded with no MIME type",
                    url: "data:;base64," + b64Int16WAVData
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
    
    var testTriangleBuffer = function (decoded) {
        var buffer = decoded.channels[0];
        
        equal(decoded.numberOfChannels, 1, "The decoded audio file's metadata should indicate that there is only one channel.");
        equal(decoded.channels.length, 1, "The decoded audio should have only one channel buffer.");
        equal(decoded.bitDepth, 16, "The decoded audio file's metadata should indicate a bith depth of 16.");
        equal(decoded.sampleRate, 44100, "The decoded audio file's metadata should indicate a sample rate of 44100 samples per second.");
        flock.test.assertNotNaN(buffer, "The buffer should not output an NaN values");
        flock.test.assertNotSilent(buffer, "The buffer should not be silent.");
        flock.test.assertUnbroken(buffer, "The buffer should not have any significant gaps in it.");
        flock.test.assertWithinRange(buffer, -1.0, 1.0, "The buffer's amplitude should be no louder than 1.0.");
        flock.test.assertContinuous(buffer, 0.1, "The buffer should be continuous.");
        
        equal(decoded.length, 41, "The decoded audio file's metadata should indicate that there is a total of 41 samples of data in the file.");
        flock.test.assertArrayEquals(buffer, expectedData, "The decoded buffer should be a single period triangle wave incrementing by 0.1");
    };
    
    var fileConfigurations = [
        {
            name: "int 16 WAV file",
            url: triangleInt16WAV
        },
        {
            name: "int 16 AIFF file",
            url: triangleInt16AIFF
        }
    ];

    var makeTester = function (config) {
        return function () {
            flock.audio.decode(config.url, testTriangleBuffer);   
        };
    }
    var i, config, tester;
    for (i = 0; i < fileConfigurations.length; i++) {
        config = fileConfigurations[i];
        tester = makeTester(config);
        test("Decode " + config.name, tester);
    }

})();
