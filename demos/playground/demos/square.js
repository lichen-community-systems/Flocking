// A band-limited square wave oscillator.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.square",
        freq: 440,
        mul: 0.25
    }
});
