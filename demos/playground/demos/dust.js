// Using dust to generate random audio noise.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.dust",
        density: 200,
        mul: 0.25
    }
});
