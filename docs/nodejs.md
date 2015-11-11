## Flocking and Node.js ##

Flocking supports Node.js versions 0.12.x and 4.2.x. It depends on several third-party Node libraries for audio output and MIDI input.

On Mac and Windows, you shouldn't need any additional dependencies. However, on Linux, the ALSA development library is required.

On Ubuntu and Debian:

    apt-get install libasound2-dev

On Fedora and CentOS:

    yum install alsa-lib-devel


## Running the Flocking Node.js Demos ##

Flocking ships with a handful of Node.js-specific demos. They are located in the <code>demos/nodejs</code> directory. To run them:
* First, run <code>npm install</code> to install all of Flocking's dependencies.
* Next, run the demos using the <code>node</code> command.

For example:

    node demos/nodejs/audio-file.js

or:

    node demos/nodejs/fast-scheduling.js

or:

    node demos/nodejs/filtered-noise-and-sine.js


# Using Flocking With Node.js #

Flocking is available as an npm module. If you want to use it in a Node.js application, you can add it to your package.json file's dependencies block:

    dependencies: {
        "flocking": "0.1.4"
    }

Then, in your application, you can <code>require</code> the Flocking module to load it:

    var flock = require("flocking");

From there, you can use Flocking just as if it were running in a web browser. Keep in mind that, unless you use other third-party packages, there won't be a DOM present.


## A Basic Flocking Node.js Application ##

First, define your <code>package.json</code> file:

    {
        "name": "flocking-app",
        "description": "A simple of example of using Flocking with Node.js",
        "main": "index.js",
        "version": "1.0.0",
        "author": "Me",
        "license": "MIT",
        "readmeFilename": "README.md",
        "dependencies": {
            "flocking": "0.1.4"
        }
    }

Next, write some JavaScript code in your <code>index.js</code>:

    var flock = require("flocking"),
        enviro = flock.init();

    var s = flock.synth({
        synthDef: {
            ugen: "flock.ugen.sin",
            freq: {
                ugen: "flock.ugen.lfNoise",
                freq: 1,
                mul: 180,
                add: 180
            },
            mul: {
                ugen: "flock.ugen.envGen",
                envelope: {
                    type: "flock.envelope.sin",
                    duration: 0.5
                },
                gate: {
                    ugen: "flock.ugen.lfPulse",
                    width: 0.5,
                    freq: 1
                }
            }
        }
    });

    enviro.play();

Before you run your application, make sure you install all your dependencies by running <code>npm install</code>

Then start your application by running <code>node .</code> from your project's root.


## Advanced: Using Flocking with Infusion in Node.js ##

*Note: These instructions will only work with the unreleased Flocking 0.2.0 version.*

A Flocking Node.js project is typically laid out in the following directory structure:

    lib/                <-- Contains your project's primary JavaScript files
      app.js
      ...
    node_modules/       <-- Automatically created by npm when installing your project's dependencies
      flocking/
      ...
    index.js            <-- Contains the "bootstrapping" code for your application
    package.json        <-- Configures your app as an npm package.

Here's an example of a _package.json_ file for a Flocking app:

    {
        "name": "beepy",
        "description": "An application built with Flocking",
        "version": "0.0.1",
        "author": "Me",
        "dependencies": {
            "infusion": "2.0.0-dev.20151007T134312Z.8c33cd4",
            "flocking": "colinbdclark/Flocking.git"
        },
        "main": "index.js"
    }


And your index.js might look something like this:

    "use strict";

    // Imports Fluid Infusion.
    var fluid = require("infusion");

    // Imports Flocking
    var flock = fluid.registerNamespace("flock");

    // Loads your application.
    require("./lib/app.js");

    // Imports your own personal namespace (which is defined in app.js).
    // Change this to something more appropriate for your application.
    var myStuff = fluid.registerNamespace("myStuff");

    // Initializes Flocking with an appropriate buffer size.
    // You'll probably need to tweak this for your app and hardware.
    flock.init({
        bufferSize: 2048
    });

    // Start your application
    myStuff.beepy.app();

In app.js (or whatever files you want to use), you'll define your Flocking code:

    "use strict";

    // Import Infusion and Flocking.
    var fluid = require("infusion");
    var flock = require("flocking");

    fluid.defaults("myStuff.beepy.synth", {
        gradeNames: "flock.synth",

        synthDef: {
            id: "beeper",
            ugen: "flock.ugen.sin",
            freq: 180,
            mul: 0.25
        }
    });

    fluid.defaults("myStuff.beepy.app", {
        gradeNames: "fluid.component",

        components: {
            // Define your synth as a component of your application.
            synth: {
                type: "myStuff.beepy.synth"
            },

            // Define a scheduler for your app.
            scheduler: {
                type: "flock.scheduler.async.tempo",
                options: {
                    bpm: 120
                }
            }
        },

        score: [
            {
                // Schedule this event as repeating
                interval: "repeat",

                // Every beat.
                time: 1.0,

                change: {
                    // This specifies that we want to send the change to the synth named "synth" in our app.
                    synth: "synth",

                    values: {
                        // Every beat, set the value of the dust unit generator's "density" input.
                        "beeper.freq": {
                            // This creates a "value Synth" that will be evaluated every time the scheduler ticks.
                            // The value synth contains a single unit generator, sequence, which will read through
                            // the specified list in a loop.
                            synthDef: {
                                ugen: "flock.ugen.sequence",
                                values: [200, 210, 190, 100, 60, 70, 990],
                                loop: 1.0
                            }
                        }
                    }
                }
            },
        ],

        listeners: {
            onCreate: [
                {

                    func: "{flock.enviro}.start"
                },
                {
                    func: "{scheduler}.schedule",
                    args: ["{app}.options.score"]
                }
            ]
        }
    });
