// Random audio noise with lfNoise.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.lfNoise",
        freq: 1000,
        mul: 0.25
    }
});
