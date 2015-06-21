# Buffers in Flocking #

Flocking has a number of features that help make working with sound files and buffers easier.
Audio can be loaded automatically by the Flocking framework using declarative _Buffer Definition_ objects, which can be supplied directly as an input to some unit generators.

If more control is needed, the _Buffer Loader_ component can be used to load collections of buffer definitions. It provides an event that will fire when all buffers have successfully loaded.

Flocking also provides a set of low-level abstractions on top of the Web Audio API's decoders, as well as its own custom decoder for certain edge cases.

## Supported Sound File Formats ##

Out of the box, Flocking delegates to the Web Audio API's audio file decoders, which vary across browser implementations. This means that there is no precise list of formats supported by Flocking, since it will depend substantially on the platform and browser used. The Mozilla Developer Network provides [a list of supported formats and codecs](https://developer.mozilla.org/en-US/docs/Web/HTML/Supported_media_formats#Browser_compatibility).

However, it is generally safe to assume that these formats will work across the majority of browsers:

* WAVE
* MP3
* AAC in the MP4 container

Flocking also provides an optional pure JavaScript decoder library that supports WAVE and AIFF files, and is used in with its Node.js backend. This library is not included in the default Flocking concatenated builds, but can be included in your pages if support for AIFF files or unusual bit rates is required. To do so, simply import <code>flocking-audiofile-compatibility.js</code>.

As of Flocking version 0.2.0, audio buffers can be exported as WAVE files. Flocking ships with a custom exporter that is capable of exporting a wide variety of sample formats and bit rates.


## Buffer Definitions ##

A buffer definition is a JSON object that encodes a request for an audio buffer. BufferDefs can be supplied as special inputs to a number of unit generators, including <code>flock.ugen.playBuffer</code>, <code>flock.ugen.readBuffer</code>, and <code>flock.ugen.triggerGrains</code>.

A buffer definition can contain the following options:

<table>
    <tr>
        <th>Property</th>
        <th>Type</th>
        <th>Description</th>
    </tr>
    <tr>
        <td><code>id</code></td>
        <td>String</td>
        <td>An identifier that will be used to register the buffer with the Flocking environment.
        This enables the buffer to be referred to by name in other buffer definitions. _(optional)_</td>
    </tr>
    <tr>
        <td><code>url</code></td>
        <td>String</td>
        <td>A URL to the sound file. This URL must respect the [same origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy). _(optional; mutually exclusive with <code>selector</code>)_</td>
    </tr>
    <tr>
        <td><code>selector</code></td>
        <td>String</td>
        <td>A selector to an HTML file input element from which the sound file should be retrieved. This is useful in cases where the user has uploaded their own sound files to your site. _(optional; mutually exclusive with <code>url</code>)_</td>
    </tr>
    <tr>
        <td><code>src</code></td>
        <td>String</td>
        <td>A raw ArrayBuffer instance containing the sound file to be decoded. _(optional)_</td>
    </tr>
    <tr>
        <td><code>replace</code></td>
        <td>Boolean</td>
        <td>If <code>true</code> and there is an existing buffer registered with the Flocking environment, it will be loaded again and replaced. _(optional, defaults to <code>false</code>)_</td>
    </tr>
</table>

### Examples of Buffer Definitions ###

Load a buffer from a URL and register it globally by ID with the Flocking Environment:

    {
        id: "my-buffer",
        url: "/sounds/my-sound-file.mp3"
    }

Load a buffer from a file input element, registering it globally by ID with the Flocking Environment:

    <form class="fileSelector">
        <label for="fileBrowser">Choose a sound file</label>
        <input id="fileBrowser" type="file" />
        <button class="browse">Choose a sound file...</button>
        <span class="filePath"></span>
    </form>

    {
        id: "my-buffer",
        selector: "#fileBrowser"
    }

Decode a buffer from a Data URL:

    {
        id: "my-buffer",
        url: "data:audio/wav;base64,UklGRngAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVQAAAAAAM0MmRlmJjMzAEDMTJlZZmYyc/9/MnNmZplZzEwAQDMzZiaZGc0MAAAz82fmmtnNzADANLNnppqZzowBgM6MmplnpjSzAMDNzJrZZ+Yz8wAAzQw="
    }

Refer to an already-loaded buffer that has been registered with the Flocking environment:

    {
        id: "my-buffer"
    }


## Manually Loading Buffers ##

You can also load audio files manually if you need greater control over when they're loaded, or want to defer actions until a collection of buffers have all been loaded.

### Buffer Loader ###

The <code>flock.bufferLoader</code> component can be used to load one or more buffers. You can specify which buffers to load by passing an array of bufferDef objects to the <code>bufferDefs</code> option. The <code>afterBuffersLoaded</code> event will fire when all the buffers have been fully loaded.

    var loader = flock.bufferLoader({
        bufferDefs: [
            {
                id: "meow",
                url: "sounds/cat.wav"
            },
            {
                id: "squeak",
                url: "sounds/mouse.mp3"
            }
        ],
        listeners: {
            onBuffersLoaded: function (bufferDescriptions) {
                // Do something once all buffers are ready.
            }
        }
    });

