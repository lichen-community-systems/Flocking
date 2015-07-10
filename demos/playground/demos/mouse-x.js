// Tracks the mouse's horizonal movement across the window.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.sinOsc",
        freq: {
            ugen: "flock.ugen.mouse.cursor",
            rate: "control",
            mul: 880,
            add: 110
        },
        mul: 0.25
    }
});
