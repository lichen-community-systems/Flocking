Flocking - Creative audio synthesis for the Web!
================================================

What is Flocking?
-----------------

Flocking is an audio synthesis toolkit that runs inside your Web browser. It doesn't require Flash or any other 
proprietary plugins. Written entirely in JavaScript, Flocking is designed for artists and musicians building 
creative Web-based sound projects. It works in Firefox, Chrome, Safari, and Node.js on Mac OS X, Windows, Linux, iOS, and Android.
    
Unlike comparable synthesis libraries, Flocking is declarative. Its goal is to promote a uniquely community-minded
approach to instrument design and composition. In Flocking, unit generators are wired together using a simple JSON-based specification, making it easy to save, share, and manipulate your synthesis algorithms. Send your synths via Ajax, save them for later using HTML5 local data storage, or algorithmically produce new instruments on the fly.

Because it's just JSON, every instrument you build using Flocking can be easily modified and extended by others without forcing them to fork or cut and paste your code. This declarative approach will also help make it easier to create new authoring, performance, and social tools on top of Flocking.

Flocking was inspired by the [SuperCollider](http://supercollider.sourceforge.net/) desktop synthesis 
environment. If you're familiar with SuperCollider, you'll feel at home with Flocking.


Community
---------

There are two Flocking community mailing lists:

 * [The user list](http://lists.flockingjs.org/listinfo.cgi/users-flockingjs.org) is for asking questions, sharing code, and requesting new features
 * [The dev list](http://lists.flockingjs.org/listinfo.cgi/dev-flockingjs.org) is for discussing development plans, design proposals, and code reviews


Status
------
Flocking is in active development. It has bugs, it's growing fast, and help is welcome and appreciated.

### Short Term To Dos###
 * More unit generators!
   * ADSR and other envelopes
   * Dynamics processors (compressor/limiter)
   * Lots more
 * Full multichannel support and channel expansion
 * The ability to connect one unit generator to multiple inputs
 * Sample-accurate scheduling
 * Major improvements to the Demo Playground/IDE
 * MediaStream-based audio input
 * The ability to record sessions and export an audio file from your browser
 

Getting Started
---------------

Concatenated and minified Flocking files, suitable for development and production respectively, are included in the source code repository in the _dist_ directory. Flocking can also be built manually using Grunt. 

To link to Flocking's development file:

    <!-- This includes Flocking and all its dependencies, including jQuery 2.0 and Infusion 1.5 -->
    <script src="flocking/dist/flocking-all.js"></script>

For more information on using Flocking in a browser, read the [Getting Started](docs/getting-started.md) tutorial. If you want to use Flocking in Node.js, read the [Flocking in Node.js](docs/nodejs.md) tutorial.


Using Flocking
--------------

Flocking consists of a handful of central components, along with declarative specifications for creating them. These include: Unit Generators (ugens), Synths, SynthDefs, Schedulers, and the Environment.

**Unit Generators** are the basic building blocks of synthesis. They have multiple inputs and a single output buffer, and 
they do the primary work of generating or processing audio signals in Flocking. A unit generator can be wired up as an 
input to another unit generator, enabling the creation of sophisticated graphs of ugens. Unit generators implement one 
primary method, _gen(numSamps)_, which is responsible for processing the audio signal. Typically, you never interact directly with unit generators. Instead, you create "unit generator definitions" (ugenDefs) in JSON, and let Flocking take care of creating the actual collection of unit generators. Here's an example of a ugenDef:

    {
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

So, instead of manipulating unit generators directly, you usually interact with Synths instead.

**Synths** represent synthesizers or self-contained bundle of unit generators. Multiple synths can run at the same time,
using shared buffers to create graphs of loosely-coupled signal generators and processors For example, a mixing board Synth 
could be created to mix and process signals from several tone-generating Synths, all without any dependency or awareness 
between them. As a convenience, Synths implement _play()_ and _pause()_ methods and expose named unit generators as inputs. 

A Synth's inputs can be modified in real time by using its _get()_ and _set()_ methods. For example:

Get the value of an input:

    var freq = synth.get("carrier.freq");

Set the value of an input:

    synth.set("carrier.freq", 440);

Set the value of multiple inputs:

    synth.set({
        "carrier.freq": 440,
        "carrier.mul": 0.5,
        "modulator.freq": 123
    });

There are three signal rates in Flocking: control rate (kr), audio rate (ar), and constant rate (cr). The synthesis 
engine will pull sample data from unit generators at the control rate (by default, every 64 samples). Control rate unit 
generators are designed for slowly changing signals; they produce only a single sample per control period. 
Audio rate ugens produce values for every sample.

**SynthDefs** wire together unit generators and are specified using a declarative format. They're just JSON,
and don't require any code or special API calls. Since SynthDefs are declarative, they are uniquely suited to 
saving and sharing in plain text. Here's a simple example of a sine oscillator ("carrier") being amplitude modulated 
by another sine oscillator ("mod"):

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

**The Environment** is the component responsible for evaluating the graph of Synths and outputting their samples to the current audio output strategy. The Environment is a singleton that is, by default, stored at the global path _flock.enviro.shared_. It manages a tree of Synth (or SynthGroup) instances and evaluates them in order, and exposes a set of methods for managing the order of the Synth graph.

The environment needs to be started prior to outputting sound. This can be done by calling the _play()_ method.

Starting the shared Environment:

    flock.enviro.shared.play();

By default, a Synth is automatically added to the tail of the synth graph, which means it will start playing immediately. If you want to defer the playing of a Synth to a later time, you can override the _addToEnvironment_ option when you instantiate it:

    var mySynth = flock.synth({
        synthDef: {
            ugen: "flock.ugen.sin",
            freq: 440
        },
        addToEnvironment: false
    });

To manage the Environment's synth graph manually, you can use the methods provided by flock.nodeList:

Add a synth to the head of the graph (meaning it will be evaluated first):

    flock.enviro.shared.head(mySynth);
    
Add a synth to the tail of the graph (meaning it will be evaluated after all other synths):

    flock.enviro.shared.tail(mySynth);

Synths provide two convenience methods, _play()_ and _pause()_. Under the covers, these methods simply start the Environment if necessary, and then add the synth to the tail of the environment. In the long run, these methods may be removed from the framework to make the relationship between the Environment and Synths clearer to users.

**Schedulers** are components that allow you to schedule changes to Synths over time. Currently, there is one type of Scheduler, the asynchronous scheduler. It is driven by the browser's notoriously inaccurate setTimeout() and setInterval() clocks. A sample accurate scheduler will be provided in a future release of Flocking, but in the meantime the asynchronous scheduler does a decent job of keeping non-robotic time. Here's an example of the declarative powers of the Flocking scheduler:

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
                            buffer: [110, 220, 330, 440, 550, 660, 880]
                        }
                    }
                }
            }
        }
    ]);
    
