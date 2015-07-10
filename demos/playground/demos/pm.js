// Phase modulation with sine waves.
// Demo courtesty of Adam Tindale (http://www.adamtindale.com/).

flock.synth({
    synthDef: {
        id: "carrier",
        ugen: "flock.ugen.sinOsc",
        freq: 440,
        phase: {
            id: "mod",
            ugen: "flock.ugen.sinOsc",
            freq: 34.0,
            mul: {
                ugen: "flock.ugen.sinOsc",
                freq: 1/20,
                mul: flock.PI
            },
            add: flock.PI
        },
        mul: 0.25
    }
});
