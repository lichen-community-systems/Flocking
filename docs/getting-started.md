# Getting Started With Flocking #


## The Simplest Way ##

The Flocking source code is hosted on Github, a community for sharing and contributing code using the [Git](http://git-scm.com/) distributed version control system. In the long run, you'll find that learning how to use Github and Git will be very helpful in using Flocking and other open source web toolkits. But it's not required. Here's how to get started with Flocking without using Git or Github.

1. Go to the [Flocking releases page](https://github.com/colinbdclark/flocking/releases) on Github
2. Download the latest stable release
3. Unzip Flocking and copy the _dist_ directory into your project. You'll probably want to rename it to <code>flocking</code> or the something more descriptive.
4. Link Flocking's JavaScript file, <code>flocking-all.js</code> to your web page using a script tag. This file contains all of Flocking, along with its dependencies, packaged up as a single file.

Here's how:

    <!-- This includes Flocking and all its dependencies, including jQuery 2.0 and Infusion 1.5 -->
    <script src="flocking/flocking-all.js"></script>

## Example HTML Page ##

Here is an example of an HTML page that uses Flocking, which you can use as a template for your own projects:

    <!DOCTYPE html>

    <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>A Flocking Project</title>

            <script src="flocking/flocking-all.js"></script>
            <script src="myStuff.js"></script>

        </head>

        <body>
            <!-- Your markup goes here -->

            <script>
                myStuff.play();
            </script>
        </body>
    </html>


And an example JavaScript file:

    // Wrap everything in a function to keep your stuff private.
    (function () {

        // JavaScript strict mode is a good thing.
        "use strict";

        // Define a unique global namespace for your stuff.
        // You should change this to a namespace that is appropriate for your project.
        fluid.registerNamespace("myStuff");

        var enviro = flock.init();

        // Expose any public functions or constructors as properties on your namesapce.
        myStuff.play = function () {
            var mySynth = flock.synth({
                synthDef: {
                    ugen: "flock.ugen.sin",
                    freq: {
                        ugen: "flock.ugen.lfNoise",
                        freq: 10,
                        mul: 380,
                        add: 60
                    },
                    mul: 0.1
                }
            });

            // If you're on iOS, you will need to call in a listener for
            // some kind of user input action, such a button click or touch handler.
            // This is because iOS will only play sound if the user initiated it.
            enviro.start();
        };

    }());

## For Experienced Web Developers ##

Flocking is hosted on Github. Here's how to get started:

* Clone the [Flocking repository](https://github.com/colinbdclark/Flocking.git)
* Run _npm install_ to install Flocking's dependencies
* Run _grunt_ to make a build of Flocking
* Copy the _dist_ directory into your project. You probably will want to rename it to something like _flocking_
* Use the _flocking-all.js_ for development for _flocking-all.min.js_ for production.
* The other two files, _flocking-audiofile-worker.js_ and _flocking-audiofile.js_ will be loaded automatically into a Web Worker when decoding audio files.


### Linking to a Flocking Build ###

Concatenated and minified Flocking files are committed to the source code repository, and can also be built manually using Grunt. Here's how to link to them in your page:

    <!-- This includes Flocking and all its dependencies, including jQuery 2.0 and Infusion 1.5 -->
    <script src="flocking-all.js"></script>


### Linking to Individual Flocking Files (for development) ###

If you'd prefer to link to the individual Flocking files during development, these are the basic required dependencies:

    <!-- jQuery -->
    <script src="flocking/third-party/jquery/js/jquery.js"></script>

    <!-- Infusion -->
    <script src="flocking/third-party/infusion/js/Fluid.js"></script>
    <script src="flocking/third-party/infusion/js/FluidIoC.js"></script>
    <script src="flocking/third-party/infusion/js/DataBinding.js"></script>

    <!-- The DSP API Polyfill -->
    <script src="flocking/third-party/dspapi/js/dspapi.js"></script>

    <!-- Flocking -->
    <script src="flocking/flocking/flocking-core.js"></script>
    <script src="flocking/flocking/flocking-scheduler.js"></script>
    <script src="flocking/flocking/flocking-webaudio.js"></script>
    <script src="flocking/flocking/flocking-parser.js"></script>
    <script src="flocking/flocking/flocking-ugens.js"></script>
    <script src="flocking/flocking/flocking-envelopes.js"></script>
    <script src="flocking/flocking/flocking-ugens-browser.js"></script>
    <script src="flocking/flocking/flocking-ugens-bandlimited.js"></script>


In addition, if you're working with audio files, these files are required:

    <script src="../../../flocking/flocking-buffers.js"></script>
    <script src="../../../flocking/flocking-audiofile.js"></script>

If you need to use AIFF files, which aren't supported in some browsers, you can include:

    <script src="../../../flocking/flocking-audiofile-compatibility.js"></script>

If you're using the flock.ugen.scope unit generator, you'll also need:

    <script src="../../../flocking/flocking-gfx.js"></script>

If you want to use a MIDI controller with Flocking (currently only in Chrome), you'll need:

    <script src="../../../flocking/flocking-webmidi.js"></script>


## Using Flocking with Infusion ##

[Infusion](http://fluidproject.org/products/infusion) is a framework for building applications in JavaScript. Flocking itself is built with Infusion, and it provides much of the core flexibility and social opportunities that Flocking aspires to.

Fluid components are created by defining JSON "component trees", which are managed by an Inversion of Control system that is responsible for wiring up dependencies between components. Here's an example of how you would use Flocking with Infusion.

    (function () {

        // Define a unique global namespace for your stuff.
        // You should change this to a namespace that is appropriate for your project.
        fluid.registerNamespace("myStuff");

        // Define an Infusion component that represents your instrument.
        fluid.defaults("myStuff.sinewaver", {

            // This instrument is a flock.synth, and ask Infusion to automatically
            // define an initialization function for it.
            gradeNames: ["flock.synth", "autoInit"],

            // Define the synthDef for your instrument.
            synthDef: {
                id: "carrier",
                ugen: "flock.ugen.sin",
                freq: 220,
                mul: 0.5
            }
        });


        // Define an Infusion component that represents your composition,
        // and which will contain instruments, a scheduler, and score.
        fluid.defaults("myStuff.composition", {

            gradeNames: ["fluid.eventedComponent", "autoInit"],

            members: {
                enviro: "@expand:flock.init"
            },

            // This composition has two components:
            //  1. our sinewaver instrument (defined above)
            //  2. a tempo scheduler running at 60 bpm
            components: {
                instrument: {
                    type: "myStuff.sinewaver"
                },

                clock: {
                    type: "flock.scheduler.async.tempo",
                    options: {
                        bpm: 60
                    }
                }
            },

            // The score is a declarative specification that can be passed to
            // Scheduler.schedule(). In this case, the pitch will change every
            // beat until it hits 1210 Hz, and then it will fade out.
            score: [
                {
                    // Schedule this event as repeating
                    interval: "repeat",

                    // Every beat.
                    time: 1.0,

                    change: {
                        // This specifies that we want to send the change to the "sinewaver" synth.
                        synth: "sinewaver",
                        values: {
                            "carrier.freq": {
                                // This creates a "value Synth" that will be evaluated every time the scheduler ticks.
                                // The value synth contains a single unit generator, sequence, which will read through
                                // the specified list.
                                synthDef: {
                                    ugen: "flock.ugen.sequence",
                                    list: [330, 440, 550, 660, 880, 990, 1100, 1210]
                                }
                            }
                        }
                    }
                },

                {
                    // Schedule this event only once
                    interval: "once",

                    // After 8 beats.
                    time: 8,

                    change: {
                        synth: "sinewaver",

                        // Inject a new "line" unit generator to fade out.
                        values: {
                            "carrier.mul": {
                                ugen: "flock.ugen.line",
                                start: 0.25,
                                end: 0.0,
                                duration: 1.0
                            }
                        }
                    }
                }
            ],

            // This section registers listeners for our composition's "onCreate" event,
            // which is one of the built-in lifecycle events for Infusion.
            // When onCreate fires, we start the environment and then schedule our score with the Scheduler.
            listeners: {
                onCreate: [
                    {
                        func: "{that}.enviro.start"
                    },
                    {
                        funcName: "{clock}.schedule",
                        args: ["{composition}.options.score"]
                    }
                ]
            }
        });
    }());

And here's the HTML page to go with it:

    <!DOCTYPE html>

    <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>A Flocking Project</title>

            <script src="flocking/flocking-all.js"></script>
            <script src="myStuff.js"></script>

        </head>

        <body>
            <!-- Your markup goes here -->

            <script>
                myStuff.composition();
            </script>
        </body>
    </html>
