# Oscillators #

## Table-Based
Flocking includes a collection of oscillators that sample from a single cycle of a pre-generated waveform. These oscillators include:

 * `flock.ugen.sinOsc`, a sine wave oscillator
 * `flock.ugen.triOsc`, a triangle wave oscillator
 * `flock.ugen.sawOsc`, a sawtooth oscillator
 * `flock.ugen.squareOsc`, a square wave oscillator
 
## flock.ugen.osc ##

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

`demand`, `scheduled`, `control`, `constant`


### Inputs ###

#### freq ####
<table>
    <tr>
        <th>description</th>
        <td>The frequency to oscillate at</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..`Infinity`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`440.0` (constant)</td>
    </tr>
</table>

#### phase ####
<table>
    <tr>
        <th>description</th>
        <td>a phase increment value to add to the oscillator's current phase</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..`1.0`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`0.0` (constant)</td>
    </tr>
</table>
 
#### mul ####
<table>
    <tr>
        <th>description</th>
        <td>a multiplier that determines the amplitude of the oscillator</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`-Infinity`..`Infinity`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`1.0` (constant)</td>
    </tr>
</table>

#### add ####
<table>
    <tr>
        <th>description</th>
        <td>a value used to scale the amplitude of the oscillator</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`-Infinity`..`Infinity`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`0.0` (constant)</td>
    </tr>
</table>

### Options ###

#### interpolation ####
<table>
    <tr>
        <th>description</th>
        <td> the type of interpolation to use when selecting values from the wave table</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`undefined`, `"none"`, `"linear"`, `"cubic"`</td>
    </tr>
</table>
