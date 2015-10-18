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

    node nodejs/demos/audio-file.js

or:

    node nodejs/demos/fast-scheduling.js

or:

    node nodejs/demos/filtered-noise-and-sine.js


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
