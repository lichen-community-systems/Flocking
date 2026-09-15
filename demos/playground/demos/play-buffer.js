// Plays back a sound file in a loop.
// The playback rate is controlled by the mouse cursor's vertical position,
// while the end point in the sound file is determined by the mouse's horizontal position.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.playBuffer",
        buffer: {
            id: "chord",
            url: "../shared/audio/hillier-first-chord.wav"
        },

        speed: {
            ugen: "flock.ugen.mouse.cursor",
            options: {
                axis: "y"
            },
            add: 0.5
        },

        loop: 1,

        start: 0,

        end: {
            ugen: "flock.ugen.mouse.cursor",
            options: {
                axis: "x"
            }
        }
    }
});
