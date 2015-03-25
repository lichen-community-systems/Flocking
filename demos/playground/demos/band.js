flock.band({
    components: {
        left: {
            type: "flock.synth",
            options: {
                synthDef: {
                    ugen: "flock.ugen.sinOsc",
                    freq: {
                        ugen: "flock.ugen.sequence",
                        list: [1, 4/3, 5/4],
                        loop: 1,
                        freq: 3,
                        mul: 440
                    }
                }
            }
        },

        right: {
            type: "flock.synth",
            options: {
                synthDef: {
                    ugen: "flock.ugen.sinOsc",
                    freq: {
                        ugen: "flock.ugen.sequence",
                        list: [1, 3/2],
                        loop: 1,
                        freq: 2,
                        mul: 220
                    }
                }
            }
        }
    }
});
