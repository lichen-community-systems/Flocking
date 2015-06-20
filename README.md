Flocking - Creative audio synthesis for the Web!
================================================

What is Flocking?
-----------------

Flocking is a JavaScript audio synthesis framework designed for artists and musicians
who are building creative and experimental Web-based sound projects.
It supports Firefox, Chrome, Safari, and Node.js on
Mac OS X, Windows, Linux, iOS, and Android.

Unlike comparable tools, Flocking is declarative. Its goal is to promote a uniquely
community-minded approach to instrument design and composition.
In Flocking, unit generators and synths are specified as JSON,
making it easy to save, share, and manipulate your synthesis algorithms.
Send your synths via Ajax, save them for later using HTML5 local data storage,
or algorithmically produce new instruments on the fly.

Because it's just JSON, every instrument you build using Flocking can be easily modified
and extended by others without forcing them to fork or cut and paste your code.
This declarative approach will also help make it easier to create new authoring,
performance, metaprogramming, and social tools on top of Flocking.

Flocking was inspired by the [SuperCollider](http://supercollider.sourceforge.net/)
desktop synthesis environment. If you're familiar with SuperCollider,
you'll feel at home with Flocking.

To learn more about Flocking's architecture and approach, please see:

Clark, C. and Tindale, Adam. "[Flocking: A Framework for Declarative Music-Making on the Web](https://github.com/colinbdclark/flocking-papers/blob/master/icmc-2014/flockingicmc2014.pdf?raw=true)"
in Georgaki, A. and Kouroupetroglou (eds.). _The Joint Proceedings of the ICMC and SMC_, (2014).
_[slides](colinclark.org/presentations/flocking-icmc-2014-slides.pdf)_



Community
---------

Flocking has an inclusive and supportive community with several forums where you can ask for help
and share the projects you're working on.

### Mailing List
The [flocking mailing list](http://lists.idrc.ocadu.ca/mailman/listinfo/flocking)
is the place to ask questions, share code, and request new features.

### Chat
Flocking has an IRC channel. Join <code>#flocking</code> on <code>irc.freenode.net</code>.


Status and Roadmap
------------------

Flocking is in active development. It has bugs and it is growing quickly.

The project's [development roadmap](https://github.com/colinbdclark/Flocking/wiki/Release-Plan)
is documented in the wiki. Plans include:
 * Better support for interleaving Flocking unit generators with Web Audio API nodes
 * A new format for specifying connections between unit generators
 * A "live data merging" environment for live coding
 * Graphical editing of Flocking synth defs
 * A block-accurate scheduler and more sample-accurate scheduling unit generators
 * Multichannel expansion

Unplanned features, bug fixes, and contributions are welcome and appreciated, of course.


Documentation and Demos
-----------------------

* Flocking's [documentation](docs/) is in the repository
* Demos can be found in the [Flocking Playground](http://flockingjs.org/demos/interactive/html/playground.html)
* Other examples are located in the [examples repository](http://github.com/colinbdclark/flocking-examples)


Getting Started
---------------

The latest stable release of Flocking is version 0.1.2. It can be downloaded from the [Flocking releases](https://github.com/colinbdclark/Flocking/releases) page.

Concatenated and minified Flocking builds, suitable for development and production respectively,
are included in the [dist directory](dist/). Flocking can also be built manually using Grunt.

Here's how to include Flocking's development file in your HTML page:

    <!-- This includes Flocking and all its dependencies, including jQuery 2.1.3 and Infusion -->
    <script src="flocking/dist/flocking-all.js"></script>


For more information on using Flocking in a browser,
read the [Getting Started](docs/getting-started.md) tutorial.
If module loaders are your thing, Flocking also supports the CommonJS and AMD styles.

If you're interested in using Flocking with Node.js,
read the [Flocking in Node.js](docs/nodejs.md) tutorial.


Using Flocking
--------------

Flocking consists of a handful of primary components that are configured using JSON
specifications. These include: Unit Generators (ugens), Synths, Schedulers, and the Environment.

### Unit Generators ##

Unit generators, or _ugens_ for short, are the basic building blocks of synthesis;
they do the work of generating or processing audio signals in Flocking.
UGens have multiple inputs and a single output. Some unit generators support
multiple input or output multiple channels.

A unit generator can be wired to other unit generators,
supporting sophisticated signal processing graphs.
Unit generators implement one primary method, <code>gen(numSamps)</code>,
which is responsible for processing a block of audio samples.

Typically, however, you never need to interact with unit generator instances directly.
Instead, you create declarative "unit generator definitions" (_ugenDefs_) objects,
letting Flocking take care of creating the actual unit generator instances.
UGenDefs are composed into trees called _synthDefs_.
Here's an example of a ugenDef:

    {
        id: "carrier",             // A unique ID used when updating this ugen's input values.

        ugen: "flock.ugen.sinOsc", // The fully-qualified name of the desired unit generator,
                                   // specified as a "key path" (a dot-separated string).

        rate: "audio",             // The rate at which the unit generator should run.

        inputs: {                  // The input values for this unit generator. Each UGen has different inputs.
            freq: 440              // For convenience, these inputs don't need to be nested inside the "inputs"
        },                         // container, but you might want to for readability.

        options: {
            interpolation: "linear" // Other non-signal options such as interpolation rates, etc.
                                    // Options are also specific to the type of unit generator.
        }
    }

### Synths ###

A Synth is a self-contained collection of unit generators that represents a
synthesizer, instrument, or signal processor of some kind.
Multiple synths can run at the same time, and they can be connected together
using shared interconnect buses.
For example, a mixing board Synth could be created to mix and process signals from
several tone-generating Synths and effect Synths.

To create a synth, you specify a <code>synthDef</code> option, which is a declarative
tree of unit generator definitions. Here's a simple example of a sine oscillator (named _carrier_)
whose amplitude is modulate by another sine oscillator, _mod_:

    {
        id: "carrier",                  // Name this unit generator "carrier," exposing it as an input to the synth.
        ugen: "flock.ugen.sinOsc",      // Sine oscillator ugen.
        freq: 440,                      // Give it a frequency of 440 Hz, or the A above middle C.
        mul: {                          // Modulate the amplitude of this ugen with another ugen.
            id: "mod",                      // Name this one "mod"
            ugen: "flock.ugen.sinOsc",      // Also of type Sine Oscillator
            freq: 1.0                       // Give it a frequency of 1 Hz, or one wobble per second.
        }
    }

Synths can be updated in realtime by using the <code>get()</code> and <code>set()</code> methods.
Any unit generator with an <code>id</code> property in its ugenDef will automatically be
exposed as a named input to the synth. To update a unit generator, a _key path_ is used to specify
the desired input. Key paths are dot-delimited, path-like strings that allow you to address any part of the
unit generator tree. Here's an example of a key path:

    "carrier.freq.mul" // Refers to the amplitude (mul) of the carrier's frequency.

#### Getting Synth Inputs ####

An input can be retrieved from a synth by invoking the <code>get()</code> method with a key path.
If the target of the path is a _value unit generator_, its value will be returned directly.
If it is any other kind of input, its ugen instance will be returned instead.

    var freq = synth.get("carrier.freq");

#### Setting Synth Inputs ###

Synth inputs can be set by calling the aptly-named <code>set()</code> method.
Flocking's signal processing pipeline is dynamic, so unit generators can be added
or replaced at any time. Behind the scenes, everything is a unit generator,
even static values.

Updating a value:

    synth.set("carrier.freq", 440);

Replacing the target unit generator with a new one:

    synth.set("carrier.freq", {
        ugen: "flock.ugen.sinOsc",
        freq: 2
    });

Updating multiple inputs at once:

    synth.set({
        "carrier.freq": 440,
        "carrier.mul": 0.5,
        "modulator.freq": 123
    });


### Rates ###

To ensure reasonable performance on resource-constrained devices such as phones and low-power computers
(e.g. Chromebooks, Raspberry Pi), Flocking uses a block-based architecture. By default, ugens and synths will
produce 64 samples per block. This value is configurable by specifying the <code>blockSize</code>
option when initializing Flocking.

There are three primary types of signal rates in Flocking: <code>audio</code>, <code>control</code>,
and <code>constant</code>. Audio rate produces a full block of samples,
control rate produces one sample per block, and constant rate will alway produce the same value.
Synths also support two other rates, <code>demand</code> and <code>scheduled</code>. A demand rate synth
will only produce a value when its <code>gen()</code> method is invoked. Scheduled synths are under the
control of a scheduler instead of the sample output clock.


### The Environment ##

An Environment represents a whole "audio system" or "context" in Flocking.
It is responsible for evaluating all Synths instances and outputting their samples to the
current audio output strategy. An environment manages a list of Synth instances and evaluates them in order.
You should instantiate only one <code>flock.enviro</code> for your entire application.

The Flocking _shared environment_ is created by calling <code>flock.init()</code>:

    var enviro = flock.init();

Before you'll hear any sound, the environment needs to be started. You only need to start the environment once.
This is done using the <code>start()</code> method:

    enviro.start();

To stop the environment from generating samples, use the <code>stop()</code> method:

    enviro.stop();

#### Synths and the Environment ####

By default, synths are automatically added to the end (or _tail_) of the environment's list of synths.
This means that synths will start playing immediately when you create them.

If you want to defer the playing of a Synth to a later time,
you can override the <code>addToEnvironment</code> option when you instantiate it:

    var mySynth = flock.synth({
        synthDef: {
            ugen: "flock.ugen.sin",
            freq: 440
        },
        addToEnvironment: false
    });

If you need to manage the Environment's list of synths manually,
you can use the methods provided by the flock.nodeList _grade_.

To add a synth to the head of the graph so that it will be evaluated first:

    enviro.head(mySynth);

To add a synth to the tail of the graph so that it will be evaluated after all other synths):

    enviro.tail(mySynth);


### Schedulers ###

A scheduler allows you to schedule changes to Synths at a particular time.
Currently, there is one type of Scheduler, the asynchronous scheduler.
Unfortunately, it is driven by the browser's notoriously inaccurate setTimeout() and setInterval() clocks,
which means that it will drift by up to 75 ms depending on the browser's load. In practice, however, this drift is
sufficient for scheduling many kinds of changes, and if sample-level accuracy is needed,
unit generators such as <code>flock.ugen.sequence</code>, <code>flock.ugen.change</code> and  
<code>flock.ugen.random</code> can be used.

A block-accurate scheduler is planned for an upcoming release of Flocking.
In the meantime the asynchronous scheduler does a decent job of keeping "pleasantly inaccurate" time.

Here's an example of the declarative powers of the Flocking scheduler:

    var scheduler = flock.scheduler.async();
    scheduler.schedule([
        {
            interval: "repeat",       // Schedule a repeating change
            time: 0.25,               // Every quarter of a second.
            change: {
                synth: "sin-synth",   // Update values a synth with the global nickname "sin-synth".
                values: {
                    "carrier.freq": { // Change the synth's frequency by scheduling a demand-rate
                        synthDef: {   // Synth that generate values by iterating through the list.
                            ugen: "flock.ugen.sequence",
                            loop: 1.0,
                            list: [110, 220, 330, 440, 550, 660, 880]
                        }
                    }
                }
            }
        }
    ]);

If you need to, you can always schedule arbitrary events using plain old functions:

    // Fade out after 10 seconds.
    scheduler.once(10, function () {
        synth.set({
            "carrier.mul.start": 0.25,
            "carrier.mul.end": 0.0,
            "carrier.mul.duration": 1.0
        });
    });

The Flocking scheduler is still under active development and its API will change as it evolves.


Compatibility
-------------

Flocking is currently tested on the latest versions of Firefox, Chrome and Safari
on Mac, Windows, Linux, iOS, and Android. Node.js 0.10.x is also supported.


License
---------

Flocking is distributed under the terms of both the MIT or GPL 2 Licenses.
As a result, you can choose the license that best suits your
project. The full text of Flocking's [MIT](MIT_LICENSE.txt) and [GPL](GPL-LICENSE.txt) licenses are at the root of the repository.


Credits
-------

Flocking is developed by Colin Clark and the community.
It was named after a composition by [James Tenney](http://www.plainsound.org/JTwork.html),
a composer, thinker, and early pioneer of computer music who was my composition teacher and a
huge influence on my work. I hope you find this library useful enough to create projects as
beautiful and inspiring as Jim's _Flocking_.

### Thanks to:###
 * [Adam Tindale](http://adamtindale.com) for several of the Playground demos
 * [Johnny Taylor](https://github.com/abledaccess) for styling improvements to the Playground
 * [Dan Stowell](https://github.com/danstowell) for the Freeverb and Delay1 unit generators
 * [Mayank Sanganeria](http://github.com/e7mac) for the <code>flock.ugen.granulator</code> unit generator
 * [Vitus](https://github.com/derDoc) for his contributions to the original version of the interactive Playground
 * [Myles Borins](https://github.com/thealphanerd) for pushing the limits of Flocking early in its development
 * [Antranig Basman](https://github.com/amb26) for code review, architectural advice, and help with maths
 * Alex Geddie for teaching me a ton about synthesis and computer music
