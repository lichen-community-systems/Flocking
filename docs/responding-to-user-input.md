# Responding to User Input #

There are a variety of ways to connect your Flocking instruments up to sources of user input such as user interface components or touch events. The simplest but perhaps least expressive way to trigger events based on user input is with the `flock.ugen.mouse` unit generators. Alternatively, you can map browser events from user interface components (e.g. buttons, sliders, pianos, whatever) to value changes on your synth's inputs.

## Using the Browser Unit Generators ##

The _flocking-ugens-browser.js_ file contains unit generators that are specifically dependent on browser-based technology, such as DOM events. In particular, the _flock.ugen.mouse_ collection of unit generators provide a means to treat user input as a signal directly within your synth. The advantage of these unit generators is that they can provide a constant stream of values and can be easily smoothed. The downside is that the input modality is hard-coded in your synth design, whereas an event-based approach outside the unit generator graph will make it easier to change the source of events later, or to have multiple simultaneous sources of input.

For more information about the mouse unit generators, see the [Mouse Unit Generators](ugens/mouse.md) documentation.

### Examples ###

#### Changing the frequency of a sine wave oscillator every time the user clicks a button ####

HTML markup:

    <button id="myButton">Change it!</button>

SynthDef:

    {
        ugen: "flock.ugen.sin",
        freq: {
            ugen: "flock.ugen.latch",
            rate: "audio",
            source: {
                ugen: "flock.ugen.lfNoise",
                freq: 10,
                mul: 540,
                add: 660
            },
            trig: {
                ugen: "flock.ugen.mouse.click",
                target: "#myButton"
            }
        }
    }

#### Triggering the playback of a sound file whenever a button is clicked ####

HTML:

    <button id="myButton">Play it!</button>

SynthDef:

    {
        ugen: "flock.ugen.playBuffer",
        buffer: {
            url: "cat.wav"
        },
        trigger: {
            ugen: "flock.ugen.mouse.click",
            options: {
                target: "#myButton"
            }
        }
    }

#### Binding the x and y position of the mouse the frequency and amplitude of a synth, like a Kaoss Pad ####

HTML:

    <div id="chaos"></div>

CSS:

    #chaos {
        height: 200px;
        width: 200px
    }

SynthDef:

    {
        ugen: "flock.ugen.square",
        freq: {
            ugen: "flock.ugen.mouse.cursor",

            // Note that we have to scale this unit generator's output
            // to a value range that is sensible for frequency.
            // By default,cursor outputs values between 0.0 and 1.0.
            mul: 1120
            add: 60
            options: {
                axis: "x",
                target: "#chaos"
            }
        },
        mul: {
            ugen: "flock.ugen.mouse.cursor",
            options: {
                axis: "y",
                target: "#chaos"
            }
        }
    }

## Directly Setting Values on a Synth ##

Flocking synths provide two essental methods that can be used to query and update the state of the synthesis graph: `get()` and `set()`. You can call these methods in response to user input (e.g. a button click) to control a Flocking synth.

For more information about the methods provided by `flock.synth` see the [Synth documentation](synths/overview.md) _coming soon_.

### Tutorial: Using Synth.set() with jQuery ###

First, create a button that the user can click on. We'll wire this button up using jQuery so that it randomly changes the frequency of our synthesizer every time it is clicked. Here's the HTML markup for it:

    <button id="myButton">Change it!</button>

For our example, let's create a noisy synth that uses frequency modulation. The carrier is a sawtooth oscillator, and the modulator is a sine wave. Since we want to be able to dynamically change the modulator whenever a user clicks the button, we'll give it an _id_ so that we can refer to it later when we're calling `Synth.set`.

    var noisy = flock.synth({
        synthDef: {
            ugen: "flock.ugen.lfSaw",
            freq: {
                id: "modulator", // An id lets us refer to this ugen in subsequent calls to set().
                ugen: "flock.ugen.sin",
                freq: 400,
                mul: 540,
                add: 600
            },
            mul: 0.25
        }
    });

We want our example to work on all devices. iOS has a restrict that sounds can only be played as the result of a user action. If you try to start Flocking without the user first having tapped on something, it will be silent. So we'll need to make sure that we only start Flocking after the user has clicked the button for the first time.

To do so, we will bind a one-time click handler on our button. It will start the Flocking _shared environment_ by calling its `play` method. We'll use jQuery's `one()` method to register a handler that automatically gets removed after it has fired once. Here's the code for it:

    $(container).one("click", function () {
        var enviro = flock.init();
        enviro.start();
    });

Next, we'll register a click handler on the button that will randomly change the frequency of the modulator every time the user clicks the button. We'll use jQuery again for this, and call `Synth.set()` to change the _modulator.freq_ input:

    // Every time the button is clicked, change the synth's modulator frequency.
    $(container).click(function () {
        // Randomly update the frequency of the modulator.
        var newFreq = Math.random() * 1000 + 1060;
        noisy.set("modulator.freq", newFreq);
    });

We don't have to set just one input at at a time using `Synth.set()`. Instead, we can specify an object of input path/value pairs whenever a user clicks the button. Try this click handler code instead:

    // Every time the button is clicked, change the synth's modulator frequency and amplitude.
    $(container).click(function () {
        // Randomly update several of the modulator's inputs at once.
        noisy.set({
            "modulator.freq": Math.random() * 1000 + 1060,
            "modulator.add": Math.random() * 1200
        });
    });

