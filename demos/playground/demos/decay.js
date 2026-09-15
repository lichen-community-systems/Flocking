// The decay unit generator enveloping white noise,
// creating percussive sounds.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.decay",
        source: {
            ugen: "flock.ugen.impulse",
            rate: "audio",
            freq: {
                ugen: "flock.ugen.xLine",
                rate: "control",
                start: 1,
                end: 50,
                duration: 20
            },
            phase: 0.25,
            mul: 0.25
        },
        time: 0.2,
        mul: {
            ugen: "flock.ugen.whiteNoise"
        }
    }
});