### Buffer Source ###

The <code>flock.bufferSource</code> component provides a Promise-based API for asynchronously fetching an audio buffer. It is used internally by the Flocking Environment for managing buffers specified by Buffer Definitions within the unit generator tree, but can also be used to manually load audio files.

#### Methods ####

<table>
    <tr>
        <th>Method Name</th>
        <th>Description</th>
        <th>Arguments</th>
        <th>Return Value</th>
    </tr>
    <tr>
        <td><code>get</code></td>
        <td>Fetches the buffer described by the supplied Buffer Definition object</td>
        <td>A Buffer Definition object describing the buffer to fetch</td>
        <td>A <code>Promise</code> instance that will resolve when the buffer has been fetched</td>
    </tr>
    <tr>
        <td><code>set</code></td>
        <td>Sets this source object's buffer instance to the supplied Buffer Description object</td>
        <td>A Buffer Description object to assign to this BufferSource</td>
        <td>A <code>Promise</code> instance that will resolve when the buffer has been set</td>
    </tr>
</table>

#### Events ####

<table>
    <tr>
        <th>Event Name</th>
        <th>Arguments</th>
        <th>Description</th>
    </tr>
    <tr>
        <td><code>afterFetch</code></td>
        <td>The fetched Buffer Description object</td>
        <td>Fires after a buffer has been fully fetched</td>
    </tr>
    <tr>
        <td><code>onBufferUpdated</code></td>
        <td>The refreshed Buffer Description object</td>
        <td>Fires when a buffer has been updated</td>
    </tr>
    <tr>
        <td><code>onError</code></td>
        <td><code>Error</code> object</td>
        <td>Fires when an error occurs while fetching a buffer</td>
    </tr>
</table>

### flock.audio.decode() ###

At an even lower level of abstraction, you can manually load and decode audio files using the <code>flock.audio.decode()</code> function. This is typically only necessary for advanced users.

    var buffer;
    flock.audio.decode({
        src: "sounds/cat.wav", // src can also be a File object or Data URL.
        success: function (bufferDescription) {
            // Do something with the loaded buffer.
            buffer = bufferDescription;
        },
        error: function (err) {
            // Handle an error!
        }
    });

If you want to share a buffer that you've loaded by hand amongst unit multiple generators, you'll want to give it an ID and register it with the Flocking environment:

    buffer.id = "meow";
    flock.environment.registerBuffer(buffer);


## Buffer Descriptions ##

Buffer Description objects are wrappers around raw <code>Float32Array</code> instances representing each channel of sound data. In addition to providing access to the underlying audio samples, they provide format metadata about the buffer, such as the number of channels, sample rate, etc.

Buffer descriptions can be created from a raw <code>Float32Array</code> of samples or from a Web Audio API <code>AudioBuffer</code> using <code>flock.bufDesc</code>:

    var samples = new Float32Array([...]); // Assume this exists.
    var buffer = flock.bufDesc(samples);

Or with an array of channel sample data:

    var channelArray = [new Float32Array([...]), new Float32Array([...])]; // Assume this exists.
    var buffer = flock.bufDesc.fromChannelArray(samples);

A Buffer Description is essentially a JSON serialization of the structure of standard chunked audio file formats such a WAV and AIFF. It contains two essential properties:

<table>
    <tr>
        <th>Property</th>
        <th>Description</th>
    </tr>
    <tr>
        <td><code>format</code></td>
        <td>An object describing the format of the audio buffer</td>
    </tr>
    <tr>
        <td><code>data</code></td>
        <td>An object containing the sample data</td>
    </tr>
</table>

### Buffer Description Format Objects ###

The <code>format</code> container of a Buffer Description object contains metadata about the buffer.

<table>
    <tr>
        <th>Property</th>
        <th>Type</th>
        <th>Description</th>
    </tr>
    <tr>
        <td><code>sampleRate</code></td>
        <td>Number</td>
        <td>The rate at which the audio data was sampled</td>
    </tr>
    <tr>
        <td><code>numChannels</code></td>
        <td>Number</td>
        <td>The number of channels of sample data</td>
    </tr>
    <tr>
        <td><code>numSampleFrames</code></td>
        <td>Number</td>
        <td>The number of sample frames in the buffer</td>
    </tr>
    <tr>
        <td><code>duration</code></td>
        <td>Number</td>
        <td>The duration, in seconds, of the audio buffer</td>
    </tr>
</table>


### Buffer Description Data Objects ###

The data container of a Buffer Description object contains the actual raw sample data for the buffer.

<table>
    <tr>
        <th>Property</th>
        <th>Type</th>
        <th>Description</th>
    </tr>
    <tr>
        <td><code>channels</code></td>
        <td>Array of <code>Float32Array</code>s</td>
        <td>An array of arrays containing raw sample data for each channel</td>
    </tr>
</table>

## Exporting Audio Files ##

_Note: This section applies to the Flocking 0.2.0 release, which is still under development._

