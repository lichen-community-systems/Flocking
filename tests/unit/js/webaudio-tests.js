/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery"),
        QUnit = fluid.registerNamespace("QUnit");

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

    var environment;
    QUnit.module("flock.ugen.mediaIn", {
        setup: function () {
            environment = flock.init({
                numInputBuses: 4
            });

            environment.audioSystem.nativeNodeManager.createOutputNode({
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

            environment.asyncScheduler.once(duration, function () {
                audioEl.pause();
                synth.pause();

                testFn(audioEl, synth);
                QUnit.start();
            });
        });
    };

    QUnit.test("Web Audio input node is created.", function () {
        var audioSystem = environment.audioSystem,
            nodeManager = audioSystem.nativeNodeManager;

        QUnit.equal(nodeManager.inputNodes.length, 0,
            "Prior to creating any input nodes, there shouldn't be any in the environment.");

        var testFilePath = flock.test.webaudio.getTestFilePath(audioSystem.context.sampleRate),
            audioEl = flock.test.createAudioElement(testFilePath, true, false);

        flock.test.createRecordingMediaSynth(audioEl);

        var mediaElementNode = nodeManager.inputNodes[0];
        QUnit.equal(nodeManager.inputNodes.length, 1,
            "After to creating a MediaIn unit generator, there should be one input node.");

        // WebKit implementations store a reference to the audio element itself.
        // NOTE: This property isn't in the spec, and could change at any time,
        // however the extra assurance this test provides makes it worth the potential brittleness.
        if (flock.browser.webkit) {
            QUnit.equal(mediaElementNode.mediaElement, audioEl,
                "The MediaElementSourceNode should have been initialized with the audio element.");
        }
    });

    QUnit.test("Create more input nodes than the configured maxium", function () {
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

            QUnit.ok(false, "An error should have been raised when too many inputs were created.");
        } catch (e) {
            QUnit.ok(e.message.indexOf("too many input nodes") > 0,
                "An error was raised when too many inputs were created.");
        }
    });

    QUnit.test("Audio settings are correctly pushed from the Web Audio context.", function () {
        var environment = flock.init({
            chans: flock.ALL_CHANNELS,
            sampleRate: 192000
        });

        QUnit.equal(environment.audioSystem.model.rates.audio,
            environment.audioSystem.context.sampleRate,
            "The correct sample rate was pushed.");

        var synth = flock.synth({
            synthDef: {
                id: "sine",
                ugen: "flock.ugen.sinOsc"
            },
            addToEnvironment: false
        });

        QUnit.equal(synth.audioSettings.rates.audio,
            environment.audioSystem.context.sampleRate,
            "And newly instantiated synths receive the correct sample rate.");

        QUnit.equal(synth.get("sine").model.sampleRate,
            environment.audioSystem.context.sampleRate,
            "Unit generators also receive the correct sample rate.");
    });

}());
