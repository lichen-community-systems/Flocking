# Scheduling Changes in Flocking #

## Using Unit Generators to Trigger Changes ##
There are a number of ways to schedule changes in Flocking. One way is to trigger periodic signal changes
using unit generators. Impulse is particularly useful for this task. For example, here's how to play a sound file every 2 seconds:

    flock.synth({
        synthDef: {
            ugen: "flock.ugen.playBuffer",
            buffer: {
                id: "drum",
                url: "audio/kick.wav"
            },
            loop: 1,
            trigger: {
                ugen: "flock.ugen.impulse",
                freq: 1/2
            }
        }
    });
