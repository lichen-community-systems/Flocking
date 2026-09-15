// Two different channels: both are sine waves with slightly different frequencies.

flock.synth({
    synthDef: [
        {
            id: "leftSine",
            ugen: "flock.ugen.sinOsc",
            freq: 440,
            mul: 0.25
        },
        {
            id: "rightSine",
            ugen: "flock.ugen.sinOsc",
            freq: 444,
            mul: 0.25
        }
    ]
});
