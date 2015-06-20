# Buffer Unit generators

Flocking provides a variety of unit generators for playing, granulating, and writing buffers.

## flock.ugen.playBuffer ##

The <code>playBuffer</code> unit generator plays back an audio buffer. It provides control over the speed of playback, start and end points, looping, triggering.

Currently, this unit generator only supports playing back a single channel at a time. For multichannel playback, use multiple instances of <code>flock.ugen.playBuffer</code>, each with different <code>channel inputs</code>.

### Inputs ###

#### buffer ####

The <code>buffer</code> input is a standard "special" input supported by many Flocking unit generators. It can be specified as a either a Buffer Definition object, which encodes a reference to a buffer, or a Buffer Description object, which is a wrapper around an actual audio buffer.

<table>
    <tr>
        <th>description</th>
        <td>a <code>BufDef</code> or raw <code>BufDesc</code> to play</td>
    </tr>
    <tr>
        <th>range</th>
        <td>A Buffer Definition or Buffer Description object.</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>special object</td>
    </tr>
    <tr>
        <th>default</th>
        <td>null; must be specified by the user</td>
    </tr>
</table>

#### channel ####

<table>
    <tr>
        <th>description</th>
        <td>the channel to play</td>
    </tr>
    <tr>
        <th>range</th>
        <td>0..number of channels in the buffer</td>
    </tr>
    <tr>
        <th>rates</th>
        <td><code>control</code>, <code>constant</code></td>
    </tr>
    <tr>
        <th>default</th>
        <td>0</td>
    </tr>
</table>

#### loop ####
<table>
    <tr>
        <th>description</th>
        <td>a flag specifying if the unit generator should loop back to the beginning of the buffer
        when it reaches the end. Any value greater than 0 is </td>
    </tr>
    <tr>
        <th>range</th>
        <td><code><= 0</code> is (<code>false</code>); <code>> 0</code> is (<code>true</code>)</td>
    </tr>
    <tr>
        <th>rates</th>
        <td><code>control</code>, <code>constant</code></td>
    </tr>
    <tr>
        <th>default</th>
        <td>0</td>
    </tr>
</table>

#### start ####
<table>
    <tr>
        <th>description</th>
        <td>a value between 0 and 1.0 specifying the location into the file to start playing from</td>
    </tr>
    <tr>
        <th>range</th>
        <td><code>0</code>..<code>1.0</code></td>
    </tr>
    <tr>
        <th>rates</th>
        <td><code>control</code>, <code>constant</code></td>
    </tr>
    <tr>
        <th>default</th>
        <td>0</td>
    </tr>
</table>

#### end ####
<table>
    <tr>
        <th>description</th>
        <td>a value between 0 and 1.0 specifying the location into the file to stop playing at</td>
    </tr>
    <tr>
        <th>range</th>
        <td><code>0</code>..<code>1.0</code></td>
    </tr>
    <tr>
        <th>rates</th>
        <td><code>control</code>, <code>constant</code></td>
    </tr>
    <tr>
        <th>default</th>
        <td><code>1.0</code></td>
    </tr>
</table>

#### trigger ####

<table>
    <tr>
        <th>description</th>
        <td>a trigger signal which, when fired (i.e. a change from negative to positive), will cause a jump back the <code>start</code> position</td>
    </tr>
    <tr>
        <th>range</th>
        <td>Any signal</td>
    </tr>
    <tr>
        <th>rates</th>
        <td><code>audio</code>, <code>control</code>, <code>constant</code></td>
    </tr>
    <tr>
        <th>default</th>
        <td><code>1.0</code></td>
    </tr>
</table>

#### mul ####
<table>
    <tr>
        <th>description</th>
        <td>a multiplier that determines the amplitude of the output signal</td>
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
        <td>a value used to scale the amplitude of the output signal</td>
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


## flock.ugen.readBuffer ##

