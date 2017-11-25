/*!
* Flocking Audio File Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2012-2017, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var atob = typeof (window) !== "undefined" ? window.atob : require("atob");
    var QUnit = fluid.registerNamespace("QUnit");
    var $ = fluid.registerNamespace("jQuery");

    fluid.registerNamespace("flock.test.audioFile");

    var module = flock.test.module({
        name: "flock.file.readBufferFromDataUrl() tests"
    });

    var expectedUnencoded = atob(flock.test.audio.b64Int16WAVData),
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
        QUnit.asyncTest(formatSpec.name, function () {
            flock.file.readBufferFromDataUrl({
                src: formatSpec.src,
                success: function (data) {
                    QUnit.deepEqual(
                        new Int8Array(data),
                        new Int8Array(expectedArrayBuffer),
                        "readBufferFromDataUrl() should correctly parse and decode a data URL that is " + formatSpec.name
                    );

                    QUnit.start();
                }
            });
        });
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

    var testMimeType = function (url, expectedType) {
        QUnit.asyncTest("Parse data URL with " + expectedType + " MIME type.", function () {
            flock.file.readBufferFromDataUrl({
                src: url,
                success: function (data, actualType) {
                    QUnit.equal(
                        actualType,
                        expectedType,
                        "readBufferFromDataUrl() should recognize " + url + " as a " + expectedType + " file."
                    );
                    QUnit.start();
                }
            });
        });
    };

    fluid.each(mimeTypeCombinations, function (expectedType) {
        var urls = mimeTypeCombinations[expectedType];
        fluid.each(urls, function (url) {
            testMimeType(url, expectedType);
        });
    });


    module = flock.test.module({
        name: "flock.audio.decode() Web Audio API decoder tests"
    });

    var eightBitSampleSize = 42;
    flock.test.audioFile.testDecoder([
        {
            name: "int 16 WAV file",
            bitDepth: 16,
            dataSize: eightBitSampleSize * 2,
            src: flock.test.audio.triangleInt16WAV
        }
    ], module);

    module = flock.test.module({
        name: "Audio encoding"
    });

    QUnit.test("flock.audio.interleave", function () {
        var bufDesc = flock.bufferDesc.fromChannelArray([
            new Float32Array([1, 3, 5, 7, 9, 11, 13, 15]),
            new Float32Array([2, 4, 6, 8, 10, 12, 14, 16])
        ], 44100, 2);

        var interleaved = flock.audio.interleave(bufDesc);
        QUnit.deepEqual(interleaved, new Float32Array([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
        ]), "The bufferDesc should have been correctly interleaved.");
    });

    flock.test.audioFile.drawBufferData = function (originalChannelData, redecodedChannelData) {
        var subtracted = flock.test.subtract(redecodedChannelData,
            originalChannelData, 1.0);

        var toDraw = [originalChannelData, redecodedChannelData, subtracted];

        fluid.each(toDraw, function (buffer) {
            flock.test.audioFile.drawBuffer(buffer, {
                end: 502
            });
        });
    };

    flock.test.audioFile.formatConversionExpectations = {
        int16: {},

        int32: {
            bitRate: 32,
            blockAlign: 4
        },

        float32: {
            audioFormatType: 3,
            bitRate: 32,
            blockAlign: 4,
            size: 30 // Format body size + fact chunk size + extension size.
        }
    };

    flock.test.audioFile.mergeFormatConversionExpectations = function (format, previouslyDecoded) {
        var staticFormatSpecificOverrides = flock.test.audioFile.formatConversionExpectations[format];
        var expected = $.extend({}, previouslyDecoded, staticFormatSpecificOverrides);

        if (format !== "int16") {
            expected.avgBytesPerSecond = previouslyDecoded.sampleRate * 4;
        }

        return expected;
    };

    flock.test.audioFile.compareOriginalToRedecoded = function (encodedFormat, original, redecoded) {
        var originalChannelData = original.data.channels[0],
            redecodedChannelData = redecoded.data.channels[0],
            redecodedInt16 = flock.audio.convert.floatsToInts(redecodedChannelData,
                flock.audio.convert.pcm.int16),
            originalInt16 = flock.audio.convert.floatsToInts(originalChannelData,
                flock.audio.convert.pcm.int16);

        flock.test.signalInRange(redecodedChannelData, -1.0, 1.0);

        var expectedFormat = flock.test.audioFile.mergeFormatConversionExpectations(encodedFormat,
            original.format);

        jqUnit.assertLeftHand("The buffer's format metadata should be the same as the original.",
            expectedFormat, redecoded.format);

        jqUnit.assertDeepEq(
            "The channel data should be the same as the original after being decoded.",
            originalInt16, redecodedInt16);

        if (flock.platform.isBrowser) {
            flock.test.audioFile.drawBufferData(originalChannelData, redecodedChannelData);
        }
    };

    flock.test.audioFile.sanityCheckOriginal = function (original, encoded) {
        // General sanity of the original decoded buffer and its encoding.
        flock.test.signalInRange(original.data.channels[0], -1.0, 1.0);

        QUnit.ok(encoded instanceof ArrayBuffer,
            "The encoded buffer should be an array buffer");
    };

    flock.test.audioFile.encodeThenDecode = function (encodedFormat, original) {
        var encoded = flock.audio.encode.wav(original, encodedFormat);

        flock.test.audioFile.sanityCheckOriginal(original, encoded);

        var afterRedecoded = function (redecoded) {
            flock.test.audioFile.compareOriginalToRedecoded(encodedFormat, original, redecoded);
            QUnit.start();
        };

        // TODO: Parameterize this to test all available decoding strategies on the platform.
        flock.audio.decode.sync({
            type: "wav",
            rawData: encoded,
            success: afterRedecoded,
            error: function (e) {
                QUnit.ok(false, "There was a error while decoding the encoded buffer. " + e);
                QUnit.start();
            }
        });
    };

    flock.test.audioFile.encodeDecode = function (fileName, sampleRate, decodedFormat) {
        flock.audio.registerDecoderStrategy("default", flock.audio.decode.sync);

        flock.audio.decode({
            src: flock.test.audioFilePath(fileName),
            sampleRate: sampleRate,
            success: function (original) {
                flock.test.audioFile.encodeThenDecode(decodedFormat, original);
            },
            error: function (msg) {
                QUnit.ok(false, "There was an error while decoding the original audio file. " + msg);
                QUnit.start();
            }
        });
    };

    flock.test.audioFile.testEncodeDecodeForFormat = function (format, fileSpec) {
        var testName = "Decode a " + fileSpec.sampleRate + " .wav file, " +
            "encode in " + format +
            " format at the current sample rate, then decode it again.";

        QUnit.asyncTest(testName, function () {
            var currentSampleRate = module.environment.audioSystem.model.rates.audio;

            flock.test.audioFile.encodeDecode(fileSpec.fileName,
                currentSampleRate, format);
        });
    };

    flock.test.audioFile.testEncodeDecode = function (formats) {
        fluid.each(formats, function (format) {
            fluid.each(flock.test.audioFile.triangleFiles.int16, function (fileSpec) {
                flock.test.audioFile.testEncodeDecodeForFormat(format, fileSpec);
            });
        });
    };

    flock.test.audioFile.testEncodeDecode(["int16", "int32", "float32"]);
})();
