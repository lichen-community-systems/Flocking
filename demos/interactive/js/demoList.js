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
                "{granular}.options.demos",
                "{browser}.options.demos"
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

            granular: {
                type: "flock.playground.demos.granular"
            },

            browser: {
                type: "flock.playground.demos.browser"
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
                },
                {
                    id: "stereo",
                    name: "Stereo"
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
                }
            ]
        }
    });

    fluid.defaults("flock.playground.demos.granular", {
        gradeNames: ["fluid.littleComponent", "autoInit"],

        demos: {
            name: "Granular synthesis",
            options: [
                {
                    id: "granulator",
                    name: "Granulator"
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
                }
            ]
        }
    });
        /*<optgroup label="Simple Waveforms">
            <option value="simple_sin">Sine</option>
            <option value="simple_triangle">Triangle</option>
            <option value="simple_square">Square</option>
            <option value="simple_saw">Saw</option>
            <option value="stereo">Stereo</option>
        </optgroup>
        <optgroup label="Noise">
            <option value="noise_white">White noise</option>
            <option value="noise_pink">Pink noise</option>
            <option value="noise_dust">Dust</option>
            <option value="noise_lf">LFNoise</option>
            <option value="noise_sin">LFNoise &amp; SinOsc</option>
            <option value="noise_impulse">Impulse</option>
            <option value="impulse_phase">Impulse Phase Modulation</option>
        </optgroup>
        <optgroup label="Synthesis Techniques">
            <option value="amp_mod" selected="selected">Amplitude modulation</option>
            <option value="freq_mod">Frequency modulation</option>
            <option value="phase_mod">Phase modulation</option>
            <option value="sum">Additive Synthesis</option>
        </optgroup>
        <optgroup label="Granular Synthesis">
            <option value="granulator">Granulator</option>
        </optgroup>
        <optgroup label="Audio Buffers">
            <option value="playBuffer">Play a buffer</option>
            <option value="playBufferTrigger">Trigger buffer playback</option>
            <option value="readBuffer">Read buffer</option>
            <option value="readBufferPhasor">Read buffer with phasor</option>
        </optgroup>
        <optgroup label="Filters">
            <option value="lowpass">Low pass filter</option>
            <option value="highpass">High pass filter</option>
            <option value="bandpass">Band pass filter</option>
            <option value="bandreject">Band reject filter</option>
            <option value="delay">Delay</option>
            <option value="latch">Sample and Hold</option>
        </optgroup>
        <optgroup label="Envelopes">
            <option value="simpleASR">Simple Attack/Sustain/Release</option>
            <option value="decay">Decay</option>
            <option value="line_freq">SinOsc Freq</option>
            <option value="line_mod">Mod SinOsc Freq</option>
            <option value="line_phase">SinOsc Phase</option>
        </optgroup>
        <optgroup label="DOM UGens">
            <option value="scope">Scope</option>
            <option value="mouse_x">Mouse X</option>
            <option value="mouse_y">Mouse Y</option>
            <option value="mouse_xy">Mouse X &amp; Y</option>
            <option value="mouse_click">Mouse click</option>
        </optgroup>
        <optgroup label="Synths and Scheduling">
            <option value="multipleSynths">Multiple Synths</option>
            <option value="polyphonicSynth">Polyphonic Synth</option>
            <option value="declarativeScheduling">Declarative Scheduling</option>
        </optgroup>*/
}());
