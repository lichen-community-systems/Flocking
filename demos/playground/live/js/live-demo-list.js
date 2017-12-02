/*
 * Flocking Visual Playground Demos
 *   Copyright 2014-15, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion");

(function () {
    "use strict";

    fluid.defaults("flock.playground.demos.live", {
        gradeNames: ["fluid.modelComponent"],

        model: {
            groups: [
                {
                    "name": "Oscillators",
                    "options": [
                        {
                            "id": "sine",
                            "name": "Sine"
                        },
                        {
                            "id": "tri",
                            "name": "Triangle"
                        },
                        {
                            "id": "square",
                            "name": "Square"
                        },
                        {
                            "id": "saw",
                            "name": "Saw"
                        }
                    ]
                },

                {
                    "name": "Noise",
                    "options": [
                        {
                            "id": "whitenoise",
                            "name": "White noise"
                        },
                        {
                            "id": "pinknoise",
                            "name": "Pink noise"
                        },
                        {
                            "id": "dust",
                            "name": "Dust"
                        },
                        {
                            "id": "lfNoise",
                            "name": "lfNoise"
                        },
                        {
                            "id": "noise-fm",
                            "name": "lfNoise &amp; sinOsc"
                        },
                        {
                            "id": "impulse",
                            "name": "Impulse"
                        },
                        {
                            "id": "impulse-pm",
                            "name": "Impulse Phase Modulation"
                        },
                        {
                            "id": "bandlimited-impulse",
                            "name": "Bandlimited impulse"
                        }
                    ]
                },

                {
                    "name": "Synthesis Techniques",
                    "options": [
                        {
                            "id": "am",
                            "name": "Amplitude modulation"
                        },
                        {
                            "id": "fm",
                            "name": "Frequency modulation"
                        },
                        {
                            "id": "pm",
                            "name": "Phase modulation"
                        }
                    ]
                },

                {
                    "name": "Granular Synthesis",
                    "options": [
                        {
                            "id": "granulator",
                            "name": "Granulator"
                        }
                    ]
                },

                {
                    "name": "Audio Buffers",
                    "options": [
                        {
                            "id": "play-buffer",
                            "name": "Play a buffer"
                        },
                        {
                            "id": "playBuffer-trigger",
                            "name": "Trigger buffer playback"
                        },
                        {
                            "id": "readBuffer",
                            "name": "Read buffer"
                        },
                        {
                            "id": "readBuffer-phasor",
                            "name": "Read buffer with phasor"
                        },
                        {
                            "id": "audio-in",
                            "name": "Live audio input"
                        },
                        {
                            "id": "audio-in-granulated",
                            "name": "Granulated live audio"
                        }
                    ]
                },

                {
                    "name": "Filters",
                    "options": [
                        {
                            "id": "lowpass-filter",
                            "name": "Low pass filter"
                        },
                        {
                            "id": "highpass-filter",
                            "name": "High pass filter"
                        },
                        {
                            "id": "bandpass-filter",
                            "name": "Band pass filter"
                        },
                        {
                            "id": "bandreject-filter",
                            "name": "Band pass filter"
                        },
                        {
                            "id": "delay",
                            "name": "Delay"
                        },
                        {
                            "id": "latch",
                            "name": "Sample and hold"
                        },
                        {
                            "id": "moog",
                            "name": "Moog VCF"
                        }
                    ]
                },

                {
                    "name": "Envelopes",
                    "options": [
                        {
                            "id": "asr",
                            "name": "Attack/Sustain/Release"
                        },
                        {
                            "id": "adsr",
                            "name": "ADSR Envelope Generator"
                        },
                        {
                            "id": "custom-envelope",
                            "name": "Custom Envelope"
                        },
                        {
                            "id": "decay",
                            "name": "Decay"
                        },
                        {
                            "id": "glissando",
                            "name": "Glissando"
                        },
                        {
                            "id": "line-fm",
                            "name": "Frequency modulation with a line"
                        },
                        {
                            "id": "line-pm",
                            "name": "Phase modulation with a line"
                        }
                    ]
                },

                {
                    "name": "Distortion",
                    "options": [
                        {
                            "id": "dejong-distortion",
                            "name": "de Jong Waveshaping distortion"
                        },
                        {
                            "id": "tanh-distortion",
                            "name": "tanh Distortion"
                        },
                        {
                            "id": "tarrabia-dejong-distortion",
                            "name": "Tarrabia-de Jong Waveshaping distortion"

                        }
                    ]
                },

                {
                    "name": "Browser unit generators",
                    "options": [
                        {
                            "id": "scope",
                            "name": "Scope"
                        },
                        {
                            "id": "mouse-x",
                            "name": "Mouse X axis"
                        },
                        {
                            "id": "mouse-y",
                            "name": "Mouse Y axis"
                        },
                        {
                            "id": "mouse-xy",
                            "name": "Mouse X and Y axes"
                        },
                        {
                            "id": "mouse-click",
                            "name": "Mouse click"
                        }
                    ]
                },

                {
                    "name": "Multiple Channels",
                    "options": [
                        {
                            "id": "stereo",
                            "name": "Stereo"
                        },
                        {
                            "id": "quadraphonic",
                            "name": "Four channels",
                        }
                    ]
                },

                {
                    "name": "Synths and scheduling",
                    "options": [
                        {
                            "id": "band",
                            "name": "Band"
                        },
                        {
                            "id": "sequencer",
                            "name": "Sequencer"
                        },
                        {
                            "id": "sample-accurate-scheduling",
                            "name": "Sample-accurate scheduling"
                        }
                    ]
                }

            ],

            defaultOption: "granulator"
        }
    });
}());
