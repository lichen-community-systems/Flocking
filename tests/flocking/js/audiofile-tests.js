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

    flock.init();

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
            sampleRate: flock.enviro.shared.audioSettings.rates.audio
        }
    ]);
})();
