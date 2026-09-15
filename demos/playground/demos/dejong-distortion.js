flock.synth({
    synthDef: {
        ugen: "flock.ugen.distortion.deJong",
        amount: {
            ugen: "flock.ugen.sin",
            mul: 99,
            add: 100,
            freq: 0.1
        },
        source: {
            ugen: "flock.ugen.sawOsc",
            freq: 45,
            mul: 0.01
        }
    }
});
