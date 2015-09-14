/*
 * Flocking Polyphonic Synth
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    fluid.defaults("flock.synth.polyphonic", {
        gradeNames: ["flock.synth.group"],

        maxVoices: 16,
        amplitudeNormalizer: "static", // "dynamic", "static", Function, falsey
        amplitudeKey: "env.sustain",

        // Deprecated. Will be removed in Flocking 0.3.0.
        // Use "noteChanges" instead.
        noteSpecs: "{that}.options.noteChanges",

        distributeOptions: {
            source: "{that}.options.voiceAllocatorOptions",
            target: "{that flock.synth.voiceAllocator}.options",
            removeSource: true
        },

        voiceAllocatorOptions: {
            synthDef: "{polyphonic}.options.synthDef",
            maxVoices: "{polyphonic}.options.maxVoices",
            amplitudeNormalizer: "{polyphonic}.options.amplitudeNormalizer",
            amplitudeKey: "{polyphonic}.options.amplitudeKey",

            listeners: {
                onCreateVoice: {
                    funcName: "flock.nodeList.tail",
                    args: ["{polyphonic}.nodeList", "{arguments}.0"]
                }
            }
        },

        components: {
            voiceAllocator: {
                type: "flock.synth.voiceAllocator.lazy"
            }
        },

        invokers: {
            noteChange: {
                funcName: "flock.synth.polyphonic.noteChange",
                args: [
                    "{that}",
                    "{arguments}.0", // The note event name (i.e. "on" or "off").
                    "{arguments}.1", // The voice to change.
                    "{arguments}.2" // The note change specification to apply.
                ]
            },

            createVoice: {
                func: "{voiceAllocator}.createVoice",
                args: ["{that}.options", "{that}.insert"]
            }
        },

        listeners: {
            "noteOn.handleChange": [
                {
                    funcName: "flock.synth.polyphonic.noteOn",
                    args: [
                        "{that}",
                        "{arguments}.0", // The voice name.
                        "{arguments}.1" // [optional] a change specification to apply for this note.
                    ]
                }
            ],

            "noteOff.handleChange": [
                {
                    funcName: "flock.synth.polyphonic.noteOff",
                    args: [
                        "{that}",
                        "{arguments}.0", // The voice name.
                        "{arguments}.1" // [optional] a change specification to apply for this note.
                    ]
                }
            ]
        }
    });

    flock.synth.polyphonic.noteChange = function (that, type, voice, changeSpec) {
        var changeBase = that.options.noteChanges[type];
        var mergedChange = $.extend({}, changeBase, changeSpec);
        voice.set(mergedChange);
    };

    flock.synth.polyphonic.noteOn = function (that, voiceName, changeSpec) {
        var voice = that.voiceAllocator.getFreeVoice();
        if (that.voiceAllocator.activeVoices[voiceName]) {
            that.noteOff(voiceName);
        }
        that.voiceAllocator.activeVoices[voiceName] = voice;
        that.noteChange("on", voice, changeSpec);

        return voice;
    };

    flock.synth.polyphonic.noteOff = function (that, voiceName, changeSpec) {
        var voice = that.voiceAllocator.activeVoices[voiceName];
        if (!voice) {
            return null;
        }

        that.noteChange("off", voice, changeSpec);
        delete that.voiceAllocator.activeVoices[voiceName];
        that.voiceAllocator.freeVoices.push(voice);

        return voice;
    };

    fluid.defaults("flock.synth.voiceAllocator", {
        gradeNames: ["fluid.component"],

        maxVoices: 16,
        amplitudeNormalizer: "static", // "dynamic", "static", Function, falsey
        amplitudeKey: "env.sustain",

        members: {
            activeVoices: {},
            freeVoices: []
        },

        invokers: {
            createVoice: {
                funcName: "flock.synth.voiceAllocator.createVoice",
                args: ["{that}.options", "{that}.events.onCreateVoice.fire"]
            }
        },

        events: {
            onCreateVoice: null
        }
    });


    flock.synth.voiceAllocator.createVoice = function (options, onCreateVoice) {
        var voice = flock.synth({
            synthDef: options.synthDef,
            addToEnvironment: false
        });

        var normalizer = options.amplitudeNormalizer,
            ampKey = options.amplitudeKey,
            normValue;

        if (normalizer) {
            if (typeof normalizer === "function") {
                normalizer(voice, ampKey);
            } else if (normalizer === "static") {
                normValue = 1.0 / options.maxVoices;
                voice.input(ampKey, normValue);
            }
            // TODO: Implement dynamic voice normalization.
        }

        onCreateVoice(voice);

        return voice;
    };

    fluid.defaults("flock.synth.voiceAllocator.lazy", {
        gradeNames: ["flock.synth.voiceAllocator"],

        invokers: {
            getFreeVoice: {
                funcName: "flock.synth.voiceAllocator.lazy.get",
                args: [
                    "{that}.freeVoices",
                    "{that}.activeVoices",
                    "{that}.createVoice",
                    "{that}.options.maxVoices"
                ]
            }
        }
    });

    flock.synth.voiceAllocator.lazy.get = function (freeVoices, activeVoices, createVoiceFn, maxVoices) {
        return freeVoices.length > 1 ?
            freeVoices.pop() : Object.keys(activeVoices).length > maxVoices ?
            null : createVoiceFn();
    };

    fluid.defaults("flock.synth.voiceAllocator.pool", {
        gradeNames: ["flock.synth.voiceAllocator"],

        invokers: {
            getFreeVoice: "flock.synth.voiceAllocator.pool.get({that}.freeVoices)"
        }
    });

    flock.synth.voiceAllocator.pool.get = function (freeVoices) {
        if (freeVoices.length > 0) {
            return freeVoices.pop();
        }
    };

    flock.synth.voiceAllocator.pool.allocateVoices = function (freeVoices, createVoiceFn, maxVoices) {
        for (var i = 0; i < maxVoices; i++) {
            freeVoices[i] = createVoiceFn();
        }
    };
}());
