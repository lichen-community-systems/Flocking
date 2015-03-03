# Table-Based Oscillators #

Flocking includes a collection of oscillators that sample from a single cycle of a pre-generated waveform. These oscillators include:

 * `flock.ugen.sinOsc`, a sine wave oscillator
 * `flock.ugen.triOsc`, a triangle wave oscillator
 * `flock.ugen.sawOsc`, a sawtooth oscillator
 * `flock.ugen.squareOsc`, a square wave oscillator

All the table-based oscillators extend <code>flock.ugen.osc</code>, and share a consistent set of inputs.
They are not bandlimited, and the table is interpolated linearly by default.

All oscillators support the following rates:

`demand`, `scheduled`, `control`, `constant`


## Custom Tables ##

You can fill a buffer with your own custom waveform and use it with flock.ugen.osc:

    // This makes a simple ramping envelope, which you can use to modulate other unit generators.
    {
        ugen: "flock.ugen.osc",
        table: new Float32Array([0, 1]),
        freq: 0.01,
        options: {
            interpolation: "linear"
        }
    }

## flock.ugen.osc ##

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


# Low Frequency Oscillators #

A variety of other oscillators are provided for use as low frequency oscillators (LFOs).
They include:

 * <code>flock.ugen.sin</code>
 * <code>flock.ugen.lfSaw</code>
 * <code>flock.ugen.impulse</code>
 * <code>flock.ugen.lfPulse</code>

These unit generators are not bandlimited.

## flock.ugen.sin ##

A sine oscillator implemented using <code>Math.sin()</code>.

### Inputs ###

This unit generator shares the same inputs and options as the <code>flock.ugen.osc</code>
family of oscillators described above.


## flock.ugen.lfSaw ##

A low frequency saw.

### Inputs ###

Shares the same inputs as the <code>flock.ugen.osc</code>
family of oscillators described above.


## flock.ugen.impulse ##

An impulse generator. Ideal for use as a metronome-like trigger.

### Inputs ###

Shares the same inputs as the <code>flock.ugen.osc</code>
family of oscillators described above.


## flock.ugen.lfPulse ##

A pulse (PWM) oscillator with modulatable width.


### Inputs ###

Shares the same inputs as the <code>flock.ugen.osc</code>
family of oscillators described above.

#### width ####

<table>
    <tr>
        <th>description</th>
        <td>the width of the duty cycle</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..`1`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`0.5` (constant)</td>
    </tr>
</table>


# Band-Limited Oscillators #

Flocking includes a collection of band-limited oscillators suitable for modeling analog synthesis. These are implemented using the BLIT-FDF method documented in:

 Nam, Juhan, Valimaki, Vesa, Able, Jonathan S. and Smith, Julius O. "Efficient Antialiasing Oscillator Algorithms Using Low-Order Fractional Delay Filters." _IEEE Transactions on Audio, Speech, and Language Processing_. 18:4 (2010).

This method has the benefit that it is highly computationally efficient, with the trade-off that frequencies can only be modulated at the end of each period, making it less ideal frequency modulation than other methods.

In each case, the waveforms are integrated from a series of band-limited impulses (BLITs). For the continuous waveforms (saw, triangle, square), a leaky integrator is used to fill out the space between impulses. The `leakRate` input should be scaled according to the frequency of the oscillator; higher frequencies will require a faster leak rate.

## flock.ugen.blit ##

A band-limited impulse train oscillator.

### Inputs ###

#### freq ####
<table>
    <tr>
        <th>description</th>
        <td>The frequency to oscillate at</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..nyquist rate / 2</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`440.0` (constant)</td>
    </tr>
</table>


## flock.ugen.saw ##

A band-limited sawtooth wave oscillator.

### Inputs ###

#### freq ####
<table>
    <tr>
        <th>description</th>
        <td>The frequency to oscillate at</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..nyquist rate / 2</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`440.0` (constant)</td>
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

#### leakRate ####
<table>
    <tr>
        <th>description</th>
        <td>the rate of the leaky integrator used to fill out the space between impulses, integrating the waveform; this value should be increased as the fundamental frequency increases</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..`1.0`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`0.01` (constant)</td>
    </tr>
</table>

## flock.ugen.tri ##

A band-limited triangle wave oscillator.

### Inputs ###

#### freq ####
<table>
    <tr>
        <th>description</th>
        <td>The frequency to oscillate at</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..nyquist rate / 2</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`440.0` (constant)</td>
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

#### leakRate ####
<table>
    <tr>
        <th>description</th>
        <td>the rate of the leaky integrator used to fill out the space between impulses, integrating the waveform; this value should be increased as the fundamental frequency increases</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..`1.0`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`0.01` (constant)</td>
    </tr>
</table>

## flock.ugen.square ##

A band-limited square wave oscillator.

### Inputs ###

#### freq ####
<table>
    <tr>
        <th>description</th>
        <td>The frequency to oscillate at</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..nyquist rate / 2</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`440.0` (constant)</td>
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

#### leakRate ####
<table>
    <tr>
        <th>description</th>
        <td>the rate of the leaky integrator used to fill out the space between impulses, integrating the waveform; this value should be increased as the fundamental frequency increases</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..`1.0`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`0.01` (constant)</td>
    </tr>
</table>
