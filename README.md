Flocking - Creative audio synthesis for the Web!
================================================

What is Flocking?
-----------------

Flocking is an audio synthesis toolkit that runs inside your Web browser. It doesn't require Flash or any other 
proprietary plugins. Written entirely in JavaScript, Flocking is designed for artists and musicians building 
creative Web-based sound projects. It is built on top of Firefox 4's awesome new Audio Data API and WebKit's 
WebAudio API.

Flocking was inspired by the [SuperCollider](http://supercollider.sourceforge.net/) desktop synthesis 
environment. If you're familiar with SuperCollider, you'll feel at home with Flocking.

Unlike comparable synthesis libraries, Flocking is declarative. Unit generators are wired together using a 
simple JSON-based syntax, making it easy to save and share your synthesis algorithms in plain text.
Send your synths via Ajax, save them for later using HTML5 local data storage, or parse them into formats compatible with 
other synthesis engines. In the future, this JSON-based format will also enable cool authoring tools and 
synthesis environments to be built on top of Flocking.

Flocking is light on dependencies. As of today, it has none. Just drop _Flocking.js_ into your page and go.
While this may change in the future, a primary goal of Flocking is to remain toolkit-agnostic. No classical inheritance 
systems or other funny stuff to buy into. Just plain old objects and functions, written in a largely Good Parts-compatible 
style of JavaScript. You're free to pick the frameworks and tools you love the best.

By the way, if you're looking for a good framework for building jQuery applications with Flocking, I recommend you check 
out [Fluid Infusion](http://fluidproject.org/products/infusion).


Status
------
Flocking is an early prototype. It has bugs, it's growing fast, and help is welcome and appreciated.

### Short Term To Dos###
 * "Hackable" demos with an inline code editor, Canvas based-scope, and keyboard
 * More unit generators!
 
 
Using Flocking
--------------

At the moment, there are four key concepts in Flocking: Unit Generators (ugens), Synths, SynthDefs, and the Environment.

**Unit Generators** are the basic building blocks of synthesis. They have multiple inputs and a single output buffer, and 
they do the primary work of generating or processing audio signals in Flocking. A unit generator can be wired up as an 
input to another unit generator, enabling the creation of sophisticated graphs of ugens. Unit generators implement one 
primary method, _gen(numSamps)_, which is responsible for processing the audio signal.

**Synths** represent synthesizers or self-contained bundle of unit generators. Multiple synths can run at the same time,
using shared buffers to create graphs of loosely-coupled signal generators and processors For example, a mixing board Synth 
could be created to mix and process signals from several tone-generating Synths, all without any dependency or awareness 
between them. As a convenience, Synths implement _play()_ and _pause()_ methods and expose named unit generators as inputs. 
Inputs can be modified in real time using the _inputs()_ method. For example:

    synth.input("carrier.freq", 440);

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
            rate: "control",                // This oscillator changes slowly, so it can run at control rate.
            freq: 1.0                       // Give it a frequency of 1 Hz, or one wobble per second.
        }
    }

Compatibility
-------------

Flocking works with Firefox 4's Audio Data API and WebKit's Web Audio API. Web Kit support is limited to Chrome 10 at 
the moment. It won't work on other browsers.

Web Audio support in Chrome is still experimental, so you need to manually configure it before it will play audio. 
To set it up, type "about:flags" into the URL bar and enable the "Web Audio" option at the bottom of the list.

Licensing
---------

Flocking is distributed under the terms the MIT or GPL2 Licenses. Choose the license that best suits your
project. The text of the MIT and GPL licenses are at the root of the Flocking directory. 

Credits
-------

Flocking was written by Colin Clark. It is named after a piece by [James Tenney](http://www.plainsound.org/JTwork.html), 
a composer, thinker, and early pioneer of computer music who was, as my composition teacher, a huge influence on me. 
I hope you find this library useful enough to create projects as beautiful and inspiring as Jim's _Flocking_.

Thanks to Dave Humphrey and his team for their awesome work on the Firefox 4 Audio Data API. Thanks to Alex Geddie 
for teaching me a ton about synthesis and computer music.
