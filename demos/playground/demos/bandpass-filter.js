flock.synth({
    synthDef: {
        ugen: "flock.ugen.filter.biquad.bp",
        freq: {
            ugen: "flock.ugen.mouse.cursor",
            options: {
                interpolation: "exponential"
            },
            mul: 10000,
            add: 100,
            lag: 1
        },
        q: 3.0,
        source: {
            ugen: "flock.ugen.lfSaw",
            freq: 200,
            mul: 0.1
        }
    }
});
