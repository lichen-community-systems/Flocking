// Sine tone shaped by a simple attack/sustain/release envelope and periodically triggered.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.sinOsc",
        freq: 440,
        mul: {
            ugen: "flock.ugen.asr",
            start: 0.0,
            attack: 0.25,
            sustain: 0.25,
            release: 1.0,
            gate: {
                ugen: "flock.ugen.impulse",
                rate: "control",
                freq: 0.75,
                phase: 1.0
            }
        }
    }
});
