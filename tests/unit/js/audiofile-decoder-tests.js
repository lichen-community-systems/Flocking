/*!
* Flocking Audio File Decoder Tests
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

    var QUnit = fluid.registerNamespace("QUnit");
    fluid.registerNamespace("flock.test");

    var module = flock.test.module({
        name: "flock.audio.decode.chunked() tests"
    });

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
        QUnit.asyncTest(config.name + ".", function () {
            flock.file.readBufferFromDataUrl({
                src: config.src,
                success: function (dataBuffer) {
                    var expected = config.decoded,
                        actual = flock.audio.decode.chunked(dataBuffer, flock.audio.formats[config.format]);

                    // Remove the sample data, since it's tested below.
                    delete actual.data.channels;

                    QUnit.deepEqual(actual, expected,
                        "The decoded audio file info should contain valid container, format, and data structures.");
                    QUnit.start();
                }
            });
        });
    };

    fluid.each(audioFormatTestSpecs, testAudioFileFormat);


    var eightBitSampleSize = 42;
    var decoderTestSpecs = [
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
        {
            name: "int32 WAV file",
            bitDepth: 32,
            dataSize: eightBitSampleSize * 4,
            src: flock.test.audio.triangleInt32WAV,
            decoder: flock.audio.decode.sync
        },
        {
            name: "int32 AIFF file",
            bitDepth: 32,
            dataSize: (eightBitSampleSize * 4) + 4 + 4,
            src: flock.test.audio.triangleInt32AIFF,
            decoder: flock.audio.decode.sync

        },
        {
            name: "float WAV file",
            bitDepth: 32,
            dataSize: eightBitSampleSize * 4,
            src: flock.test.audio.triangleFloatWAV,
            decoder: flock.audio.decode.sync
        },
        {
            name: "float AIFF file",
            bitDepth: 32,
            dataSize: (eightBitSampleSize * 4) + 4 + 4,
            src: flock.test.audio.triangleFloatAIFF,
            decoder: flock.audio.decode.sync
        }
    ];

    module = flock.test.module({
        name: "flock.audio.decode() mixed decoder tests"
    });

    flock.test.audioFile.testDecoder(decoderTestSpecs, module);

    var specifyDecoderType = function (decoderType, specs) {
        var typedSpecs = fluid.copy(specs);
        fluid.each(typedSpecs, function (spec) {
            spec.decoder = decoderType;
        });

        return typedSpecs;
    };

    module = flock.test.module({
        name: "flock.audio.decode() pure JavaScript sync decoder tests"
    });

    flock.test.audioFile.testDecoder(specifyDecoderType(flock.audio.decode.sync,
        decoderTestSpecs), module);

    // Currently, there is no asynchronous decoding on Node.js,
    // hence this test is only run if we're in a browser.
    if (flock.platform.isBrowser) {
        module = flock.test.module({
            name: "flock.audio.decode() pure JavaScript async decoder tests"
        });

        flock.test.audioFile.testDecoder(specifyDecoderType(flock.audio.decode.workerAsync,
            decoderTestSpecs), module);
    }
}());
