# Running Flocking in Node.js #

Flocking is configured as an npm module. If you want to use it in a Node.js application, you can add it to your package.json file's dependencies block:

    dependencies: {
        "flocking": "git://github.com/colinbdclark/node-flocking.git"
    }

Then, in your application, use the Fluid Infusion global module loading system to import Flocking:

    var fluid = require("infusion"),
        flock = fluid.require("flocking");

From there, you can use Flocking just as if it were running in a web browser. Keep in mind that, unless you use other third-party packages, there won't be a DOM present, and Fluid Infusion provides only a minimal version of jQuery.


## Running the Flocking Node.js Demos ##

Just run the demo file with the "node" process. For example,

    node nodejs/demos/audio-file.js

or:

    node nodejs/demos/fast-scheduling.js

or:

    node nodejs/demos/filtered-noise-and-sine.js


## An Example Flocking Node.js Project Using Infusion ##

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
            "infusion": "git://github.com/fluid-project/infusion.git",
            "flocking": "git://github.com/colinbdclark/Flocking.git"
        },
        "main": "index.js",
        "engines": {
            "node" : "0.10.x"
        }
    }

And your index.js might look something like this:

    "use strict";

    // Imports Fluid Infusion.
    var fluid = require("infusion"),

        // Gets an Infusion loader for the current directory (i.e. the one index.js is located in)
        loader = fluid.getLoader(__dirname),

        // Imports Flocking
        flock = fluid.registerNamespace("flock");

    // Loads your application.
    loader.require("./lib/app.js");

    // Imports your own personal namespace (which is defined in app.js).
    // Change this so something more appropriate for your application.
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
    var fluid = require("infusion"),
        flock = fluid.require("flocking");

    // Define a namespace for your app.
    fluid.registerNamespace("myStuff.beepy");


    fluid.defaults("myStuff.beepy.synth", {
        gradeNames: ["flock.synth", "autoInit"],

        synthDef: {
            id: "beeper",
            ugen: "flock.ugen.sin",
            freq: 180,
            mul: 0.25
        }
    });

    fluid.defaults("myStuff.beepy.app", {
        gradeNames: ["fluid.eventedComponent", "fluid.modelComponent", "autoInit"],

        members: {
            enviro: "@expand:flock.init()"
        },

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
                                list: [200, 210, 190, 100, 60, 70, 990],
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
                    funcName: "{that}.enviro.start"
                },
                {
                    funcName: "{scheduler}.schedule",
                    args: ["{app}.options.score"]
                }
            ]
        }
    });


To run your Node.js, first install its dependencies:

    npm install

And then you can start your app with:

    node .
