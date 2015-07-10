flock.synth({
    synthDef: [
        // The left channel aliases alias at high frequencies (you'll hear it wobble).
        {
            ugen: "flock.ugen.impulse",
            freq: {
                ugen: "flock.ugen.xLine",
                start: 10000,
                end: 20,
                duration: 10
            },
            mul: 0.5
        },
        // The right channel is bandlimited, so it does not alias.
        {
            ugen: "flock.ugen.blit",
            freq: {
                ugen: "flock.ugen.xLine",
                start: 10000,
                end: 20,
                duration: 10
            },
            mul: 0.5
        }
    ]
});
