/*
 * Flocking Playground Demos
 *   Copyright 2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion");

(function () {
    "use strict";

    fluid.defaults("flock.playground.demos", {
        gradeNames: ["fluid.modelComponent", "fluid.eventedComponent", "autoInit"],

        model: {
            groups: [
                "{osc}.options.demos",
                "{noise}.options.demos",
                "{synthesis}.options.demos",
                "{granular}.options.demos",
                "{buffers}.options.demos",
                "{filters}.options.demos",
                "{envelopes}.options.demos",
                "{triggers}.options.demos",
                "{browser}.options.demos",
                "{multichannel}.options.demos",
                "{scheduling}.options.demos"
            ],
            defaultOption: "am"
        },

        components: {
            osc: {
                type: "flock.playground.demos.osc",
            },

            noise: {
                type: "flock.playground.demos.noise"
            },

            synthesis: {
                type: "flock.playground.demos.synthesis"
            },

            granular: {
                type: "flock.playground.demos.granular"
            },

            buffers: {
                type: "flock.playground.demos.buffers"
            },


            filters: {
                type: "flock.playground.demos.filters"
            },

            envelopes: {
                type: "flock.playground.demos.envelopes"
            },

            triggers: {
                type: "flock.playground.demos.triggers"
            },

            browser: {
                type: "flock.playground.demos.browser"
            },

            multichannel: {
                type: "flock.playground.demos.multichannel"
            },

            scheduling: {
                type: "flock.playground.demos.scheduling"
            }
        }
    });


    fluid.defaults("flock.playground.demos.osc", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Oscillators",
            options: [
                {
                    id: "sine",
                    name: "Sine"
                },
                {
                    id: "tri",
                    name: "Triangle"
                },
                {
                    id: "square",
                    name: "Square"
                },
                {
                    id: "saw",
                    name: "Saw"
                }
            ]
        }
    });

    fluid.defaults("flock.playground.demos.noise", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Noise",
            options: [
                {
                    id: "whitenoise",
                    name: "White noise"
                },
                {
                    id: "pinknoise",
                    name: "Pink noise"
                },
                {
                    id: "dust",
                    name: "Dust"
                },
                {
                    id: "lfNoise",
                    name: "lfNoise"
                },
                {
                    id: "noise-fm",
                    name: "lfNoise &amp; sinOsc"
                },
                {
                    id: "impulse",
                    name: "Impulse"
                },
                {
                    id: "impulse-pm",
                    name: "Impulse Phase Modulation"
                },
                {
                    id: "bandlimited-impulse",
                    name: "Bandlimited impulse"
                }
            ]
        }
    });

    fluid.defaults("flock.playground.demos.synthesis", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Synthesis Techniques",
            options: [
                {
                    id: "am",
                    name: "Amplitude modulation"
                },
                {
                    id: "fm",
                    name: "Frequency modulation"
                },
                {
                    id: "pm",
                    name: "Phase modulation"
                },
                {
                    id: "sum",
                    name: "Additive synthesis",
                    fileExt: "js"
                }
            ]
        }
    });

    fluid.defaults("flock.playground.demos.granular", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Granular Synthesis",
            options: [
                {
                    id: "granulator",
                    name: "Granulator"
                }
            ]
        }
    });

    fluid.defaults("flock.playground.demos.buffers", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Audio Buffers",
            options: [
                {
                    id: "play-buffer",
                    name: "Play a buffer"
                },
                {
                    id: "playbuffer-trigger",
                    name: "Trigger buffer playback"
                },
                {
                    id: "readBuffer",
                    name: "Read buffer"
                },
                {
                    id: "readBuffer-phasor",
                    name: "Read buffer with phasor"
                },
                {
                    id: "audio-in",
                    name: "Live audio input"
                },
                {
                    id: "audio-in-granulated",
                    name: "Granulated live audio"
                }
            ]
        }
    });

    fluid.defaults("flock.playground.demos.filters", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Filters",
            options: [
                {
                    id: "lowpass-filter",
                    name: "Low pass filter"
                },
                {
                    id: "highpass-filter",
                    name: "High pass filter"
                },
                {
                    id: "bandpass-filter",
                    name: "Band pass filter"
                },
                {
                    id: "bandreject-filter",
                    name: "Band pass filter"
                },
                {
                    id: "delay",
                    name: "Delay"
                },
                {
                    id: "latch",
                    name: "Sample and hold"
                },
                {
                    id: "moog",
                    name: "Moog VCF"
                }
            ]
        }
    });

    fluid.defaults("flock.playground.demos.envelopes", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Envelopes",
            options: [
                {
                    id: "asr",
                    name: "Attack/Sustain/Release"
                },
                {
                    id: "adsr",
                    name: "ADSR Envelope Generator"
                },
                {
                    id: "custom-envelope",
                    name: "Custom Envelope"
                },
                {
                    id: "for-ann-rising",
                    name: "For Ann (Rising) by James Tenney",
                    fileExt: "js"
                },
                {
                    id: "decay",
                    name: "Decay"
                },
                {
                    id: "glissando",
                    name: "Glissando"
                },
                {
                    id: "line-fm",
                    name: "Frequency modulation with a line"
                },
                {
                    id: "line-pm",
                    name: "Phase modulation with a line"
                }
            ]
        }
    });

    fluid.defaults("flock.playground.demos.triggers", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Triggers",
            options: [
                {
                    id: "trigger-callback",
                    name: "Trigger a callback",
                    fileExt: "js"
                }
            ]
        }
    });

    fluid.defaults("flock.playground.demos.browser", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Browser unit generators",
            options: [
                {
                    id: "scope",
                    name: "Scope"
                },
                {
                    id: "mouse-x",
                    name: "Mouse X axis"
                },
                {
                    id: "mouse-y",
                    name: "Mouse Y axis"
                },
                {
                    id: "mouse-xy",
                    name: "Mouse X and Y axes"
                },
                {
                    id: "mouse-click",
                    name: "Mouse click"
                }
            ]
        }
    });

    fluid.defaults("flock.playground.demos.multichannel", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Multiple Channels",
            options: [
                {
                    id: "stereo",
                    name: "Stereo"
                },
                {
                    id: "quadraphonic",
                    name: "Four channels",
                    fileExt: "js"
                }
            ]
        }
    });

    fluid.defaults("flock.playground.demos.scheduling", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Synths and scheduling",
            options: [
                {
                    id: "multiple-synths",
                    name: "Multiple synths",
                    fileExt: "js"
                },
                {
                    id: "band",
                    name: "Band"
                },
                {
                    id: "polyphonicSynth",
                    name: "Polyphonic synth",
                    fileExt: "js"
                },
                {
                    id: "declarative-scheduling",
                    name: "Declarative scheduling",
                    fileExt: "js"
                },
                {
                    id: "sample-accurate-scheduling",
                    name: "Sample-accurate scheduling"
                }
            ]
        }
    });
}());
