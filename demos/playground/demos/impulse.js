// The impulse ugen's frequency controlled by a descending xLine.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.impulse",
        freq: {
            ugen: "flock.ugen.xLine",
            start: 880,
            end: 2,
            duration: 3.0
        },
        mul: 0.25
    }
});
