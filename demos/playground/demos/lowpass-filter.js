flock.synth({
    synthDef: {
        ugen: "flock.ugen.filter.biquad.lp",
        freq: {
            ugen: "flock.ugen.sin",
            rate: "control",
            freq: {
                ugen: "flock.ugen.xLine",
                rate: "control",
                start: 0.7,
                end: 300,
                duration: 20
            },
            phase: 0,
            mul: 3600,
            add: 4000
        },
        source: {
            ugen: "flock.ugen.lfSaw",
            freq: 200,
            mul: 0.1
        }
    }
});
