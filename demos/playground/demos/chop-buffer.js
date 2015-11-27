// Move the mouse horizontally in the browser window to control
// the amount that the buffer is chopped.
flock.synth({
    synthDef: {
        id: "chopper",
        ugen: "flock.ugen.chopBuffer",
        start: 0.1,
        amount: {
            ugen: "flock.ugen.mouse.cursor",
            options: {
                axis: "x"
            }
        },
        buffer: {
            url: "../shared/audio/where-the-honey-is.mp3"
        },
        mul: 0.1
    }
});
