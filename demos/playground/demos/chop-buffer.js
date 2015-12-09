// Move the mouse horizontally in the browser window to control
// the amount that the buffer is chopped.
flock.synth({
    synthDef: {
        id: "chopper",
        ugen: "flock.ugen.chopBuffer",
        start: 0.1,
        amount: {
            ugen: "flock.ugen.triOsc",
            rate: "control",
            freq: 1/30,
            mul: 0.5,
            add: 0.5
        },
        speed: {
            ugen: "flock.ugen.lfNoise",
            rate: "audio",
            options: {
                interpolation: "linear"
            },
            freq: 1/5,
            mul: 0.5,
            add: 0.5
        },
        minDuration: {
            ugen: "flock.ugen.lfNoise",
            freq: 1/5,
            mul: 0.5,
            add: 0.001
        },
        gap: -0.001,
        buffer: {
            url: "../shared/audio/where-the-honey-is.mp3"
        },

        mul: 0.1,

        options: {
            maxVoices: 10
        }
    }
});
