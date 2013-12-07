# Oscillators #


## Table-Based Oscillators ##

Flocking includes a collection of oscillators that sample from a single cycle of a pre-generated waveform. These oscillators include:

 * flock.ugen.sinOsc, a sine wave oscillator
 * flock.ugen.triOsc, a triangle wave oscillator
 * flock.ugen.sawOsc, a sawtooth oscillator
 * flock.ugen.squareOsc, a square wave oscillator
 
### flock.ugen.osc ###

Each of the *Osc family of unit generators have a consistent set of inputs provided by their parent unit generator, flock.ugen.osc.

You can, if you want, fill a buffer with your own custom waveform and use it with flock.ugen.osc:

    // This makes a simple ramping envelope, which you can use to modulate other unit generators.
    {
        ugen: "flock.ugen.osc",
        table: new Float32Array([0, 1]),
        freq: 440,
        options: {
            interpolation: "linear"
        }
    }

All oscillators support the following rates:

    demand, scheduled, control, constant


#### Inputs ####

##### freq #####
<em>description</em>: The frequency to oscillate at.
<em>range</em>: 0..Infinity
<em>rates</em>: constant, control, audio
<em>default</em>: 440.0 (constant)

##### phase #####
<em>description</em>: a phase increment value to add to the oscillator's current phase
<em>range</em>: 0..1.0
<em>rates</em>: constant, control, audio
<em>default</em>: 0.0 (constant)
 
##### mul ######
<em>description</em>: a multiplier that determines the amplitude of the oscillator
<em>range</em>: -Infinity..Infinity
<em>rates</em>: constant, control, audio
<em>default</em>: 1.0 (constant)

##### add ######

<em>description</em>: a value used to scale the amplitude of the oscillator
<em>range</em>: -Infinity..Infinity
<em>rates</em>: constant, control, audio
<em>default</em>: 0.0 (constant)

#### Options ####

##### interpolation ####
<em>description</em>: the type of interpolation to use when selecting values from the wave table
<em>range</em>: undefined, "none", "linear", "cubic"
