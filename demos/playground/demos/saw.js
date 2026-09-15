// A band-limited saw oscillator.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.saw",
        freq: 440,
        mul: 0.25
    }
});