Reads values out of a buffer at the specified phase index. This unit generator is typically used with <code>flock.ugen.phasor</code> or a similar unit generator to scan through the buffer at a particular (often changing) rate.

Where <code>flock.ugen.playBuffer</code> will read through the buffer automatically, this unit generator moves its read point based on its <code>phase</code> input.

Currently, this unit generator only supports playing back a single channel at a time. For multichannel playback, use multiple instances of <code>flock.ugen.readBuffer</code>, each with different <code>channel inputs</code>.

Runs at audio or control rate.

### Inputs ###

#### buffer ####

The <code>buffer</code> input is a standard "special" input supported by many Flocking unit generators. It can be specified as a either a Buffer Definition object, which encodes a reference to a buffer, or a Buffer Description object, which is a wrapper around an actual audio buffer.

<table>
    <tr>
        <th>description</th>
        <td>a <code>BufDef</code> or raw <code>BufDesc</code> to play</td>
    </tr>
    <tr>
        <th>range</th>
        <td>A Buffer Definition or Buffer Description object.</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>special object</td>
    </tr>
    <tr>
        <th>default</th>
        <td>null; must be specified by the user</td>
    </tr>
</table>

#### channel ####

<table>
    <tr>
        <th>description</th>
        <td>the channel to play</td>
    </tr>
    <tr>
        <th>range</th>
        <td>0..number of channels in the buffer</td>
    </tr>
    <tr>
        <th>rates</th>
        <td><code>control</code>, <code>constant</code></td>
    </tr>
    <tr>
        <th>default</th>
        <td>0</td>
    </tr>
</table>

#### phase ####

<table>
    <tr>
        <th>description</th>
        <td>a value between 0 and 1 representing the scaled index into the buffer to read</td>
    </tr>
    <tr>
        <th>range</th>
        <td><code>0</code>..<code>1.0</code></td>
    </tr>
    <tr>
        <th>rates</th>
        <td><code>audio</code>, <code>control</code>, <code>constant</code></td>
    </tr>
    <tr>
        <th>default</th>
        <td>0</td>
    </tr>
</table>

#### mul ####
<table>
    <tr>
        <th>description</th>
        <td>a multiplier that determines the amplitude of the output signal</td>
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
        <td>a value used to scale the amplitude of the output signal</td>
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


## flock.ugen.bufferDuration ##

Returns the duration of the <code>buffer</code> input in seconds.

Can run at control or constant rate. This unit generator will update its value whenever the <code>buffer</code> input changes.

### Inputs ###

#### buffer ####

The <code>buffer</code> input is a standard "special" input supported by many Flocking unit generators. It can be specified as a either a Buffer Definition object, which encodes a reference to a buffer, or a Buffer Description object, which is a wrapper around an actual audio buffer.

<table>
    <tr>
        <th>description</th>
        <td>a <code>BufDef</code> or raw <code>BufDesc</code> to play</td>
    </tr>
    <tr>
        <th>range</th>
        <td>A Buffer Definition or Buffer Description object.</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>special object</td>
    </tr>
    <tr>
        <th>default</th>
        <td>null; must be specified by the user</td>
    </tr>
</table>

#### channel ####

<table>
    <tr>
        <th>description</th>
        <td>the channel to play</td>
    </tr>
    <tr>
        <th>range</th>
        <td>0..number of channels in the buffer</td>
    </tr>
    <tr>
        <th>rates</th>
        <td><code>control</code>, <code>constant</code></td>
    </tr>
    <tr>
        <th>default</th>
        <td>0</td>
    </tr>
</table>


## flock.ugen.bufferLength ##

Outputs the length of the <code>buffer</code> in samples. Runs at either control or constant rate.
This unit generator will update its value whenever the <code>buffer</code> input changes.

### Inputs ###

Same as <code>flock.ugen.bufferDuration</code>


## flock.ugen.phaseStep ##

Outputs a phase step value (i.e. an appropriate index increment value) for playing the specified buffer at its normal playback rate. This unit generator takes into account any differences between the sound file's sample rate and the environment's audio rate.

