flock.synth({
    synthDef: {
        ugen: "flock.ugen.sin",
        freq: {
            ugen: "flock.ugen.sequencer",
            durations: [0.25, 0.25, 0.16666667, 0.16666667, 0.33, 0.25, 0.25],
            values: [1, 9/8, 4/3, 3/2, 4/3, 5/4, 1],
            mul: 440,
            loop: 1.0,
            options: {
                holdLastValue: true
            }
        },
        mul: {
            ugen: "flock.ugen.envGen",
            envelope: {
                levels: [0, 1, 0],
                times: [0.03, 0.2]
            },
            gate: {
                ugen: "flock.ugen.sequencer",
                durations: [0.25, 0.25, 0.16666667, 0.16666667, 0.33, 0.25, 0.25],
                values: [1, 1, 1, 1, 1, 1, 1],
                loop: 1.0,
                options: {
                    resetOnNext: true
                }
            }
        }
    }
});
