# Creating Synths

## Instantiating a new synth

Synths can be instantiated imperatively by calling the <code>flock.synth()</code> creator function. This function takes a single argument, an _options_ object. These options are merged with <code>flock.synth</code>'s defaults and a new synth instance is returned.

    var synth = flock.synth({
        synthDef: {
            ugen: "flock.ugen.sinOsc"
        }
    });

If you're creating a synth in the context of another component such as a <code>flock.band</code>, you can declare it as a "subcomponent" in the <code>components</code> option of your band and Flocking will automatically instantiate it for you.

    var band = flock.band({
        components: {
            bass: {
                type: "flock.synth",
                options: {
                    synthDef: {
                        ugen: "flock.ugen.square",
                        freq: 60,
                        mul: {
                            ugen: "flock.ugen.asr",
                            attack: 0.01,
                            sustain: 0.5,
                            release: 0.1
                        }
                    }
                }
            },

            drums: {
                type: "flock.synth",
                options: {
                    synthDef: {
                        ugen: "flock.ugen.playBuffer",
                        buffer: "snare"
                    }
                }
            }
        }
    });
## Synth Options

### Synth Definitions

There are a number of options that can be specified when creating a synth. The most important of these is the _synth definition_, which is specified by the <code>synthDef</code> option. Synth definitions describe a complete instrument to be instantiated by the Flocking framework. Specifically, a synthDef consists a of collection of unit generator definitions and their wiring.

A synth definition typically includes a connection to an output bus, either to the speakers or one of the Environment's shared interconnect buses. If an output unit generator is omitted from a synthDef, it will be automatically injected by the Flocking interpreter. Here is a simple example of a synthDef that outputs two sine waves, one in each stereo channel:

    {
        synthDef: {
          ugen: "flock.ugen.out",
          sources: [
            {
              ugen: "flock.ugen.sinOsc"
            },
            {
              ugen: "flock.ugen.sinOsc",
              freq: 444
            }
          ]
        }
    }

This example also illustrates a key aspect of how options and defaults work in Flocking. Options are merged (or overlaid) on top of a synth's defaults. So, in the case of the first unit generator, we have omitted all its input values. When the synth is instantiated, it will automatically be given a frequency of 440 Hz and an amplitude of 1.0. This is due to the fact that every built-in unit generator declares a set of default values. The Flocking interpreter, prior to instantiating the unit generator, will merge the user's values on top of the defaults. If a property is omitted, the default value will be retained; if a user specifies a property, it will be used in place of the default.

### addToEnvironment

By default, synths are automatically added to the tail of the Environment's list of nodes to evaluate, so they will start sounding immediately if the Environment has been started. This can be overridden with the <code>addToEnvironment</code> option:

    var synth = flock.synth({
        synthDef: {
            ugen: "flock.ugen.sinOsc"
        },

        addToEnvironment: false
    });

The <code>addToEnvironment</code> option supports several possible values:

<table>
    <tr>
        <th>Value</th>
        <th>Description</th>
    </tr>
    <tr>
        <td><code>true</code>, <code>"tail"</code></td>
        <td>The synth will be automatically added to the tail of the environment.
        This is the default value. </td>
    </tr>
    <tr>
        <td><code>false</code></td>
        <td>The synth will not be added to the environment's list of active nodes.</td>
    </tr>
    <tr>
        <td><code>"head"</code></td>
        <td>The synth will be added to the head of the environment's list of active nodes.</td>
    </tr>
</table>


## Defining Your Own Synth Grade

In many cases, you will want to define your own custom type of synth so that you can easily create different instances of it with different values.

In Flocking, "types" are referred to as [_grades_](https://github.com/fluid-project/infusion-docs/blob/master/src/documents/ComponentGrades.md). This is approach and terminology is based on [Fluid Infusion](https://github.com/fluid-project/infusion-docs/blob/master/src/documents/README.md), the application framework with which Flocking is built. A grade is a JSON object that describes how a particular component should be created and configured. At instantiation time, all of a component's grade documents are gathered and merged (or [mixed in](http://en.wikipedia.org/wiki/Mixin)) together.

### Namespaces

In Flocking, all grades are organized in a global, hierarchical namespace. Flocking's built-in components and functions are all located within the <code>flock</code> namespace. Your own synths and other code should be organized in your unique namespace, which can be named anything you want. For example, your name or the name of your composition.

In this example, the <code>drift</code> namespace is used:

    fluid.registerNamespace("drift");

Since namespaces are hierarchical, you can define sub-namespaces for particular types of components. The namespace hierarchy is represented with dots. For example, all Flocking unit generators are grouped into the <code>flock.ugen</code> namespace. You might, for example, want to group all your synths together in a <code>synths</code> sub-namespace:

    fluid.registerNamespace("drift.synths");


### Custom Grades

When you've decided on a namespace, you can define your synth grades within it. Grades are defined by calling <code>fluid.defaults()</code>, which registers your custom component with the Infusion defaults registry. The first argument is the fully-qualified name of your custom synth grade, followed by an object that contains all its default values.

    fluid.defaults("drift.synths.grainSynth", {
        gradeNames: ["flock.synth", "autoInit"],
        synthDef: {
            ugen: "flock.ugen.triggerGrains",
            speed: 2.0
        }
    });

The <code>gradeNames</code> option allows you declare any parent grades that you'd like to mix into your component. In this case, we're extending <code>flock.synth</code>, so we specify it as the first parent grade name. The <code>autoInit</code> grade tells the Infusion framework that you want it to automatically provide a creator function for your grade and place it in your namespace.

New instances of your custom synth can then be instantiated like this:

    var a = drift.synths.grainSynth();

If you want to override the default values for a particular instance of your custom synth, you can specify an <code>options</code> argument when create it:

    var b = drift.synths.grainSynth({
        synthDef: {
            speed: 1.0
        }
    });

You can also define custom synths that override any aspect of a base grade. Here we override the type of granulator used:

        fluid.defaults("drift.synths.betterGrainSynth", {
            gradeNames: ["drift.synths.grainSynth", "autoInit"],
            synthDef: {
                ugen: "flock.ugen.granulator",
                grainDur: 0.001
            }
        });

Grades are very dynamic: you can even override or add further grades to a particular instance of a component when you instantiate it on the fly.

A simpler means to define custom components, <code>flock.define()</code> will be introduced in Flocking 0.2.0.
