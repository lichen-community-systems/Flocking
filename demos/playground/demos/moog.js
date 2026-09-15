// A 24db low pass moog-style filter.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.filter.moog",
        cutoff: {
            ugen: "flock.ugen.sinOsc",
            freq: 1/4,
            mul: 5000,
            add: 7000
        },
        resonance: {
            ugen: "flock.ugen.sinOsc",
            freq: 1/2,
            mul: 1.5,
            add: 1.5
        },
        source: {
            ugen: "flock.ugen.lfSaw",
            freq: {
                ugen: "flock.ugen.sequence",
                freq: 1/2,
                loop: 1,
                values: [220, 220 * 5/4, 220, 220 * 3/2, 220 * 4/3, 220],
                options: {
                    interpolation: "linear"
                }
            }
        },
        mul: 0.5
    }
});
