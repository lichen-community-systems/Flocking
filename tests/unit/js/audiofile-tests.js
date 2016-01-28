/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, test, asyncTest, ok, equal, deepEqual, start*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var environment = flock.silentEnviro();

    fluid.registerNamespace("flock.test");

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


    module("flock.audio.decode() Web Audio API decoder tests");

    var eightBitSampleSize = 42;
    flock.test.audioFile.testDecoder([
        {
            name: "int 16 WAV file",
            bitDepth: 16,
            dataSize: eightBitSampleSize * 2,
            src: flock.test.audio.triangleInt16WAV,
            sampleRate: environment.audioSystem.model.rates.audio
        }
    ]);

    module("Audio encoding");

    test("flock.audio.interleave", function () {
        var bufDesc = flock.bufferDesc.fromChannelArray([
            new Float32Array([1, 3, 5, 7, 9, 11, 13, 15]),
            new Float32Array([2, 4, 6, 8, 10, 12, 14, 16])
        ], 44100, 2);

        var interleaved = flock.audio.interleave(bufDesc);
        deepEqual(interleaved, new Float32Array([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
        ]), "The bufferDesc should have been correctly interleaved.");
    });

    flock.test.audioFile.encodeThenDecode = function (original, encodedFormat) {
        var afterRedecoded = function (redecoded) {
            deepEqual(redecoded.format, original.format,
                "The buffer's format metadata should be the same as the original.");

            flock.test.arrayEqualBothRounded(3,
                redecoded.data.channels[0],
                original.data.channels[0],
                "The channel data should be the same as the original after being decoded.");
            start();
        };

        var encoded = flock.audio.encode.wav(original, encodedFormat);
        ok(encoded instanceof ArrayBuffer, "The encoded buffer should be an array buffer");

        flock.audio.decode.webAudio({
            rawData: encoded,
            success: afterRedecoded,
            error: function (msg) {
                ok(false, "There was a decoding error while decoding the encoded buffer. " + msg);
                start();
            }
        });
    };

    flock.test.audioFile.testEncodeDecode = function (formats) {
        fluid.each(formats, function (format) {
            asyncTest("Encode in " + format + " format, then decode it again.", function () {
                flock.audio.decode({
                    src: "../../shared/audio/long-triangle-int16-44100.wav",
                    sampleRate: environment.audioSystem.model.sampleRate,
                    success: function (original) {
                        flock.test.audioFile.encodeThenDecode(original, format);
                    },
                    error: function (msg) {
                        ok(false, "There was an error while decoding the original audio file. " + msg);
                        start();
                    }
                });
            });
        });
    };

    // Only Safari seems to support decoding WAVE files at higher bit depths.
    var formats = flock.platform.browser.safari ? ["int16", "int32", "float32"] : ["int16"];
    flock.test.audioFile.testEncodeDecode(formats);
})();
