/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, asyncTest, equal, deepEqual, start*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";
    
    fluid.registerNamespace("flock.test");
    
    var expectedData = [
        0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
        0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1,
        0.0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0,
        -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1,
        0.0, 0.1
    ];
    
    module("flock.file.readBufferFromDataUrl() tests");
    
    (function () {
        var expectedUnencoded = window.atob(flock.test.audio.b64Int16WAVData),
            expectedArrayBuffer = flock.file.stringToBuffer(expectedUnencoded),
            dataFormatCombinations = [
                {
                    name: "Read a base64-encoded data URL with a MIME type",
                    src: flock.test.audio.triangleInt16WAV
                },
                {
                    name: "Read a non-base64 data URL with a MIME type",
                    src: "data:audio/wav," + expectedUnencoded
                },
                {
                    name: "Read a base64-encoded with no MIME type",
                    src: "data:;base64," + flock.test.audio.b64Int16WAVData
                },
                {
                    name: "Read a non-base64 data URL with no MIME type",
                    src: "data:," + expectedUnencoded
                }
            ];
    
        fluid.each(dataFormatCombinations, function (formatSpec) {
            asyncTest(formatSpec.name, function () {
                flock.file.readBufferFromDataUrl({
                    src: formatSpec.src,
                    success: function (data) {
                        deepEqual(
                            new Int8Array(data), 
                            new Int8Array(expectedArrayBuffer), 
                            "readBufferFromDataUrl() should correctly parse and decode a data URL that is " + formatSpec.name
                        );
                    
                        start();
                    }
                });
            });
        });
    })();

    (function () {
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
        
        var testMimeType = function (url, expectedType) {
            asyncTest("Parse data URL with " + expectedType + " MIME type.", function () {
                flock.file.readBufferFromDataUrl({
                    src: url, 
                    success: function (data, actualType) {
                        equal(
                            actualType, 
                            expectedType, 
                            "readBufferFromDataUrl() should recognize " + url + " as a " + expectedType + " file."
                        );
                        start();
                    }
                });
            });
        };
    
        var expectedType, urls, i, url;
        for (expectedType in mimeTypeCombinations) {
            urls = mimeTypeCombinations[expectedType];
            for (i = 0; i < urls.length; i++) {
                url = urls[i];
                testMimeType(url, expectedType);
            }
        }
    })();
    

    module("flock.audio.decode.chunked() tests");
    
    (function () {
        var audioFormatTestSpecs = [
            {
                name: "16 bit WAV file",
                format: "wav",
                src: flock.test.audio.triangleInt16WAV,
                decoded: {
                    container: {
                        id: "RIFF",
                        size: 120,
                        formatType: "WAVE"
                    },
                    format: {
                        id: "fmt ",
                        size: 16,
                        audioFormatType: 1,
                        numChannels: 1,
                        numSampleFrames: 42,
                        sampleRate: 44100,
                        avgBytesPerSecond: 88200,
                        blockAlign: 2,
                        duration: 0.0009523809523809524,
                        bitRate: 16
                    },
                    data: {
                        id: "data",
                        size: 84
                    }
                }
            },
            {
                name: "16 bit AIFF file",
                format: "aiff",
                src: flock.test.audio.triangleInt16AIFF,
                decoded: {
                    container: {
                        id: "FORM",
                        size: 130,
                        formatType: "AIFF"
                    },
                    format: {
                        id: "COMM",
                        size: 18,
                        numChannels: 1,
                        numSampleFrames: 42,
                        bitRate: 16,
                        duration: 0.0009523809523809524,
                        sampleRate: 44100.0
                    },
                    data: {
                        id: "SSND",
                        size: 92,
                        offset: 0,
                        blockSize: 0
                    }
                }
            }
        ];

        var testAudioFileFormat = function (config) {
            asyncTest(config.name + ".", function () {
                flock.file.readBufferFromDataUrl({
                    src: config.src, 
                    success: function (dataBuffer) {
                        var expected = config.decoded,
                            actual = flock.audio.decode.chunked(dataBuffer, flock.audio.formats[config.format]);
                        
                        // Remove the sample data, since it's tested below.
                        delete actual.data.channels;
                        
                        deepEqual(
                            actual, 
                            expected, 
                            "The decoded audio file info should contain valid container, format, and data structures."
                        );
                        start();
                    }
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
        var roundBuffer = function (buf, digits) {
            var roundedBuf = [],
                i;
            
            digits = digits !== undefined ? digits : 1;
            
            for (i = 0; i < buf.length; i++) {
                roundedBuf[i] = parseFloat(buf[i].toFixed(digits));
            }
            
            return roundedBuf;
        };
        
        var testTriangleBuffer = function (decoded, expectedBitDepth, expectedDataSize) {
            var data = decoded.data,
                format = decoded.format,
                buffer = data.channels[0],
                roundedBuffer = roundBuffer(buffer, 1),
                expected = expectedData;

            equal(format.numChannels, 1, "The decoded audio file's metadata should indicate that there is only one channel.");
            equal(data.channels.length, 1, "The decoded audio should have only one channel buffer.");
            equal(format.bitRate, expectedBitDepth, "The decoded audio file's metadata should indicate a bith depth of " + expectedBitDepth + ".");
            equal(format.sampleRate, 44100, "The decoded audio file's metadata should indicate a sample rate of 44100 samples per second.");
            flock.test.arrayNotNaN(buffer, "The buffer should not output an NaN values");
            flock.test.arrayNotSilent(buffer, "The buffer should not be silent.");
            flock.test.arrayUnbroken(buffer, "The buffer should not have any significant gaps in it.");
            flock.test.arrayWithinRange(buffer, -1.0, 1.0, "The buffer's amplitude should be no louder than 1.0.");
            
            equal(decoded.data.size, expectedDataSize, 
                "The decoded audio file's metadata should indicate that there is a total of " + expectedDataSize + " samples of data in the file.");
            equal(buffer.length, decoded.format.numSampleFrames,
                "The decoded audio buffer should have the same number of frames as the metadata reports.");
            deepEqual(roundedBuffer, expected, "The decoded buffer should be a single period triangle wave incrementing by 0.1");
        };

        var eightBitSampleSize = 42;
        var fileConfigurations = [
            {
                name: "int 16 WAV file",
                bitDepth: 16,
                dataSize: eightBitSampleSize * 2,
                src: flock.test.audio.triangleInt16WAV
            },
            {
                name: "int 16 AIFF file",
                bitDepth: 16,
                dataSize: (eightBitSampleSize * 2) + 4 + 4, // 42 samples in 16 bit representation plus 4 bytes for offset and 4 for blockSize
                src: flock.test.audio.triangleInt16AIFF
            },
            {
                name: "int8 AIFF file",
                bitDepth: 8,
                dataSize: eightBitSampleSize + 4 + 4,
                src: flock.test.audio.triangleInt8AIFF
            },
            // No 32-bit support yet.
            {
                name: "int32 WAV file",
                bitDepth: 32,
                dataSize: eightBitSampleSize * 4,
                src: flock.test.audio.triangleInt32WAV
            },
            {
                name: "int32 AIFF file",
                bitDepth: 32,
                dataSize: (eightBitSampleSize * 4) + 4 + 4,
                src: flock.test.audio.triangleInt32AIFF
            },
            {
                name: "float WAV file",
                bitDepth: 32,
                dataSize: eightBitSampleSize * 4,
                src: flock.test.audio.triangleFloatWAV
            },
            {
                name: "float AIFF file",
                bitDepth: 32,
                dataSize: (eightBitSampleSize * 4) + 4 + 4,
                src: flock.test.audio.triangleFloatAIFF
            }
        ];

        var makeTester = function (config) {
            return function () {
                flock.audio.decode({
                    src: config.src, 
                    success: function (decoded) {
                        testTriangleBuffer(decoded, config.bitDepth, config.dataSize);
                        start();
                    }
                });   
            };
        };

        var i, config, tester;
        for (i = 0; i < fileConfigurations.length; i++) {
            config = fileConfigurations[i];
            tester = makeTester(config);
            asyncTest("Decode " + config.name, tester);
        }
    }());
})();
