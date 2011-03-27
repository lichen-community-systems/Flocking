Flocking - Creative audio synthesis for the Web!
================================================

What is Flocking?
-----------------

Flocking is a simple audio synthesis toolkit that runs inside your Web browser. 
It doesn't require Flash or any other proprietary plugins. 
Written entirely in JavaScript, Flocking is designed for artists and musicians who are creating Web-based 
sound projects. It is built on top of Firefox 4's awesome new Audio Data API.

Flocking was inspired by the [SuperCollider](http://supercollider.sourceforge.net/) desktop synthesis 
environment. If you're familiar with SuperCollider, you'll feel at home with Flocking.

Unlike comparable synthesis libraries, Flocking is declarative. Unit generators are wired together into 
synthesizers using a simple JSON-based syntax, making it easy to save and share your synthesis algorithms in plain text.
Send your synths via Ajax, save them for later using HTML5 local data storage, or parse them into formats compatible with 
other synthesis engines. In the future, this JSON-based format will even enable cool authoring tools and 
synthesis environments to be built on top of Flocking.

Flocking is light on dependencies. As of today, it has none. Just drop _Flocking.js_ into your page and go.
While this may change in the future, a primary goal of Flocking is to remain toolkit-agnostic. No classical inheritance 
systems or other funny stuff to buy into. Just plain old objects and functions, written in a largely Good Parts-compatible 
style of JavaScript. You're free to pick the frameworks and tools you love the best.

By the way, if you're looking for a good framework for building jQuery-based applications with Flocking,  
I recommend you check out [Fluid Infusion](http://fluidproject.org/products/infusion).


Status
------
Flocking is an early prototype. It has bugs, it's growing fast, and help is welcome and appreciated.

### Short Term To Dos###
 * Full support for control rate signals in all unit generators
 * Improved synthesis algorithms, especially for sinOsc
 * Simplified synthDef syntax and parser
 * More unit generators!
 * Support for Chrome's Web Audio API
 
 
Using Flocking
--------------

At the moment, there are three key concepts in Flocking: Unit Generators (ugens), Synths, and SynthGraphDefs.

**Unit Generators** are the basic building blocks of synthesis. They have multiple inputs and a single output buffer, and 
do the primary work of generating or processing audio signals in Flocking. A unit generator can be wired up as an input to 
another unit generator, enabling the creation of sophisticated graphs of ugens. Unit generators implement one primary 
method, _gen(numSamps)_, which is responsible for processing the audio signal.

**Synths** represent synthesizer or self-contained bundle of unit generators. They implement _play()_ and _pause()_ 
methods, and expose named unit generators as inputs. Inputs can be modified in real time using the _inputs()_ method. 
For example:

    synth.input("carrier.freq", 440);

There are two signal rates in Flocking: control rate (kr) and audio rate (ar). The synthesis engine will pull sample data 
from unit generators at the control rate (by default, 64 samples). Control rate unit generators are designed for 
slowly changing signals; they produce only a single sample per control period. Audio rate ugens produce values for every 
sample.

**SynthGraphDefs** wire together unit generators and are specified in a declarative markup. They're just JSON,
and don't require any code or special API calls. Since SynthGraphDefs are declarative, they are uniquely suited to 
saving and sharing in plain text. Here's a simple example of a sine oscillator ("carrier") being amplitude modulated 
by another sine oscillator ("mod"):

    {
        id: "carrier",
        ugen: "flock.ugen.sinOsc",
        inputs: {
            freq: 440,
            mul: {
                id: "mod",
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: 1.0
                }
            }
        }
    }

The SynthGraphDef format will be simplified in upcoming releases.

Compatibility
-------------

Flocking currently depends on the Audio Data API in Firefox 4. It won't work on other browsers.

Google has introduced a competing API, the Web Audio API. Support for it is planned in a future version of Flocking.

Licensing
---------

You may use Flocking under the terms of either the MIT or GPL2 Licenses. The text of the MIT and GPL licenses are at 
the root of the Flocking directory. 

Credits
-------

Flocking was written by Colin Clark. It was named after a piece by [James Tenney](http://www.plainsound.org/JTwork.html), 
an early pioneer of computer music. I hope you find this library useful enough to create projects as beautiful and 
inspiring as Jim's _Flocking_.

Thanks to Dave Humphrey and his team for their awesome work on the Firefox 4 Audio Data API. Thanks to Alex Geddie 
for teaching me a ton about synthesis and computer music.
