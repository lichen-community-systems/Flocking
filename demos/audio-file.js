var fluid = require("infusion"),
    loader = fluid.getLoader(__dirname);

loader.require("../flocking/third-party/polydataview/js/polydataview.js");
loader.require("../flocking/flocking/flocking-core.js");
loader.require("../flocking/flocking/flocking-audiofile.js");
loader.require("../flocking/flocking/flocking-scheduler.js");
loader.require("../flocking-node.js");
loader.require("../flocking/flocking/flocking-parser.js");
loader.require("../flocking/flocking/flocking-ugens.js");

flock = fluid.registerNamespace("flock");

var synth = flock.synth({
    synthDef: {
        ugen: "flock.ugen.playBuffer",
        buffer: {
            id: "hillier-first-chord",
            url: "demos/audio/hillier-first-chord.wav"
        },
        loop: 1,
        speed: {
            ugen: "flock.ugen.lfNoise",
            freq: 2.5,
            mul: {
                ugen: "flock.ugen.math",
                source: 1,
                div: {
                    ugen: "flock.ugen.bufferDuration",
                    buffer: {
                        id: "hillier-first-chord"
                    }
                }
            },
            add: 1.0,
            options: {
                interpolation: "linear"
            }
        }
    }
});

synth.play();
