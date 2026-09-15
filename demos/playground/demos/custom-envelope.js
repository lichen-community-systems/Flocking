var customEnvelope = {
    levels: [0, 1, 0.4, 1.0, 0.6, 0],
    times: [0.5, 0.3, 0.5, 0.3, 0.5],
    curve: ["sin", "exponential", "linear", "welsh", 3]
};

var gateDef = {
    ugen: "flock.ugen.lfPulse",
    rate: "control",
    freq: 0.39,
    width: 0.5
};

flock.synth({
    synthDef: {
        ugen: "flock.ugen.sinOsc",
        freq: 270,
        phase: {
            ugen: "flock.ugen.sinOsc",
            freq: {
                ugen: "flock.ugen.envGen",
                rate: "control",
                envelope: customEnvelope,
                mul: 473,
                gate: gateDef
            }
        },
        mul: {
            ugen: "flock.ugen.envGen",
            rate: "control",
            envelope: customEnvelope,
            mul: 0.5,
            gate: gateDef
        }
    }
});