Runs at audio, control, and constant rates.

### Inputs ###

Same as <code>flock.ugen.bufferDuration</code>


## flock.ugen.sampleRate ##

A constant-rate unit generator that outputs the environment's current audio sample rate.

### Inputs ###

None.


## flock.ugen.writeBuffer ##

_Note: This section applies to the Flocking 0.2.0 release, which is still under development._

The <code>writeBuffer</code> unit generator writes its <code>sources</code> input to the specified <code>buffer</code> input. The buffer is specified as a Buffer Definition object or as a raw Buffer Description. Typically, users will record into a global environment buffer and then export an encoded sound file using the Environment's <code>saveBuffer()</code> method, which is described in the [buffer overview documentation](../buffers/about-buffers.md).

### Inputs ###

#### source ####
<table>
    <tr>
        <th>description</th>
        <td>The input to write to the buffer</td>
    </tr>
    <tr>
        <th>range</th>
        <td>Any signal</td>
    </tr>
    <tr>
        <th>rates</th>
        <td><code>audio</code></td>
    </tr>
    <tr>
        <th>default</th>
        <td>null; must be specified by the user</td>
    </tr>
</table>

#### buffer ####

The <code>buffer</code> input is a standard "special" input supported by many Flocking unit generators. It can be specified as a either a Buffer Definition object, which encodes a reference to a buffer, or a Buffer Description object, which is a wrapper around an actual audio buffer.

<code>flock.ugen.writeBuffer</code> will create a buffer in the Environment's collection of global buffers if the  buffer specified in a BufDef doesn't already exist.

<table>
    <tr>
        <th>description</th>
        <td>a <code>BufDef</code> or raw <code>BufDesc</code> to record to</td>
    </tr>
    <tr>
        <th>range</th>
        <td>A Buffer Definition or Buffer Description object.</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>special object</td>
    </tr>
    <tr>
        <th>default</th>
        <td>null; must be specified by the user</td>
    </tr>
</table>

#### start ####
<table>
    <tr>
        <th>description</th>
        <td>the index into the buffer to start writing at</td>
    </tr>
    <tr>
        <th>range</th>
        <td>0..buffer length</td>
    </tr>
    <tr>
        <th>rates</th>
        <td><code>control</code>, <code>constant</code></td>
    </tr>
    <tr>
        <th>default</th>
        <td>0</td>
    </tr>
</table>

#### loop ####
<table>
    <tr>
        <th>description</th>
        <td>a flag specifying if the unit generator should loop back to the beginning of the buffer
        when it reaches the end. Any value greater than 0 is </td>
    </tr>
    <tr>
        <th>range</th>
        <td><code><= 0</code> is (<code>false</code>); <code>> 0</code> is (<code>true</code>)</td>
    </tr>
    <tr>
        <th>rates</th>
        <td><code>control</code>, <code>constant</code></td>
    </tr>
    <tr>
        <th>default</th>
        <td>0</td>
    </tr>
</table>

### Options ###

#### duration ####
<table>
    <tr>
        <th>description</th>
        <td>the duration of the buffer if one needs to be created</td>
    </tr>
    <tr>
        <th>range</th>
        <td>any value in seconds</td>
    </tr>
</table>

#### duration ####
<table>
    <tr>
        <th>description</th>
        <td>the duration of the buffer if one needs to be created</td>
    </tr>
    <tr>
        <th>range</th>
        <td>any <code>Number</code>, specified as seconds, which is greater than 0</td>
    </tr>
</table>

#### numOutputs ####
<table>
    <tr>
        <th>description</th>
        <td>the number of channels to write into the buffer; this must be equal to or less than the number of <code>sources</code></td>
    </tr>
    <tr>
        <th>range</th>
        <td>any Integer greater than 0 and less than or equal to the number of <code>sources</code></td>
    </tr>
</table>
