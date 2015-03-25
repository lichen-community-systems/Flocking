// Multiple harmonics, each with their own ADSR envelope.
// The envelope generator's gate is open
// whenever the mouse button is held down.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.sum",
        sources: [
            {
                ugen: "flock.ugen.sinOsc",
                freq: 440,
                mul: {
                    ugen: "flock.ugen.envGen",
                    envelope: {
                        type: "flock.envelope.adsr",
                        attack: 1.0,
                        decay: 0.5,
                        peak: 0.15,
                        sutain: 0.1,
                        release: 1.0
                    },
                    gate: {
                        ugen: "flock.ugen.mouse.click"
                    }
                }
            },
            {
                ugen: "flock.ugen.sinOsc",
                freq: 440 * 2/1,
                mul: {
                    ugen: "flock.ugen.envGen",
                    envelope: {
                        type: "flock.envelope.adsr",
                        attack: 1.0 * 2/1,
                        decay: 0.5 * 2/1,
                        peak: 0.15,
                        sustain: 0.1,
                        release: 1.0 * 2/1
                    },
                    gate: {
                        ugen: "flock.ugen.mouse.click"
                    }
                }
            },
            {
                ugen: "flock.ugen.sinOsc",
                freq: 440 * 3/2,
                mul: {
                    ugen: "flock.ugen.envGen",
                    envelope: {
                        type: "flock.envelope.adsr",
                        attack: 1.0 * 3/2,
                        decay: 0.5 * 3/2,
                        peak: 0.15,
                        sustain: 0.1,
                        release: 1.0 * 3/2
                    },
                    gate: {
                        ugen: "flock.ugen.mouse.click"
                    }
                }
            },
            {
                ugen: "flock.ugen.sinOsc",
                freq: 440 * 4/3,
                mul: {
                    ugen: "flock.ugen.envGen",
                    envelope: {
                        type: "flock.envelope.adsr",
                        attack: 1.0 * 4/3,
                        decay: 0.5 * 4/3,
                        peak: 0.15,
                        sustain: 0.1,
                        release: 1.0 * 4/3
                    },
                    gate: {
                        ugen: "flock.ugen.mouse.click"
                    }
                }
            },
            {
                ugen: "flock.ugen.sinOsc",
                freq: 440 * 5/4,
                mul: {
                    ugen: "flock.ugen.envGen",
                    envelope: {
                        type: "flock.envelope.adsr",
                        attack: 1.0 * 5/4,
                        decay: 0.5 * 5/4,
                        peak: 0.15,
                        sustain: 0.1,
                        release: 1.0 * 5/4
                    },
                    gate: {
                        ugen: "flock.ugen.mouse.click"
                    }
                }
            },
            {
                ugen: "flock.ugen.sinOsc",
                freq: 440 * 7/6,
                mul: {
                    ugen: "flock.ugen.envGen",
                    envelope: {
                        type: "flock.envelope.adsr",
                        attack: 1.0 * 7/6,
                        decay: 0.5 * 7/6,
                        peak: 0.15,
                        sustain: 0.1,
                        release: 1.0 * 7/6
                    },
                    gate: {
                        ugen: "flock.ugen.mouse.click"
                    }
                }
            }
        ]
    }
});
