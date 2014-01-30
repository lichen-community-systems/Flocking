# Responding to User Input #

There are a variety of ways to connect your Flocking instruments up to sources of user input such as user interface components or touch events. The simplest but perhaps least expressive way to trigger events based on user input is with the _flock.ugen.mouse_ unit generators. Alternatively, you can map browser events from user interface components (e.g. buttons, sliders, pianos, whatever) to input value changes on your synths.

## Browser Unit Generators ##

The _flocking-ugens-browser.js_ file contains unit generators that are specifically dependent on browser-based technology, such as DOM events. In particular, the _flock.ugen.mouse_ collection of unit generators provide a means to represent user input as a "signal" or stream of samples directly within your synth. The advantage of these unit generators is that they can provide a constant stream of values and can be easily smoothed. The downside is that the input modality is hard-coded in your synth design, whereas an event-based approach outside the unit generator graph will make it easier to change the source of events later.

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
