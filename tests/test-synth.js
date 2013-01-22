var fluid = require("infusion"),
    flock = fluid.registerNamespace("flock");

fluid.registerNamespace("flock.demo");

flock.demo.nodeTest = function () {
    flock.init({
        workerPath: "./flocking/flocking/flocking-worker.js",
        bufferSize: 8192,
        latency: 250
    });

    return flock.synth({
        ugen: "flock.ugen.filter.biquad.hp",
        freq: {
            ugen: "flock.ugen.sin",
            rate: "control",
            freq: {
                ugen: "flock.ugen.xLine",
                rate: "control",
                start: 0.7,
                end: 10,
                duration: 20
            },
            phase: 0,
            mul: 3600,
            add: 4000
        },
        source: {
            ugen: "flock.ugen.lfSaw",
            freq: 200,
            mul: 0.1
        }
    });
};
