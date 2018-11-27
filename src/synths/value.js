fluid.defaults("flock.synth.value", {
    gradeNames: ["flock.synth"],

    rate: "demand",
    addToEnvironment: false,

    invokers: {
        generate: {
            funcName: "flock.evaluate.synthValue"
        }
    }
});
