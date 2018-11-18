fluid.defaults("flock.synth.frameRate", {
    gradeNames: ["flock.synth.value"],

    rate: "scheduled",

    fps: 60,

    members: {
        audioSettings: {
            rates: {
                scheduled: "{that}.options.fps"
            }
        }
    }
});
