/*
 * Flocking UI MIDI Port Connector
 *   Copyright 2015, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion");

(function () {
    "use strict";

    fluid.defaults("flock.ui.midiConnector", {
        gradeNames: ["flock.midi.receiver", "fluid.viewComponent"],

        components: {
            midiInputSelector: {
                type: "flock.ui.midiInputSelector",
                container: "{that}.container",
                options: {
                    events: {
                        onPortSelected: "{midiConnector}.events.onPortSelected"
                    }
                }
            },

            midiConnection: {
                createOnEvent: "onPortSelected",
                type: "flock.midi.connection",
                options: {
                    openImmediately: true,
                    ports: {
                        input: {
                            id: "{midiInputSelector}.selectBox.model.selection"
                        }
                    },

                    // TODO: These are ultimately midi.connection events.
                    // Is there a better way to "distribute" listeners from this
                    // parent "facade" object to its midiConnection subcomponent?
                    events: {
                        raw: "{midiConnector}.events.raw",
                        message: "{midiConnector}.events.message",
                        note: "{midiConnector}.events.note",
                        noteOn: "{midiConnector}.events.noteOn",
                        noteOff: "{midiConnector}.events.noteOff",
                        control: "{midiConnector}.events.control",
                        program: "{midiConnector}.events.program",
                        aftertouch: "{midiConnector}.events.aftertouch",
                        pitchbend: "{midiConnector}.events.pitchbend"
                    }
                }
            }
        },

        events: {
            onPortSelected: null
        }
    });

}());
