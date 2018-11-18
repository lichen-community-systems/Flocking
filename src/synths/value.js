fluid.defaults("flock.synth.value", {
    gradeNames: ["flock.synth"],

    rate: "demand",

    addToEnvironment: false,

    invokers: {
        value: {
            funcName: "flock.evaluate.synthValue",
            args: ["{that}"]
        }
    }
});
