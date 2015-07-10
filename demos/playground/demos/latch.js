/*
  David Michael Cottle's first Latch example from http://www.mat.ucsb.edu/275/CottleSC3.pdf

 "The patterns that emerge are more varied than a single sequence,
  but more cohesive than an LFNoise control.
  Try the example below and listen for the shape of the Saw wave in the frequencies.
  In this patch I change the frequency of the wave being sampled.
  I use a MouseX.kr to control the frequency of the sampled LFSaw.
  It begins at 0.1, or once every ten seconds and then moves to 20.
  When the mouse is at the left of the screen you should hear the shape
  of the wave in the resulting frequency control.
  As you move to the right, you are essentially shortening the sampled wave
  in relation to the sample rate, and the smooth ramp will begin to disappear,
  but there will always be a pattern" (Cottle 168).
*/

flock.synth({
    synthDef: {
        ugen: "flock.ugen.sin",
        mul: 0.3,
        freq: {
            ugen: "flock.ugen.latch",
            rate: "control",
            source: {
                ugen: "flock.ugen.lfSaw",
                freq: {
                    ugen: "flock.ugen.mouse.cursor",
                    rate: "control",
                    mul: 18.9,
                    add: 1.1
                },
                mul: 500,
                add: 600
            },
            trigger: {
                ugen: "flock.ugen.impulse",
                rate: "control",
                freq: 10
            }
        }
    }
});
