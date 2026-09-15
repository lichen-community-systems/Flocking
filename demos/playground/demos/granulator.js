// Granulates a filtered sawtooth wave.
// Demo by Mayank Sanganeria and Adam Tindale.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.granulator",
        numGrains: {
            ugen: "flock.ugen.line",
            start: 1,
            end: 40,
            duration: 20
        },
        grainDur: {
            ugen: "flock.ugen.line",
            start: 0.1,
            end: 0.005,
            duration: 100
        },
        delayDur: 8,
        mul: 0.5,
        source: {
            ugen: "flock.ugen.filter.biquad.lp",
            freq: {
                ugen: "flock.ugen.sin",
                rate: "control",
                freq: {
                    ugen: "flock.ugen.xLine",
                    rate: "control",
                    start: 0.7,
                    end: 3000,
                    duration: 60
                },
                phase: 0,
                mul: 2000,
                add: 4000
            },
            source: {
                ugen: "flock.ugen.lfSaw",
                freq: {
                    ugen: "flock.ugen.sin",
                    freq: 0.1,
                    mul: 1000,
                    add: 3000,
                },
                mul: 0.25
            }
        }
    }
});
