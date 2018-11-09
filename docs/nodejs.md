## Flocking and Node.js ##

Flocking supports Node.js' LTS release. It depends on several third-party Node libraries for audio output and MIDI input.

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

    {
        "name": "flocking-app",
        "description": "A simple of example of using Flocking with Node.js",
        "main": "index.js",
        "version": "1.0.0",
        "author": "Me",
        "license": "MIT",
        "readmeFilename": "README.md",
        "dependencies": {
            "flocking": "1.0.0"
        }
    }

Then, in your application, you can <code>require</code> the Flocking module to load it:

    var flock = require("flocking");

From there, you can use Flocking just as if it were running in a web browser. Keep in mind that, unless you use other third-party packages, there won't be a DOM present.

A Flocking Node.js project is typically laid out in the following directory structure:

    lib/                <-- Contains your project's primary JavaScript files
      app.js
      ...
    node_modules/       <-- Automatically created by npm when installing your project's dependencies
      flocking/
      ...
    index.js            <-- Contains the "bootstrapping" code for your application
    package.json        <-- Configures your app as an npm package.


## A Flocking Node.js Application ##

In your <code>index.js</code> file:

    var flock = require("flocking"),

    fluid.defaults("myStuff.synth", {
        gradeNames: "flock.synth",

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
        },

        listeners: {
            "onCreate.startEnvironment": "{flock.enviro}.start()"
        }
    });

Before you run your application, make sure you install all your dependencies by running <code>npm install</code>

Then start your application by running <code>node .</code> from your project's root.
