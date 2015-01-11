/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global fluid, flock, module, test, asyncTest, $, start, equal, ok, deepEqual*/

(function () {

    "use strict";

    fluid.registerNamespace("flock.test.webaudio");

    flock.test.webaudio.testFilePathPrefix = "../../shared/audio/long-triangle-int16-";
    flock.test.webaudio.testFilePathSuffix = ".wav";
    flock.test.webaudio.getTestFilePath = function (sampleRate) {
        // Random query parameter works around second-rate web servers
        // such as node-static, which seem unable to consistently deliver
        // non-cached content.
        var random = String(Math.random() + Math.random());
        return flock.test.webaudio.testFilePathPrefix + sampleRate +
            flock.test.webaudio.testFilePathSuffix + "?foilCache=" + random;
    };

    flock.test.webaudio.trimArray = function (numLeadingZeros, actual, expected) {
        var start = -1;

        for (var i = 0; i < actual.length; i++) {
            if (actual[i] !== 0) {
                start = i - numLeadingZeros;
                break;
            }
        }

        if (start < 0) {
            return undefined;
        }

        return actual.subarray(start, start + expected.length);
    };

    module("flock.ugen.mediaIn", {
        setup: function () {
            var enviro = flock.init({
                numInputBuses: 4
            });

            enviro.audioStrategy.nativeNodeManager.createOutputNode("Gain", undefined, {
                gain: 0.0
            });
        }
    });

    flock.test.createAudioElement = function (src, loop, autoplay) {
        loop = typeof loop !== "boolean" ? false : loop;
        autoplay = typeof autoplay !== "boolean" ? false : autoplay;

        var jAudioEl = $("<audio src='" + src + "' loop=" + loop + " controls='true'></audio>");

        return jAudioEl[0];
    };

    flock.test.createRecordingMediaSynth = function (audioEl, synthDefOverrides) {
        var synthDef = {
            id: "recorder",
            ugen: "flock.test.ugen.record",
            source: {
                ugen: "flock.ugen.mediaIn",
                options: {
                    element: audioEl
                }
            },
            options: {
                maxDuration: 1
            }
        };

        return flock.synth({
            synthDef: $.extend(true, synthDef, synthDefOverrides),
            addToEnvironment: false
        });
    };

    flock.test.runWhenAudioReady = function (audioEl, testFn) {
        $(audioEl).one("canplaythrough", function () {
            testFn(audioEl);
        });
    };

    flock.test.recordAndTest = function (audioEl, synth, duration, testFn) {
        flock.test.runWhenAudioReady(audioEl, function () {
            audioEl.play();
            synth.play();

            flock.enviro.shared.asyncScheduler.once(duration, function () {
                audioEl.pause();
                synth.pause();

                testFn(audioEl, synth);
                start();
            });
        });
    };

    test("Web Audio input node is created.", function () {
        var audioStrategy = flock.enviro.shared.audioStrategy,
            nodeManager = audioStrategy.nativeNodeManager;

        equal(nodeManager.inputNodes.length, 0,
            "Prior to creating any input nodes, there shouldn't be any in the environment.");

        var testFilePath = flock.test.webaudio.getTestFilePath(audioStrategy.context.sampleRate),
            audioEl = flock.test.createAudioElement(testFilePath, true, false);

        flock.test.createRecordingMediaSynth(audioEl);

        var mediaElementNode = nodeManager.inputNodes[0];
        equal(nodeManager.inputNodes.length, 1,
            "After to creating a MediaIn unit generator, there should be one input node.");

        // WebKit implementations store a reference to the audio element itself.
        // NOTE: This property isn't in the spec, and could change at any time,
        // however the extra assurance this test provides makes it worth the potential brittleness.
        if (flock.browser.webkit) {
            equal(mediaElementNode.mediaElement, audioEl,
                "The MediaElementSourceNode should have been initialized with the audio element.");
        }
    });

    test("Create more input nodes than the configured maxium", function () {
        function createMediaInDef (id) {
            var def = {
                ugen: "flock.ugen.mediaIn",
                options: {
                    element: $("#audio-" + id)[0]
                }
            };

            return def;
        }

        function createMediaInDefs (numDefs) {
            var defs = [];
            for (var i = 0; i < numDefs; i++) {
                defs.push(createMediaInDef(i + 1));
            }
            return defs;
        }

        var defs = createMediaInDefs(5);
        try {
            flock.synth({
                synthDef: {
                    ugen: "flock.ugen.sum",
                    sources: defs
                }
            });

            ok(false, "An error should have been raised when too many inputs were created.");
        } catch (e) {
            ok(e.message.indexOf("too many input nodes") > 0,
                "An error was raised when too many inputs were created.");
        }
    });

    test("Audio settings are correctly pushed from the Web Audio context.", function () {
        var enviro = flock.init({
            chans: flock.ALL_CHANNELS,
            sampleRate: 192000
        });

        equal(enviro.audioSettings.rates.audio, enviro.audioStrategy.context.sampleRate,
            "The correct sample rate was pushed.");

        var synth = flock.synth({
            synthDef: {
                id: "sine",
                ugen: "flock.ugen.sinOsc"
            },
            addToEnvironment: false
        });

        equal(synth.audioSettings.rates.audio, enviro.audioStrategy.context.sampleRate,
            "And newly instantiated synths receive the correct sample rate.");

        equal(synth.get("sine").model.sampleRate, enviro.audioStrategy.context.sampleRate,
            "Unit generators also receive the correct sample rate.");
    });

    flock.test.webaudio.runMediaElementSourceNodeTest = function (expectedBuffer) {
        var sampleRate = flock.enviro.shared.audioStrategy.context.sampleRate,
            testFilePath = flock.test.webaudio.getTestFilePath(sampleRate),
            audioEl = flock.test.createAudioElement(testFilePath, true, false),
            synth = flock.test.createRecordingMediaSynth(audioEl);

        flock.test.recordAndTest(audioEl, synth, 1.0, function () {
            var actual = synth.get("recorder").recordBuffer,
                expected = expectedBuffer.data.channels[0];

            // Note: This trimming silliness appears to be necessary
            // on Firefox due to the fact that there is a delay before the audio file
            // actually starts being output to Flocking's input buses.
            // On Chrome, the audio plays immediately.
            if (flock.platform.browser.mozilla) {
                actual = flock.test.webaudio.trimArray(0, actual, expected);
            }

            var actualShort = actual.subarray(0, 128),
                expectedShort = expected.subarray(0, 128);

            flock.test.arrayNotNaN(actualShort);
            flock.test.arrayNotSilent(actualShort);
            flock.test.arrayUnbroken(actualShort);
            flock.test.arrayWithinRange(actualShort, -1, 1);

            if (!flock.platform.browser.mozilla) {
                // Firefox obviously uses two different strategies for decoding
                // audio between the <audio> tag and audioContext.decodeAudioBuffer().
                // As a result, this test is too brittle to run in Firefox.
                deepEqual(actualShort, expectedShort,
                    "The audio element's data should have been read. Note: this test may fail " +
                    "if run on a device running at a sample rate other than 44.1, 48, 82.2 or 96 KHz.");
            }
        });
    };

    // TODO: Remove this warning when Safari fixes its MediaElementAudioSourceNode implementation.
    if (!flock.platform.browser.safari) {
        flock.init();

        var sampleRate = flock.enviro.shared.audioStrategy.context.sampleRate,
            testFilePath = flock.test.webaudio.getTestFilePath(sampleRate);

        asyncTest("Reading input samples.", function () {
            flock.audio.decode({
                src: testFilePath,
                success: flock.test.webaudio.runMediaElementSourceNodeTest,
                error: function (msg) {
                    ok(false, msg);
                    start();
                }
            });
        });
    }

}());
