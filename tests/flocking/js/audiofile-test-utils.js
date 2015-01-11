/*global fluid, flock, equal, start, asyncTest*/

(function () {
    "use strict";

    fluid.registerNamespace("flock.test.audioFile");

    flock.test.audioFile.testTriangleBuffer = function (decoded, sampleRate) {
        var data = decoded.data,
            format = decoded.format,
            buffer = data.channels[0],
            expected = flock.test.audio.triangleData;

        equal(format.numChannels, 1,
            "The decoded audio file's metadata should indicate that there is only one channel.");
        equal(data.channels.length, 1,
            "The decoded audio should have only one channel buffer.");
        equal(format.sampleRate, sampleRate,
            "The decoded audio file's metadata should indicate the correct sample rate.");
        flock.test.arrayNotNaN(buffer, "The buffer should not output an NaN values");
        flock.test.arrayNotSilent(buffer, "The buffer should not be silent.");
        flock.test.arrayUnbroken(buffer, "The buffer should not have any significant gaps in it.");
        flock.test.arrayWithinRange(buffer, -1.0, 1.0,
            "The buffer's amplitude should be no louder than 1.0.");
        equal(buffer.length, decoded.format.numSampleFrames,
            "The decoded audio buffer should have the same number of frames as the metadata reports.");

        // TODO: Create tests that will succeed at a variety of sample rates.
        // Right now the expected buffer is hardcoded for 44.1KHz
        if (sampleRate === 44100) {
            flock.test.arrayEqualBothRounded(1, buffer, expected,
                "The decoded buffer should be a single period triangle wave incrementing by 0.1.");
        }
    };

    flock.test.audioFile.testDecoder = function (configs) {
        var makeTester = function (config) {
            return function () {
                flock.audio.decode({
                    src: config.src,
                    decoder: config.decoder,
                    success: function (decoded) {
                        flock.test.audioFile.testTriangleBuffer(decoded,
                            flock.enviro.shared.audioSettings.rates.audio);
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
