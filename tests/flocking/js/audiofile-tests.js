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
    
    module("flock.file.readDataUrl() tests");
    
    test("Read base 64 encoding in data URL", function () {
        var expectedUnencoded = window.atob(flock.test.audio.b64Int16WAVData),
            dataFormatCombinations = [
                {
                    name: "base64-encoded with a MIME type",
                    url: flock.test.audio.triangleInt16WAV
                },
                {
                    name: "not base64 encoded with a MIME type",
                    url: "data:audio/wav," + expectedUnencoded
                },
                {
                    name: "base64-encoded with no MIME type",
                    url: "data:;base64," + flock.test.audio.b64Int16WAVData
                },
                {
                    name: "not base64 encoded data URL with no MIME type",
                    url: "data:," + expectedUnencoded
                }
            ],
            i, formatSpec;
    
        for (i = 0; i < dataFormatCombinations.length; i++) {
            formatSpec = dataFormatCombinations[i];
            flock.file.readDataUrl(formatSpec.url, function (data, type) {
                flock.test.assertArrayEquals(data, flock.file.stringToBuffer(expectedUnencoded), "readDataUrl() should correctly parse and decode a data URL that is " + formatSpec.name);
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
    
    
    module("flock.audio.decode.chunked() tests");
    (function () {
        var audioFormatTestSpecs = [
            {
                name: "16 bit WAV file",
                format: "wav",
                url: flock.test.audio.triangleInt16WAV,
                decoded: {
                    container: {
                        id: "RIFF",
                        size: 118,
                        formatType: "WAVE"
                    },
                    header: {
                        id: "fmt ",
                        size: 16,
                        audioFormatType: 1,
                        numChannels: 1,
                        numSampleFrames: 41,
                        sampleRate: 44100,
                        avgBytesPerSecond: 88200,
                        blockAlign: 2,
                        bitRate: 16
                    },
                    data: {
                        id: "data",
                        size: 82
                    }
                }
            },
            {
                name: "16 bit AIFF file",
                format: "aiff",
                url: flock.test.audio.triangleInt16AIFF,
                decoded: {
                    container: {
                        id: "FORM",
                        size: 128,
                        formatType: "AIFF"
                    },
                    header: {
                        id: "COMM",
                        size: 18,
                        numChannels: 1,
                        numSampleFrames: 41,
                        bitRate: 16,
                        sampleRate: 44100.0
                    },
                    data: {
                        id: "SSND",
                        size: 82,
                        offset: 1313079296,
                        blockSize: 5898240
                    }
                }
            }
        ];

        var testAudioFileFormat = function (config) {
            test(config.name + ".", function () {
                flock.file.readDataUrl(config.url, function (dataBuffer) {
                    var expected = config.decoded,
                        actual = flock.audio.decode.chunked(dataBuffer, flock.audio.formats[config.format]);
                        
                        // Remove the sample data, since it's tested below.
                        delete actual.data.channels;
                        
                    deepEqual(actual, expected, "The decoded audio file info should contain valid container, header, and data structures.");
                });
            });
        };

        var i, spec;
        for (i = 0; i < audioFormatTestSpecs.length; i++) {
            spec = audioFormatTestSpecs[i];
            testAudioFileFormat(spec);
        }
    }());
    
    
    module("flock.audio.decode() tests");
    (function () {
        
        var testTriangleBuffer = function (decoded, expectedBitDepth, expectedDataSize) {
            var data = decoded.data,
                header = decoded.header,
                buffer = data.channels[0];

            equal(header.numChannels, 1, "The decoded audio file's metadata should indicate that there is only one channel.");
            equal(data.channels.length, 1, "The decoded audio should have only one channel buffer.");
            equal(header.bitRate, expectedBitDepth, "The decoded audio file's metadata should indicate a bith depth of " + expectedBitDepth + ".");
            equal(header.sampleRate, 44100, "The decoded audio file's metadata should indicate a sample rate of 44100 samples per second.");
            flock.test.assertNotNaN(buffer, "The buffer should not output an NaN values");
            flock.test.assertNotSilent(buffer, "The buffer should not be silent.");
            flock.test.assertUnbroken(buffer, "The buffer should not have any significant gaps in it.");
            flock.test.assertWithinRange(buffer, -1.0, 1.0, "The buffer's amplitude should be no louder than 1.0.");
            flock.test.assertContinuous(buffer, 0.1, "The buffer should be continuous.");
            
            equal(decoded.data.size, expectedDataSize, 
                "The decoded audio file's metadata should indicate that there is a total of " + expectedDataSize + " samples of data in the file.");
            flock.test.assertArrayEquals(buffer, expectedData, "The decoded buffer should be a single period triangle wave incrementing by 0.1");
        };

        var eightBitDataSize = 41;
        var fileConfigurations = [
            {
                name: "int 16 WAV file",
                bitDepth: 16,
                dataSize: eightBitDataSize * 2,
                url: flock.test.audio.triangleInt16WAV
            },
            {
                name: "int 16 AIFF file",
                bitDepth: 16,
                dataSize: eightBitDataSize * 2,
                url: flock.test.audio.triangleInt16AIFF
            },
            {
                name: "int8 AIFF file",
                bitDepth: 8,
                dataSize: eightBitDataSize,
                url: flock.test.audio.triangleInt8AIFF
            },
            {
                name: "int32 WAV file",
                bitDepth: 32,
                dataSize: eightBitDataSize * 4,
                url: flock.test.audio.triangleInt32WAV
            },
            {
                name: "int32 AIFF file",
                bitDepth: 32,
                dataSize: eightBitDataSize * 4,
                url: flock.test.audio.triangleInt32AIFF
            },
            {
                name: "float WAV file",
                bitDepth: 32,
                dataSize: eightBitDataSize * 4,
                url: flock.test.audio.triangleFloatWAV
            },
            {
                name: "float AIFF file",
                bitDepth: 32,
                dataSize: eightBitDataSize * 4,
                url: flock.test.audio.triangleFloatAIFF
            }

        ];

        var makeTester = function (config) {
            return function () {
                flock.audio.decode(config.url, function (decoded) {
                    testTriangleBuffer(decoded, config.bitDepth, config.dataSize);
                });   
            };
        };

        var i, config, tester;
        for (i = 0; i < fileConfigurations.length; i++) {
            config = fileConfigurations[i];
            tester = makeTester(config);
            test("Decode " + config.name, tester);
        }
    }()); 

})();
