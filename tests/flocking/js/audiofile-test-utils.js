/*global fluid, flock, equal, deepEqual, start, asyncTest*/

(function () {
    "use strict";

    fluid.registerNamespace("flock.test.audioFile");

    flock.test.audioFile.roundBuffer = function (buf, digits) {
        var roundedBuf = [],
        i;

        digits = digits !== undefined ? digits : 1;

        for (i = 0; i < buf.length; i++) {
            roundedBuf[i] = parseFloat(buf[i].toFixed(digits));
        }

        return roundedBuf;
    };

    flock.test.audioFile.testTriangleBuffer = function (decoded) {
        var data = decoded.data,
            format = decoded.format,
            buffer = data.channels[0],
            roundedBuffer = flock.test.audioFile.roundBuffer(buffer, 1),
            expected = flock.test.audio.triangleData;

        equal(format.numChannels, 1,
            "The decoded audio file's metadata should indicate that there is only one channel.");
        equal(data.channels.length, 1,
            "The decoded audio should have only one channel buffer.");
        equal(format.sampleRate, 44100,
            "The decoded audio file's metadata should indicate a sample rate of 44100 samples per second.");
        flock.test.arrayNotNaN(buffer, "The buffer should not output an NaN values");
        flock.test.arrayNotSilent(buffer, "The buffer should not be silent.");
        flock.test.arrayUnbroken(buffer, "The buffer should not have any significant gaps in it.");
        flock.test.arrayWithinRange(buffer, -1.0, 1.0,
            "The buffer's amplitude should be no louder than 1.0.");

        equal(buffer.length, decoded.format.numSampleFrames,
            "The decoded audio buffer should have the same number of frames as the metadata reports.");
        deepEqual(roundedBuffer, expected,
            "The decoded buffer should be a single period triangle wave incrementing by 0.1");
    };

    flock.test.audioFile.testDecoder = function (configs) {
        var makeTester = function (config) {
            return function () {
                flock.audio.decode({
                    src: config.src,
                    decoder: config.decoder,
                    success: function (decoded) {
                        flock.test.audioFile.testTriangleBuffer(decoded);
                        start();
                    }
                });
            };
        };

        var i, config, tester;
        for (i = 0; i < configs.length; i++) {
            config = configs[i];
            tester = makeTester(config);
            asyncTest("Decode " + config.name, tester);
        }
    };

}());
