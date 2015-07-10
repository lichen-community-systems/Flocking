// Four separate channels of sound.
// This demo requires a sound interface with at least four channels,
// otherwise you'll only hear the first two.
// At the moment, Firefox and Safari don't support more than two channels, so try this with Chrome.

flock.synth({
    synthDef: [
        {
            ugen: "flock.ugen.sinOsc",
            freq: {
                ugen: "flock.ugen.xLine",
                start: 60,
                end: 90,
                duration: 120
            },
            mul: {
                ugen: "flock.ugen.sinOsc",
                freq: {
                    ugen: "flock.ugen.xLine",
                    start: 1/120,
                    end: 1/2,
                    duration: 120
                },
                mul: 0.125,
                add: 0.125
            }
        },
        {
            ugen: "flock.ugen.sinOsc",
            freq: {
                ugen: "flock.ugen.xLine",
                start: 90,
                end: 60,
                duration: 90
            },
            mul: {
                ugen: "flock.ugen.sinOsc",
                freq: {
                    ugen: "flock.ugen.lfNoise",
                    freq: {
                        ugen: "flock.ugen.xLine",
                        start: 1/240,
                        end: 1/120,
                        duration: 90
                    },
                    mul: 1/30,
                    add: 1/30
                },
                mul: 0.125,
                add: 0.125
            }
        },
        {
            ugen: "flock.ugen.sinOsc",
            freq: {
                ugen: "flock.ugen.xLine",
                start: 270,
                end: 240,
                duration: 120
            },
            mul: {
                ugen: "flock.ugen.sinOsc",
                freq: {
                    ugen: "flock.ugen.xLine",
                    start: 1/120,
                    end: 1/2,
                    duration: 120
                },
                mul: 0.125,
                add: 0.125
            }
        },
        {
            ugen: "flock.ugen.sinOsc",
            freq: {
                ugen: "flock.ugen.xLine",
                start: 210,
                end: 180,
                duration: 90
            },
            mul: {
                ugen: "flock.ugen.sinOsc",
                freq: {
                    ugen: "flock.ugen.lfNoise",
                    freq: {
                        ugen: "flock.ugen.xLine",
                        start: 1/240,
                        end: 1/120,
                        duration: 180
                    },
                    mul: 1/60,
                    add: 1/60
                },
                mul: 0.125,
                add: 0.125
            }
        }
    ]
});
