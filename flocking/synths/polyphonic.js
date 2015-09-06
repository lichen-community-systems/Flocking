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

        noteSpecs: {
            on: {
                "env.gate": 1
            },
            off: {
                "env.gate": 0
            }
        },

        components: {
            voiceAllocator: {
                type: "flock.synth.voiceAllocator.lazy",
                options: {
                    // TODO: Replace these with distributeOptions.
                    synthDef: "{polyphonic}.options.synthDef",
                    maxVoices: "{polyphonic}.options.maxVoices",
                    amplitudeNormalizer: "{polyphonic}.options.amplitudeNormalizer",
                    amplitudeKey: "{polyphonic}.options.amplitudeKey",

                    listeners: {
                        onCreateVoice: "{polyphonic}.tail({arguments}.0)"
                    }
                }
            }
        },

        invokers: {
            noteChange: {
                funcName: "flock.synth.polyphonic.noteChange",
                args: [
                    "{arguments}.0", // The voice synth to change.
                    "{arguments}.1", // The note event name (i.e. "on" or "off").
                    "{arguments}.2", // The note change spec to apply.
                    "{that}.options.noteSpecs"
                ]
            },

            noteOn: {
                funcName: "flock.synth.polyphonic.noteOn",
                args: [
                    "{arguments}.0", // Note name.
                    "{arguments}.1", // Optional changeSpec
                    "{voiceAllocator}",
                    "{that}.noteOff",
                    "{that}.noteChange"
                ]
            },

            noteOff: {
                funcName: "flock.synth.polyphonic.noteOff",
                args: [
                    "{arguments}.0", // Note name.
                    "{arguments}.1", // Optional changeSpec
                    "{voiceAllocator}",
                    "{that}.noteChange"
                ]
            },

            createVoice: {
                func: "{voiceAllocator}.createVoice",
                args: ["{that}.options", "{that}.insert"]
            }
        }
    });

    flock.synth.polyphonic.noteChange = function (voice, eventName, changeSpec, noteSpecs) {
        var noteEventSpec = noteSpecs[eventName];
        changeSpec = $.extend({}, noteEventSpec, changeSpec);
        voice.input(changeSpec);
    };

    flock.synth.polyphonic.noteOn = function (noteName, changeSpec, voiceAllocator, noteOff, noteChange) {
        var voice = voiceAllocator.getFreeVoice();
        if (voiceAllocator.activeVoices[noteName]) {
            noteOff(noteName);
        }
        voiceAllocator.activeVoices[noteName] = voice;
        noteChange(voice, "on", changeSpec);

        return voice;
    };

    flock.synth.polyphonic.noteOff = function (noteName, changeSpec, voiceAllocator, noteChange) {
        var voice = voiceAllocator.activeVoices[noteName];
        if (!voice) {
            return null;
        }
        noteChange(voice, "off", changeSpec);
        delete voiceAllocator.activeVoices[noteName];
        voiceAllocator.freeVoices.push(voice);

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


    /**
     * flock.band provides an IoC-friendly interface for a collection of named synths.
     */
    // TODO: Unit tests.
    fluid.defaults("flock.band", {
        gradeNames: ["fluid.component"],

        invokers: {
            play: {
                func: "{that}.events.onPlay.fire"
            },

            pause: {
                func: "{that}.events.onPause.fire"
            },

            set: {
                func: "{that}.events.onSet.fire"
            }
        },

        events: {
            onPlay: null,
            onPause: null,
            onSet: null
        },

        distributeOptions: [
            {
                source: "{that}.options.childListeners",
                removeSource: true,
                target: "{that fluid.component}.options.listeners"
            },
            {
                source: "{that}.options.synthListeners",
                removeSource: true,
                target: "{that flock.synth}.options.listeners"
            }
        ],

        childListeners: {
            "{band}.events.onDestroy": {
                func: "{that}.destroy"
            }
        },

        synthListeners: {
            "{band}.events.onPlay": {
                func: "{that}.play"
            },

            "{band}.events.onPause": {
                func: "{that}.pause"
            },

            "{band}.events.onSet": {
                func: "{that}.set"
            }
        }
    });
}());
