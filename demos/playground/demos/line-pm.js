// Line modulating the phase of a sine oscillator.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.sinOsc",
        freq: 800,
        phase: {
            ugen: "flock.ugen.sinOsc",
            freq: {
                ugen: "flock.ugen.xLine",
                rate: "control",
                start: 1,
                end: 1000,
                duration: 9
            },
            mul: flock.TWOPI
        },
        mul: 0.25
    }
});
