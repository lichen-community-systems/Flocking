flock.synth({
    synthDef: {
        ugen: "flock.ugen.sum",
        sources: [
            {
                ugen: "flock.ugen.distortion.tanh",
                source: {
                    ugen: "flock.ugen.sinOsc", 
                    freq: 500,
                    mul: {
                        ugen: "flock.ugen.asr",
                        attack: 0.1,
                        sustain: 0.1,
                        release: 0.1,
                        mul: 2,
                        gate: {
                            ugen: "flock.ugen.impulse",
                            rate: "control",
                            freq: 0.7,
                            phase: 0
                        }
                    }
                } 
            }, 
            {
                ugen: "flock.ugen.sinOsc", 
                freq: 600,
                mul: {
                    ugen: "flock.ugen.asr",
                    attack: 0.1,
                    sustain: 0.1,
                    release: 0.1,
                    mul: 2,
                    gate: {
                        ugen: "flock.ugen.impulse",
                        rate: "control",
                        freq: 0.7,
                        phase: 0.5
                    }
                }
            }
        ] 
    }
});
