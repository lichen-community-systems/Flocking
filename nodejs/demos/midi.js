/*jshint node:true*/
/*global require*/

"use strict";

var fluid = require("infusion"),
    flock = require(__dirname + "/../index.js"); //jshint ignore:line

flock.init();

var midiBand = flock.band({
    components: {
        synth: {
            type: "flock.synth",
            options: {
                synthDef: {
                    id: "carrier",
                    ugen: "flock.ugen.sinOsc",
                    freq: 440,
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
            type: "flock.midi.connection",
            options: {
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

                    control: {
                        func: "{synth}.set",
                        args: {
                            "carrier.freq": "@expand:flock.midiFreq({arguments}.0.value)"
                        }
                    }
                }
            }
        }
    }
});

var inputPorts = midiBand.midiConnection.system.ports.inputs,
    portSummary = fluid.transform(inputPorts, function (port) {
        return port.name;
    });

console.log("Available MIDI Inputs:", fluid.prettyPrintJSON(portSummary));
midiBand.play();
