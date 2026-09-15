fluid.defaults("flock.demo.sequencedSine", {
    gradeNames: ["flock.synth"],
    synthDef: {
        ugen: "flock.ugen.out",
        expand: 1,
        sources: {
            ugen: "flock.ugen.sinOsc",
            freq: {
                ugen: "flock.ugen.sequence",
                loop: 1
            },
            mul: 0.5
        }
    }
});

flock.band({
    components: {
        left: {
            type: "flock.demo.sequencedSine",
            options: {
                synthDef: {
                    bus: 0,
                    sources: {
                        freq: {
                            values: [1, 4/3, 5/4],
                            freq: 3,
                            mul: 440
                        }
                    }
                }
            }
        },

        right: {
            type: "flock.demo.sequencedSine",
            options: {
                synthDef: {
                    bus: 1,
                    sources: {
                        freq: {
                            values: [1, 3/2],
                            freq: 2,
                            mul: 220
                        }
                    }
                }
            }
        }
    }
});
