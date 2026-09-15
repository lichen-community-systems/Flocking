// Use Dust to trigger the Delay unit generator
// as an envelope for a Decaying WhiteNoise source

flock.synth({
    synthDef: {
        ugen: "flock.ugen.delay",
        source: {
            ugen: "flock.ugen.decay",
            source: {
                ugen: "flock.ugen.dust",
                density: 1.0,
                mul: 0.5
            },
            time: 0.3,
            mul: {
                ugen: "flock.ugen.whiteNoise"
            }
        },
        maxTime: 1.0,
        time: 0.2,
        add: {
            ugen: "flock.ugen.decay",
            source: {
                ugen: "flock.ugen.dust",
                density: 1.0,
                mul: 0.5
            },
            time: 0.3,
            mul: {
                ugen: "flock.ugen.whiteNoise"
            }
        }
    }
});