Note that if you're not a fan of jQuery, you can use plain DOM methods like ``addEventListener`` or, if you like, use whatever toolkit you prefer. Flocking is designed to be agnostic of your presentation technology.


## Using  Infusion Views and Events ##

[Infusion](http://fluidproject.org/products/infusion) provides a robust system for defining "views" and events. It provides a highly declarative way of binding Flocking instruments up to any source of user input, from individual buttons and sliders to larger-scale interfaces like [pianos](http://github.com/thealphanerd/Piano) and even [physical input devices](https://github.com/colinbdclark/flocking-osc-fm-synth). Here's an example of how an Infusion View can be created, which will listen for click events on an element and dynamically update a synth's inputs.

HTML:

    <!DOCTYPE html>

    <html lang="en">
        <head>
            <title>Very Wow</title>

            <script src="flocking/flocking-all.js"></script>
            <script src="user-input-demo.js"></script>
        </head>

        <body>
            <img id="clickTarget" src="http://wanna-joke.com/wp-content/uploads/2014/01/funny-picture-new-year-doge.jpg" />

            <script>
                userInputDemo.clickSource("#clickTarget");
            </script>
        </body>
    </html>

JavScript:

    (function () {

        "use strict";

        fluid.registerNamespace("userInputDemo");

        // Our instrument.
        fluid.defaults("userInputDemo.doge", {
            gradeNames: ["flock.synth", "autoInit"],

            synthDef: {
                id: "carrier",
                ugen: "flock.ugen.squareOsc",
                freq: 220,
                mul: {
                    id: "modulator",
                    ugen: "flock.ugen.triOsc",
                    freq: {
                        id: "freqRamp",
                        ugen: "flock.ugen.xLine",
                        start: 60,
                        end: 113,
                        duration: 3
                    }
                }
            }
        });

        // Our view component, which takes a "container" argument.
        // In this case, our container represents the thing that is clickable.
        fluid.defaults("userInputDemo.clickSource", {

            // Make an Infusion view component to bind with our markup.
            gradeNames: ["fluid.viewComponent", "autoInit"],

            components: {
                // Make our synth a subcomponent of this view.
                // It will automatically get instantiated for us by Infusion.
                synth: {
                    type: "userInputDemo.doge"
                }
            },

            // "Invokers" are methods on an Infusion component that are
            // configured using IoC expressions.
            invokers: {
                // Define a method that will randomly set values on a line unit generator.
                handleClick: {

                    // Bind this method to the "fireRandomLine" function,
                    // which we define below.
                    funcName: "userInputDemo.clickSource.fireRandomLine",

                    // Pass the synth as well as the click event's
                    // x and y DOM coordinates to the function.
                    args: ["{synth}", "{arguments}.0.clientX", "{arguments}.0.clientY"]
                }
            },

            listeners: {
                // Listen for the event that fires when this component has been fully
                // instantiated.
                onCreate: [
                    // The first time the user clicks, start the Flocking environment.
                    {
                        "this": "{that}.container",
                        method: "one",
                        args: ["click", "{synth}.play"]
                    },

                    // Bind a click handler to our container
                    // that will invoke the "fireRandomLine" method.
                    {
                        "this": "{that}.container",
                        method: "click",
                        args: "{that}.handleClick"
                    }
                ]
            }
        });

        // There will eventually be a declarative syntax to manage these kinds of changes
        // using "value synths" and a more robust expression system. In the meantime,
        // it has to be done by hand.
        userInputDemo.clickSource.fireRandomLine = function (synth, x, y) {
            synth.set({
                "freqRamp.start": synth.get("freqRamp").model.level,
                "freqRamp.end": x + 60,
                "freqRamp.duration": y / 50
            })
        };
    }());

This example might look overly complicated for such a simple task, but the key here is reusability. This _clickSource_ view component represents a reusable "click event" view, into which users can insert their own custom synths and their own custom handlers for user input. As Flocking's declarative approach is expanded, this will become even more data-oriented.

Here's a quick example of how a user could customize this component with their own new logic:

    // Define a new component called a "segmentedClicker",
    // which will track clicks in three different regions of the image.
    fluid.defaults("userInputDemo.segmentedClicker", {

        // Mix in the "clickSource" grade
        gradeNames: ["userInputDemo.clickSource", "autoInit"],

        segmentFreqs: [1760, 880, 220],

        components: {
            // Override the default synth with a noisier one.
            synth: {
                type: "flock.synth",
                options: {
                    synthDef: {
                        id: "carrier",
                        ugen: "flock.ugen.lfNoise",
                        freq: 440,
                        mul: 0.25
                    }
                }
            }
        },

        invokers: {
            // And swap out the handle click invoker with a new implementation.
            handleClick: {
                funcName: "userInputDemo.segmentedClicker.setFreqForSegment",

                // We can even dynamically override the arguments passed to our invoker
                // by drawing from any values currently in IoC's scope.
                // Uber-polymorphism!
                args: ["{synth}", "{that}.options.segmentFreqs", "{that}.container.0.width", "{arguments}.0.clientX"]
            }
        }
    });

    // Divides the target element up into three segments and sets the synth's frequency accordingly.
    userInputDemo.segmentedClicker.setFreqForSegment = function (synth, segmentFreqs, targetWidth, x) {
        // Split the image's x axis up into three different regions.
        // This could be done more efficiently using a "members" expander.
        var regionWidth = targetWidth / segmentFreqs.length,
            regionNum = Math.round(regionWidth / x);

        // Set the synth's frequency.
        synth.set("carrier.freq", segmentFreqs[regionNum]);
    };
