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

        portType: "input",

        components: {
            midiPortSelector: {
                type: "flock.ui.midiPortSelector",
                container: "{that}.container",
                options: {
                    portType: "{midiConnector}.options.portType",
                    events: {
                        onPortSelected: "{midiConnector}.events.onPortSelected"
                    }
                }
            },

            connection: {
                createOnEvent: "onPortSelected",
                type: "flock.midi.connection",
                options: {
                    openImmediately: true,
                    ports: {
                        expander: {
                            funcName: "flock.ui.midiConnector.generatePortSpecification",
                            args: [
                                "{midiConnector}.options.portType",
                                "{midiPortSelector}.selectBox.model.selection"
                            ]
                        }
                    },

                    // TODO: These are ultimately midi.connection events.
                    // Is there a better way to distribute listeners from this
                    // parent "facade" object to its connection subcomponent?
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
                    },

                    listeners: {
                        "onCreate.fireAfterConnectionOpen": {
                            func: "{midiConnector}.events.afterConnectionOpen.fire"
                        }
                    }
                }
            }
        },

        events: {
            onPortSelected: null,
            afterConnectionOpen: null
        }
    });

    flock.ui.midiConnector.generatePortSpecification = function (portType, portIDs) {
        var spec = {};
        spec[portType] = {
            id: portIDs
        };

        return spec;
    };
}());
