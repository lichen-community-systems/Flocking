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
        "name": "my-flocking-app",
        "description": "An application built with Flocking",
        "version": "0.0.1",
        "author": "Me",
        "dependencies": {
            "infusion": "git://github.com/fluid-project/infusion.git",
            "flocking": "git://github.com/colinbdclark/Flocking.git",
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
    
    // Defines your own personal namespace. 
    // Change this so something more appropriate for your application.
    var myStuff = fluid.registerNamespace("myStuff");

    // Initializes Flocking with a reasonably small buffer size.
    // You'll probably need to tweak this for your app and hardware.
    flock.init({
        bufferSize: 512
    });
    
    // Start the shared environment.
    flock.enviro.shared.play();
    
    // Start your application
    myStuff.dusty.app();

In app.js (or whatever files you want to use), you'll define your Flocking code:

    "use strict";
    
    // Import Infusion and Flocking.
    var fluid = require("infusion"),
        flock = fluid.require("flocking");

    // Define a namespace for your app.
    fluid.registerNamespace("myStuff.dusty");


    fluid.defaults("colin.dusty.synth", {
        gradeNames: ["flock.synth", "autoInit"],

        synthDef: {
            id: "duster",
            ugen: "flock.ugen.dust",
            density: 200,
            mul: 0.25
        }
    });

    fluid.defaults("colin.dusty.app", {
        gradeNames: ["fluid.eventedComponent", "fluid.modelComponent", "autoInit"],
    
        components: {
            
            // Define your synth as a component of your application.
            synth: {
                type: "colin.dusty.synth"
            },
            
            // Define a scheduler for your app.
            scheduler: {
                type: "flock.scheduler.async.temp",
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
                        "duster.density": {
                            // This creates a "value Synth" that will be evaluated every time the scheduler ticks.
                            // The value synth contains a single unit generator, sequence, which will read through
                            // the specified list in a loop.
                            synthDef: {
                                ugen: "flock.ugen.sequence",
                                list: [200, 210, 190, 100, 40, 10, 70, 1210],
                                loop: 1.0
                            }
                        }
                    }
                }
            },
        ]
    });

