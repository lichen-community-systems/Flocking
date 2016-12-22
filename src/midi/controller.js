/*
 * Flocking MIDI Controller
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2014-2016, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    // TODO:
    //  * Mappings should be defined for each of the MIDI messages (noteOn, noteOff, control)
    //  * Velocity mapping should always be scoped to a particular noteon/off handler.
    //  * Provide a "listener filter" that allows for mapping to only certain notes.
    fluid.defaults("flock.midi.controller", {
        gradeNames: ["fluid.component"],

        members: {
            controlMap: {
                expander: {
                    funcName: "flock.midi.controller.optimizeMIDIMap",
                    args: ["{that}.options.controlMap"]
                }
            },

            noteMap: {
                expander: {
                    funcName: "flock.midi.controller.optimizeNoteMap",
                    args: ["{that}.options.noteMap"]
                }
            }
        },

        controlMap: {},                       // Control and note maps
        noteMap: {},                          // need to be specified by the user.

        components: {
            synthContext: {                   // Also user-specified. Typically a flock.band instance,
                type: "flock.band"            // but can be anything that has a set of named synths,
            },                                // including a synth itself.

            connection: {
                type: "flock.midi.connection",
                options: {
                    ports: {
                        input: "*"              // Connect to the first available input port.
                    },

                    openImmediately: true    // Immediately upon instantiating the connection.
                }
            }
        },

        invokers: {
            mapControl: {
                funcName: "flock.midi.controller.mapControl",
                args: ["{arguments}.0", "{that}.synthContext", "{that}.controlMap"]
            },

            mapNote: {
                funcName: "flock.midi.controller.mapNote",
                args: [
                    "{arguments}.0", // Note type.
                    "{arguments}.1", // Note spec.
                    "{that}.synthContext",
                    "{that}.noteMap"
                ]
            }
        },

        events: {
            control: "{that}.connection.events.control",
            note: "{that}.connection.events.note",
            noteOn: "{that}.connection.events.noteOn",
            noteOff: "{that}.connection.events.noteOff"
        },

        listeners: {
            control: "{that}.mapControl({arguments}.0)",
            note: "{that}.mapNote(note, {arguments}.0)",
            noteOn: "{that}.mapNote(noteOn, {arguments}.0)",
            noteOff: "{that}.mapNote(noteOff, {arguments}.0)"
        }
    });

    flock.midi.controller.optimizeMIDIMap = function (map) {
        var mapArray = new Array(127);
        fluid.each(map, function (mapSpecs, midiNum) {
            var idx = Number(midiNum);
            mapArray[idx] = fluid.makeArray(mapSpecs);
        });

        return mapArray;
    };

    flock.midi.controller.optimizeNoteMap = function (noteMap) {
        return {
            note: fluid.makeArray(noteMap.note),
            noteOn: fluid.makeArray(noteMap.noteOn),
            noteOff: fluid.makeArray(noteMap.noteOff),
            velocity: fluid.makeArray(noteMap.velocity)
        };
    };

    flock.midi.controller.expandControlMapSpec = function (valueUGenID, mapSpec) {
        mapSpec.transform.id = valueUGenID;

        // TODO: The key "valuePath" is confusing;
        // it actually points to the location in the
        // transform synth where the value will be set.
        mapSpec.valuePath = mapSpec.valuePath || "value";

        if (!mapSpec.transform.ugen) {
            mapSpec.transform.ugen = "flock.ugen.value";
        }

        return mapSpec;
    };

    flock.midi.controller.makeValueSynth = function (value, id, mapSpec) {
        mapSpec = flock.midi.controller.expandControlMapSpec(id, mapSpec);

        var transform = mapSpec.transform,
            valuePath = mapSpec.valuePath;

        flock.set(transform, valuePath, value);

        // Instantiate the new value synth.
        var valueSynth = flock.synth.value({
            synthDef: transform
        });

        // Update the value path so we can quickly update the synth's input value.
        mapSpec.valuePath = id + "." + valuePath;

        return valueSynth;
    };

    flock.midi.controller.transformValue = function (value, mapSpec) {
        var transform = mapSpec.transform,
            type = typeof transform;

        if (type === "function") {
            return transform(value);
        }
        // TODO: Add support for string-based transforms
        // that bind to globally-defined synths
        // (e.g. "flock.synth.midiFreq" or "flock.synth.midiAmp")
        // TODO: Factor this into a separate function.
        if (!mapSpec.transformSynth) {
            // We have a raw synthDef.
            // Instantiate a value synth to transform incoming control values.

            // TODO: In order to support multiple inputs (e.g. a multi-arg OSC message),
            // this special path needs to be scoped to the argument name. In the case of MIDI,
            // this would be the CC number. In the case of OSC, it would be a combination of
            // OSC message address and argument index.
            mapSpec.transformSynth = flock.midi.controller.makeValueSynth(
                value, "flock-midi-controller-in", mapSpec);
        } else {
            // TODO: When the new node architecture is in in place, we can directly connect this
            // synth to the target synth at instantiation time.
            // TODO: Add support for arrays of values, such as multi-arg OSC messages.
            mapSpec.transformSynth.set(mapSpec.valuePath, value);
        }

        return mapSpec.transformSynth.value();
    };

    flock.midi.controller.setMappedValue = function (value, map, synthContext) {
        // A map specification's value always overrides the incoming midi value.
        // This is typically used when manually closing gates with noteOff events
        // fired by controllers that specify key release speed as velocity.
        value = map.value !== undefined ? map.value :
            map.transform ? flock.midi.controller.transformValue(value, map) :
            value;

        var synth = synthContext[map.synth] || synthContext;

        synth.set(map.input, value);
    };

    flock.midi.controller.mapMIDIValue = function (value, maps, synthContext) {
        if (!maps || maps.length < 1) {
            return;
        }

        for (var i = 0; i < maps.length; i++) {
            var map = maps[i];
            flock.midi.controller.setMappedValue(value, map, synthContext);
        }
    };

    flock.midi.controller.mapControl = function (midiMsg, synthContext, controlMap) {
        var maps = controlMap[midiMsg.number],
            value = midiMsg.value;

        flock.midi.controller.mapMIDIValue(value, maps, synthContext);
    };

    // TODO: Add support for defining listener filters or subsets
    // of all midi notes (e.g. for controllers like the Quneo).
    // TODO: The current implementation is somewhere between inefficient
    // and broken. In particular, we doubly apply velocity for
    // each noteOn or noteOff event.
    flock.midi.controller.mapNote = function (type, midiMsg, synthContext, noteMap) {
        var keyMaps = noteMap[type],
            key = midiMsg.note,
            velMaps = noteMap.velocity,
            vel = midiMsg.velocity;

        flock.midi.controller.mapMIDIValue(key, keyMaps, synthContext);
        flock.midi.controller.mapMIDIValue(vel, velMaps, synthContext);
    };
}());