Flocking provides a means to export buffers from the Environment as sound files. Currently, only WAVE files are supported. Unlike many other solutions available for recording and exporting Web Audio, Flocking's exporter supports extended formats such as 32-bit floats and channel counts greater than two.

### Saving Audio Files ###

The Environment's <code>saveBuffer()</code> method performs the work of both  encoding and saving an audio buffer in one step:

    var buffer; // Assume this exists.
    flock.environment.saveBuffer({
        type: "wav",
        format: "float32",
        buffer: buffer,
        path: "cool-soundz.wav"
    });

The <code>saveBuffer()</code> method supports a variety of options:

<table>
    <tr>
        <th>Property</th>
        <th>Description</th>
        <th>Default</th>
    </tr>
    <tr>
        <td>type</td>
        <td>The type of audio file to create. Currently only WAVE files are supported.</td>
        <td><code>"wav"</code></td>
    </tr>
    <tr>
        <td>format</td>
        <td>The audio file format, as a format code string. Valid options are <code>"int16"</code>, <code>"int32"</code> and <code>"float32"</code></td>
        <td><code>"int16"</code></td>
    </tr>
    <tr>
        <td>path</td>
        <td>The file name; on platforms that support it (e.g. Node.js), this can be a file path</td>
        <td>The buffer's ID plus the specified file type (e.g. <code>my-buffer.wav</code>)</td>
    </tr>
    <tr>
        <td>buffer</td>
        <td>A buffer ID (as a String) or a buffer description object to save</td>
    </tr>
</table>

On Node.js, <code>saveBuffer()</code> will save the file to the path specified in the <code>path</code> option.

### Manually Encoding Buffers ###

Buffers can be encoded into the WAVE format using the <code>flock.audio.encode.wav()</code> free function. It takes two arguments:

1. <code>bufDesc</code>: a buffer to encode
2. <code>format</code>: a format string that specifies the format to encode this buffer as _(defaults to <code>int16</code>)_

The return value is an <code>ArrayBuffer</code> object containing the encoded sound file. Encoding currently occurs synchronously on the main thread, so it will block. This will be addressed prior to the 0.2.0 release.

Currently, Flocking supports the following WAVE file formats:

* <code>int16</code>
* <code>int32</code>
* <code>float32</code>

#### Example of Encoding a Buffer ####

    var buffer; // Assume this exists.
    var encoded = flock.audio.encode.wav(buffer, "float32");

#### Saving Manually-Encoded Buffers ####

If you're manually encoding buffers using <code>flock.audio.encode.wav()</code>, you may also want to provide a way for the user to download an audio file. Flocking's Web-specific _Audio Strategy_ component provides a free function called <code>flock.audioStrategy.web.download()</code> that will cause the buffer to be downloaded to the user's computer. Particularly in browsers other than Chrome, it should be bound to a button or other user-initiated action.

### Using the <code>flock.ugen.writeBuffer</code> Unit Generator ###

Flocking provides a unit generator for writing audio streams to buffers. <code>flock.ugen.writeBuffer</code> is typically used at the end of a signal graph in order to record other unit generators specified as its <code>sources</code> input. Documentation for <code>flock.ugen.writeBuffer</code> is available in the [Buffer UGens reference documentation](../ugens/buffers.md).

Typically, you want to record into a buffer and then use the [Flocking Scheduler](../scheduling.md) to stop the environment and export the buffer as an audio file. Here's an example:

    // Record a 30 second, 4-channel audio file.
    var synth = flock.synth({
        synthDef: {
            ugen: "flock.ugen.writeBuffer",
            options: {
                duration: 30,
                numOutputs: 4
            },
            buffer: "recording",
            sources: [
                {
                    ugen: "flock.ugen.sin"
                },
                {
                    ugen: "flock.ugen.square"
                },
                {
                    ugen: "flock.ugen.tri"
                },
                {
                    ugen: "flock.ugen.saw"
                }
            ]
        }
    });

    flock.environment.asyncScheduler.once(30, function () {
        flock.environment.stop();
        flock.environment.saveBuffer({
            type: "wav",
            format: "float32",
            buffer: "recording"
            path: "my-recording.wav"
        });
    });

Multiple synths can be recorded by using Flocking's interconnect bus feature, where a dedicated "recorder" synth will receive its input from an interconnect bus that multiple synths are writing to. For example:

    var synthA = flock.synth({
        synthDef: {
            ugen: "flock.ugen.out",
            bus: 5,
            sources: {
                ugen: "flock.ugen.sin",
                freq: 110
                mul: 0.5
            }
        }
    });

    var synthA = flock.synth({
        synthDef: {
            ugen: "flock.ugen.out",
            bus: 5,
            sources: {
                ugen: "flock.ugen.square",
                freq: 440
                mul: 0.5
            }
        }
    });

    var recorder = flock.synth({
        synthDef: {
            ugen: "flock.ugen.writeBuffer",
            options: {
                duration: 30,
                numOutputs: 4
            },
            buffer: "recording",
            sources: {
                ugen: "flock.ugen.in",
                bus: 5
            }
        },
        addToEnvironment: "tail"
    });
