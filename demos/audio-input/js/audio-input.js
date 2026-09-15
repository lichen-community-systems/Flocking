/*global fluid*/
(function () {
    "use strict";

    fluid.defaults("flock.demo.audioInSynth", {
        gradeNames: "flock.synth",

        synthDef: {
            ugen: "flock.ugen.audioIn",
            mul: {
                ugen: "flock.ugen.sinOsc",
                freq: {
                    ugen: "flock.ugen.mouse.cursor",
                    add: 60,
                    mul: 960
                },
                mul: {
                    ugen: "flock.ugen.mouse.cursor",
                    add: 0.1,
                    mul: 0.9,
                    options: {
                        axis: "y"
                    }
                }
            }
        }
    });

    fluid.defaults("flock.demo.audioIn", {
        gradeNames: "fluid.component",

        components: {
            synth: {
                type: "flock.demo.audioInSynth"
            },

            playButton: {
                type: "flock.ui.enviroPlayButton",
                container: "#play"
            }
        }
    });
}());
