// An descending glissando using a line ugen.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.sinOsc",
        freq: {
            ugen: "flock.ugen.xLine",
            rate: "control",
            duration: 1.0,
            start: 2000,
            end: 200
        },
        mul: 0.25
    }
});
