/*!
* Flocking Audio File Test Utilities
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

    fluid.registerNamespace("flock.test.audioFile");

    var $ = fluid.registerNamespace("jQuery");
    var QUnit = fluid.registerNamespace("QUnit");

    flock.test.audioFile.triangleFiles = {
        int16: [
            {
                sampleRate: 44100,
                fileName: "long-triangle-int16-44100.wav"
            },
            {
                sampleRate: 48000,
                fileName: "long-triangle-int16-48000.wav"
            },
            {
                sampleRate: 88200,
                fileName: "long-triangle-int16-88200.wav"
            },
            {
                sampleRate: 96000,
                fileName: "long-triangle-int16-96000.wav"
            }
        ]
    };

    flock.test.audioFile.testTriangleBuffer = function (decoded, sampleRate) {
        var data = decoded.data,
            format = decoded.format,
            buffer = data.channels[0],
            expected = flock.test.audio.triangleData;

        QUnit.equal(format.numChannels, 1,
            "The decoded audio file's metadata should indicate that there is only one channel.");
        QUnit.equal(data.channels.length, 1,
            "The decoded audio should have only one channel buffer.");
        QUnit.equal(format.sampleRate, sampleRate,
            "The decoded audio file's metadata should indicate the correct sample rate.");
        flock.test.arrayNotNaN(buffer, "The buffer should not output an NaN values");
        flock.test.arrayNotSilent(buffer, "The buffer should not be silent.");
        flock.test.arrayUnbroken(buffer, "The buffer should not have any significant gaps in it.");
        flock.test.arrayWithinRange(buffer, -1.0, 1.0,
            "The buffer's amplitude should be no louder than 1.0.");
        QUnit.equal(buffer.length, decoded.format.numSampleFrames,
            "The decoded audio buffer should have the same number of frames as the metadata reports.");

        // TODO: Create tests that will succeed at a variety of sample rates.
        // Right now the expected buffer is hardcoded for 44.1KHz
        if (sampleRate === 44100) {
            flock.test.arrayEqualBothRounded(1, buffer, expected,
                "The decoded buffer should be a single period triangle wave incrementing by 0.1.");
        }
    };

    flock.test.audioFile.testDecoderConfig = function (config, module) {
        QUnit.asyncTest("Decode " + config.name, function () {
            flock.audio.decode({
                src: config.src,
                sampleRate: module.environment.audioSystem.model.rates.audio,
                decoder: config.decoder,
                success: function (decoded) {
                    flock.test.audioFile.testTriangleBuffer(decoded,
                        module.environment.audioSystem.model.rates.audio);
                    QUnit.start();
                }
            });
        });
    };

    flock.test.audioFile.testDecoder = function (configs, module) {
        fluid.each(configs, function (config) {
            flock.test.audioFile.testDecoderConfig(config, module);
        });
    };

    flock.test.audioFile.drawBuffer = function (buffer, options) {
        options = options || {};
        options.start = options.start || 0;
        options.end = options.end || buffer.length;

        var bufferDisplayRegion = buffer.subarray(options.start, options.end);
        var container = options.container ? $(options.container) : $("body");

        var canvas = flock.view.drawBuffer(bufferDisplayRegion, {
            height: options.height,
            width: options.width || container.width()
        });

        return container.append(canvas);
    };
}());
