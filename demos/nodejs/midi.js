/*
 * Flocking Node.js MIDI Demo
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2013-2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true,
    node: true, forin: true, continue: true, nomen: true,
    bitwise: true, maxerr: 100, indent: 4 */

"use strict";

var fluid = require("infusion"),
    flock = require(__dirname + "/../../index.js"); //jshint ignore:line

flock.init();

fluid.defaults("flock.demo.nodejs.midiBand", {
    gradeNames: ["fluid.modelComponent", "flock.band"],

    model: {
        freq: 440
    },

    modelListeners: {
        freq: {
            func: "{synth}.set",
            args: ["carrier.freq", "{change}.value"],
            excludeSource: "init"
        }
    },

    modelRelay: {
        target: "freq",
        singleTransform: {
            type: "fluid.transforms.free",
            func: "flock.midiFreq",
            args: "{midiConnection}.model.controlValue"
        }
    },

    components: {
        synth: {
            type: "flock.synth",
            options: {
                synthDef: {
                    id: "carrier",
                    ugen: "flock.ugen.sinOsc",
                    freq: "{that}.model.freq",
                    mul: {
                        id: "mod",
                        ugen: "flock.ugen.sinOsc",
                        freq: 1.0,
                        mul: 0.25
                    }
                }
            }
        },

        midiConnection: {
            type: "flock.demo.nodejs.midiConnection"
        }
    }
});

fluid.defaults("flock.demo.nodejs.midiConnection", {
    gradeNames: ["flock.midi.connection", "fluid.modelComponent"],

    model: {
        controlValue: 0
    },

    openImmediately: true,

    ports: {
        input: "*"
    },

    listeners: {
        onError: {
            "this": "console",
            method: "log"
        },

        message: {
            "this": "console",
            method: "log"
        },

        control: [
            {
                changePath: "controlValue",
                value: "{arguments}.0.value"
            }
        ]
    }
});


var midiBand = flock.demo.nodejs.midiBand();

var inputPorts = midiBand.midiConnection.system.ports.inputs,
    portSummary = fluid.transform(inputPorts, function (port) {
        return port.name;
    });

console.log("Available MIDI Inputs:", fluid.prettyPrintJSON(portSummary));
midiBand.play();
