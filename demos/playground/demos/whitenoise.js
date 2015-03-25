// Filters white noise with a bandpass filter
// controlled by the mouse's horizontal position.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.filter.biquad.bp",
        source: {
            ugen: "flock.ugen.whiteNoise",
            mul: 0.5
        },
        freq: {
            ugen: "flock.ugen.mouse.cursor",
            mul: 1660,
            add: 40,
            options: {
                interoplation: "exponential"
            }
        },
        q: 2.0
    }
});
