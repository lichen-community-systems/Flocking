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
        gradeNames: ["fluid.standardRelayComponent", "autoInit"],

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
                            "id": "latch",
                            "name": "Sample and hold"
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
                        }
                    ]
                },

                {
                    "name": "Synths and scheduling",
                    "options": [
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
