// A band-limited triangle oscillator.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.tri",
        freq: 440,
        mul: 0.25
    }
});
