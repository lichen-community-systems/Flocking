// Plays back live audio from the microphone.
// Wear headphones to prevent feedback.

flock.synth({
    synthDef: {
        ugen: "flock.ugen.audioIn"
    }
});
