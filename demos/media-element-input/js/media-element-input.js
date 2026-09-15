/*
 * Flocking Media Element Input Demo
 *   Copyright 2013-2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global fluid, flock*/

(function () {
    "use strict";

    fluid.defaults("flock.demo.playableAudioElement", {
        gradeNames: "fluid.viewComponent",

        model: {
            speed: 1.0
        },

        listeners: {
            "{playButton}.events.onPlay": {
                "this": "{that}.container.0",
                method: "play"
            },

            "{playButton}.events.onPause": {
                "this": "{that}.container.0",
                method: "pause"
            }
        },

        modelListeners: {
            "speed": {
                funcName: "flock.demo.playableAudioElement.setSpeed",
                args: ["{that}.container.0", "{change}.value"]
            }
        }
    });

    flock.demo.playableAudioElement.setSpeed = function (audioEl, speed) {
        audioEl.playbackRate = speed;
    };

    fluid.defaults("flock.demo.mediaElementInput", {
        gradeNames: ["fluid.viewComponent"],

        granulatorDef: {
            ugen: "flock.ugen.granulator",
            numGrains: {
                ugen: "flock.ugen.lfNoise",
                freq: 1/5,
                mul: 50,
                add: 52,
                options: {
                    interpolation: "linear"
                }
            },
            grainDur: {
                ugen: "flock.ugen.sinOsc",
                freq: {
                    ugen: "flock.ugen.lfNoise",
                    freq: 1/2,
                    mul: 1/3,
                    add: 1/3,
                    options: {
                        interpolation: "linear"
                    }
                },
                mul: 0.1,
                add: 0.2
            },
            source: {
                ugen: "flock.ugen.mediaIn",
                options: {}
            },
            mul: 4
        },

        synthDef: {
            expander: {
                funcName: "flock.demo.mediaElementInput.granulators",
                args: ["{that}.options.granulatorDef", [
                    "{that}.dom.regular",
                    "{that}.dom.slow"
                ]]
            }
        },

        components: {
            enviro: {
                type: "flock.enviro"
            },

            regularAudio: {
                type: "flock.demo.playableAudioElement",
                container: "{that}.dom.regular",
                options: {
                    model: {
                        speed: 1.0
                    }
                }
            },

            slowAudio: {
                type: "flock.demo.playableAudioElement",
                container: "{that}.dom.slow",
                options: {
                    model: {
                        speed: 0.5
                    }
                }
            },

            playButton: {
                type: "flock.ui.enviroPlayButton",
                container: "{that}.dom.playButton",
                options: {
                    components: {
                        enviro: "{mediaElementInput}.enviro"
                    }
                }
            },

            synth: {
                type: "flock.synth",
                options: {
                    synthDef: "{mediaElementInput}.options.synthDef",
                    components: {
                        enviro: "{mediaElementInput}.enviro"
                    }
                }
            }
        },

        selectors: {
            playButton: "#play",
            regular: "#regular",
            slow: "#slow"
        }
    });

    flock.demo.mediaElementInput.granulators = function (def, elementSelectors) {
        return fluid.transform(elementSelectors, function (element) {
            var defForAudio = fluid.copy(def);
            defForAudio.source.options.element = element;
            defForAudio.id = element.selector;

            return defForAudio;
        });
    };
}());
