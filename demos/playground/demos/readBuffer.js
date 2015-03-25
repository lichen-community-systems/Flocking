// Modulates the playback rate of a sound file with a sine wave oscillator.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.readBuffer",
        buffer: {
            id: "chord",
            url: "../shared/audio/hillier-first-chord.wav"
        },
        phase: {
            ugen: "flock.ugen.sin",
            freq: 1/5,
            mul: 0.5,
            add: 0.5
        }
    }
});
