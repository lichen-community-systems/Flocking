# Getting Started With Flocking #

Flocking is distributed as an [npm](https://npmjs.com) package, which includes prebuilt files in the <code>dist</code> directory that can be used in most common cases. [Custom builds can be generated](building-flocking.md) if needed.

To use Flocking, make sure have [Node.js](https://nodejs.org) installed, and then include Flocking as a dependency in your <code>package.json</code> file:

    {
        "name": "my-project",
        "dependencies": {
            "flocking": "1.0.0"
        }
    }

From the command line, run <code>npm install</code> to install Flocking and your other dependencies.

Then, include Flocking's prebuilt JavaScript file, <code>node_modules/flocking/dist/flocking-all.js</code> in your web page using a script tag. This file contains all of Flocking, along with its dependencies, packaged up as a single file.

    <!-- This includes Flocking and all its dependencies, including jQuery and Infusion -->
    <script src="node_modules/flocking/dist/flocking-all.js"></script>

## Example HTML Page ##

Here is an example of an HTML page that uses Flocking, which you can use as a template for your own projects:

    <!DOCTYPE html>

    <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>A Flocking Project</title>

            <script src="node_modules/flocking/dist/flocking-all.js"></script>
            <script src="myStuff.js"></script>

        </head>

        <body>
            <!-- Your markup goes here -->

            <script>
                <!-- A one-line script block for instantiating your Flocking code. -->
                myStuff.composition();
            </script>
        </body>
    </html>

## Example JavaScript ##

    // Define an Infusion component that represents your instrument.
    fluid.defaults("myStuff.sinewaver", {
        gradeNames: ["flock.synth"],

        // Define the synthDef for your instrument.
        synthDef: {
            id: "carrier",
            ugen: "flock.ugen.sin",
            freq: 220,
            mul: 0.5
        }
    });


    // Define an Infusion component that represents your composition.
    fluid.defaults("myStuff.composition", {
        gradeNames: ["fluid.component"],

        // This composition has two components:
        //  1. our sinewaver instrument (defined above)
        //  2. an instance of the Flocking environment
        components: {
            environment: {
                type: "flock.enviro"
            },

            instrument: {
                type: "myStuff.sinewaver"
            }
        },

        // This section registers listeners for our composition's "onCreate" event,
        // which is one of the built-in lifecycle events for Infusion.
        // When onCreate fires, we start the Flocking environment.
        listeners: {
            "onCreate.startEnvironment": {
                func: "{environment}.start"
            }
        }
    });
