// Creates a new synth with a sine wave that is
// slowly being amplitude moduled by another sine wave.

flock.synth({
    synthDef: {
        id: "carrier",
        ugen: "flock.ugen.sinOsc",
        freq: 440,
        mul: {
            id: "mod",
            ugen: "flock.ugen.sinOsc",
            freq: 1.0,
            mul: 0.25
        }
    }
});
