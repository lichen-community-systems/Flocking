// A stereo pair of Impulses, one being phase modulated with the mouse cursor.

flock.synth({
    synthDef: [
        {
            ugen: "flock.ugen.impulse",
            freq: 4,
            mul: 0.3,
            phase: 0
        },
        {
            ugen: "flock.ugen.impulse",
            freq: 4,
            mul: 0.3,
            phase: {
                ugen: "flock.ugen.mouse.cursor"
            }
        }
    ]
});
