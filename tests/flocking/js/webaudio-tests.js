/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global fluid, flock, module, test, asyncTest, $, start, equal, ok*/

(function () {

    "use strict";

    fluid.registerNamespace("flock.test.webaudio");

    flock.test.webaudio.triangleInt16WAVFile = "../../shared/audio/long-triangle-int16.wav";

    flock.test.webaudio.trimArray = function (numLeadingZeros, actual, expected) {
        var start = -1;

        for (var i = 0; i < actual.length; i++) {
            if (actual[i] > 0) {
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
            flock.init({
                numInputBuses: 4
            });

            flock.enviro.shared.audioStrategy.nativeNodeManager.insertOutput({
                node: "Gain",
                params: {
                    gain: 0.0
                }
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
                bus: flock.enviro.shared.audioSettings.chans,
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
        $(audioEl).one("canplay", function () {
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
        var nodeManager = flock.enviro.shared.audioStrategy.nativeNodeManager;

        equal(nodeManager.inputNodes.length, 0,
            "Prior to creating any input nodes, there shouldn't be any in the environment.");

        var audioEl = flock.test.createAudioElement(flock.test.webaudio.triangleInt16WAVFile, true, false);
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

    // TODO: Remove this warning when Safari fixes its MediaElementAudioSourceNode implementation.
    if (!flock.platform.browser.safari) {
        asyncTest("Reading input samples.", function () {
            var audioEl = flock.test.createAudioElement(flock.test.webaudio.triangleInt16WAVFile, true, false),
                synth = flock.test.createRecordingMediaSynth(audioEl);

            flock.test.recordAndTest(audioEl, synth, 1.0, function () {
                var actual = synth.get("recorder").recordBuffer,
                    // Note: This trimming silliness appears to be necessary
                    // on Firefox due to the fact that there is a delay before the audio file
                    // actually starts being output to Flocking's input buses.
                    // On Chrome, the audio plays immediately.
                    actualTrimmed = flock.test.webaudio.trimArray(1, actual, flock.test.audio.triangleData);

                flock.test.arrayEqualBothRounded(4, actualTrimmed, flock.test.audio.triangleData,
                    "The audio element's data should have been read.");
            });
        });
    }

}());
