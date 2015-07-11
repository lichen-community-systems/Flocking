/*global fluid, flock*/
(function () {
    "use strict";

    flock.init({
        bufferSize: 256
    });

    var demo = fluid.registerNamespace("demo");

    var synth = flock.synth({
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
    
    demo.audioInput = function () {
        return {
            synth: synth,
            playButton: flock.ui.enviroPlayButton("#play")
        };
    };

}());
