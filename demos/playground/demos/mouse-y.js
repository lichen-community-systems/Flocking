// Tracks the mouse's vertical movement across the window.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.sinOsc",
        freq: {
            ugen: "flock.ugen.mouse.cursor",
            rate: "control",
            mul: 880,
            add: 110,
            options: {
                axis: "y"
            }
        },
        mul: 0.25
    }
});
