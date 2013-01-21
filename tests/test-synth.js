var fluid = require("infusion"),
    flock = fluid.registerNamespace("flock");

fluid.registerNamespace("flock.demo");

flock.demo.nodeTest = function () {
    flock.init({
        workerPath: "./flocking/flocking/flocking-worker.js"
    });

    return flock.synth({
        ugen: "flock.ugen.sin",
        freq: 440,
        mul: 0.5
    });
};