If you need to, you can always schedule events via plain old functions:

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

Flocking is currently tested on the latest versions of Firefox, Chrome and Safari on Mac, Windows, Linux, iOS, and Android.


Licensing
---------

Flocking is distributed under the terms the MIT or GPL 2 Licenses. Choose the license that best suits your
project. The text of the MIT and GPL licenses are at the root of the Flocking directory. 


Credits
-------

Flocking was written by Colin Clark. It is named after a piece by [James Tenney](http://www.plainsound.org/JTwork.html), 
a composer, thinker, and early pioneer of computer music who was my composition teacher and a huge influence on my work. I hope you find this library useful enough to create projects as beautiful and inspiring as Jim's _Flocking_.

### Thanks to:###
 * [Adam Tindale](http://adamtindale.com) for several of the Playground demos
 * [Johnny Taylor](https://github.com/abledaccess) for styling improvements to the Flocking Playground
 * [Dan Stowell](https://github.com/danstowell) for the Freeverb and Delay1 unit generators
 * [Mayank Sanganeria](http://github.com/e7mac) for his granulator unit generator
 * [Vitus](https://github.com/derDoc) for his contributions to the original interactive Flocking Playground
 * [Myles Borins](https://github.com/thealphanerd) for pushing the limits of Flocking early in its development
 * [Antranig Basman](https://github.com/amb26) for code review and advice
 * Alex Geddie for teaching me a ton about synthesis and computer music
