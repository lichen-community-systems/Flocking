/*
 * Flocking MIDI
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2014, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.defaults("flock.midi", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        sysex: false,

        invokers: {
            requestAccess: {
                funcName: "flock.midi.requestAccess",
                args: ["{that}.options.sysex", "{that}.events.onReady.fire", "{that}.events.onError.fire"]
            }
        },

        dynamicComponents: {
            system: {
                createOnEvent: "onReady",
                type: "fluid.eventedComponent",
                options: {
                    access: "{arguments}.0",
                    ports: {
                        expander: {
                            funcName: "flock.midi.ports",
                            args: ["{arguments}.0"]
                        }
                    }
                }
            }
        },

        events: {
            onReady: null,
            onError: null
        },

        listeners: {
            onCreate: {
                func: "{that}.requestAccess"
            }
        }
    });

    flock.midi.requestAccess = function (sysex, onReady, onError) {
        var p = navigator.requestMIDIAccess({
            sysex: sysex
        });

        p.then(onReady, onError);
    };

    flock.midi.ports = function (access) {
        var ports = {};

        if (access.inputs) {
            ports.inputs = access.inputs();
        }

        if (access.outputs) {
            ports.outputs = access.outputs();
        }

        return ports;
    };

    flock.midi.findPorts = function (ports, portSpec) {
        var portFinder = flock.midi.findPorts.portFinder(portSpec),
            matches = portFinder(ports);

        return matches;
    };

    flock.midi.findPorts.portFinder = function (portSpec) {
        if (portSpec.id) {
            return function (ports) {
                ports.find(flock.midi.findPorts.idMatch(portSpec.id));
            };
        }

        var matcher = portSpec.manufacturer && portSpec.name ?
            flock.midi.findPorts.bothMatch(portSpec.manufacturer, portSpec.name) :
            portSpec.manufacturer ? flock.midi.findPorts.manufacturerMatch(portSpec.manufacturer) :
            flock.midi.findPorts.nameMatch(portSpec.name);

        return function (ports) {
            return ports.filter(matcher);
        };
    };

    flock.midi.findPorts.idMatch = function (id) {
        return function (port) {
            return port.id === id;
        };
    };

    flock.midi.findPorts.bothMatch = function (manu, name) {
        return function (port) {
            return port.manufacturer.toLowerCase() === manu.toLowerCase() &&
                port.name.toLowerCase() === name.toLowerCase();
        };
    };

    flock.midi.findPorts.manufacturerMatch = function (manu) {
        return function (port) {
            return port.manufacturer.toLowerCase() === manu.toLowerCase();
        };
    };

    flock.midi.findPorts.nameMatch = function (name) {
        return function (port) {
            return port.name.toLowerCase() === name.toLowerCase();
        };
    };


    /*
    window.midiConnection = flock.midi.connection({
        ports: {
            manufacturer: "korg inc."
        },

        listeners: {
            onMessage: {
                "this": "console",
                method: "log"
            }
        }
    });
    */

    fluid.defaults("flock.midi.connection", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        ports: {},

        invokers: {
            send: {
                func: "{that}.events.onSendMessage.fire"
            }
        },

        components: {
            midi: {
                type: "flock.midi",
                options: {
                    listeners: {
                        onReady: {
                            funcName: "flock.midi.bindConnection",
                            args: [
                                "{system}.options.ports",
                                "{connection}.options.ports",
                                "{connection}.events.onRawMIDI.fire",
                                "{connection}.events.onSendMessage.fire"
                            ]
                        }
                    }
                }
            }
        },

        events: {
            onRawMIDI: null,
            onMessage: null,
            onSendMessage: null,

            note: null,
            noteOn: null,
            noteOff: null,
            control: null,
            program: null,
            aftertouch: null,
            pitchbend: null
        },

        listeners: {
            onRawMIDI: {
                funcName: "flock.midi.fireEvent",
                args: ["{arguments}.0", "{that}.events"]
            }
        }
    });

    flock.midi.listenToPort = function (port, onRawMIDI) {
        var ports = fluid.makeArray(port);
        fluid.each(ports, function (port) {
            if (port.type === "input") {
                port.onmidimessage = onRawMIDI;
            }
        });
    };

    flock.midi.bindPortSender = function (port, onSendMessage) {
        var ports = fluid.makeArray(port);
        fluid.each(ports, function (port) {
            onSendMessage.addListener(port.send.bind(port));
        });
    };

    flock.midi.bindConnection = function (ports, portSpec, onRawMIDI, onSendMessage) {
        portSpec = flock.midi.expandPortSpec(portSpec);

        var input = flock.midi.findPorts(ports.inputs, portSpec.input),
            output = flock.midi.findPorts(ports.outputs, portSpec.output);

        if (input) {
            flock.midi.listenToPort(input, onRawMIDI);
        }

        if (output) {
            flock.midi.bindPortSender(output, onSendMessage);
        }
    };

    flock.midi.expandPortSpec = function (portSpec) {
        if (portSpec.input && portSpec.output) {
            return portSpec;
        }

        var expanded = {
            input: {},
            output: {}
        };

        flock.midi.expandPortSpecProperty("manufacturer", portSpec, expanded);
        flock.midi.expandPortSpecProperty("name", portSpec, expanded);

        return expanded;
    };

    flock.midi.expandPortSpecProperty = function (propName, portSpec, expanded) {
        if (flock.isIterable(portSpec[propName])) {
            if (portSpec[propName].length > 1) {
                expanded.input[propName] = portSpec[propName][0];
                expanded.output[propName] = portSpec[propName][1];
            } else {
                expanded.input[propName] = expanded.output[propName] = portSpec[propName][0];
            }
        } else {
            expanded.input[propName] = expanded.output[propName] = portSpec[propName];
        }

        return expanded;
    };

    flock.midi.fireEvent = function (midiEvent, events) {
        var model = flock.midi.read(midiEvent.data),
            eventForType = model.type ? events[model.type] : undefined;

        events.onMessage.fire(model);

        // TODO: Remove this special-casing of noteOn/noteOff events into note events.
        if (model.type === "noteOn" || model.type === "noteOff") {
            events.note.fire(model);
        }

        if (eventForType) {
            eventForType.fire(model);
        }
    };

    flock.midi.read = function (data) {
        var status = data[0],
            type = status >> 4,
            chan = status & 0xf,
            fn;

        switch (type) {
            case 8:
                fn = flock.midi.read.noteOff;
                break;
            case 9:
                fn = data[2] > 0 ? flock.midi.read.noteOn : flock.midi.read.noteOff;
                break;
            case 10:
                fn = flock.midi.read.polyAftertouch;
                break;
            case 11:
                fn = flock.midi.read.controlChange;
                break;
            case 12:
                fn = flock.midi.read.programChange;
                break;
            case 13:
                fn = flock.midi.read.channelAftertouch;
                break;
            case 14:
                fn = flock.midi.read.pitchbend;
                break;
            case 15:
                fn = flock.midi.read.sysex;
                break;
            default:
                throw new Error("Recieved an unrecognized MIDI message: " + data);
        }

        return fn(chan, data);
    };

    flock.midi.read.note = function (type, chan, data) {
        var vel = data[2];

        if (data.length === 3) {
            return {
                type: type,
                chan: chan,
                note: data[1],
                velocity: vel
            };
        }

        var notes = [];

        for (var i = 3; i < data.length; i += 3) {
            var chunk = data.subarray(i, i + 3);
            var note = flock.midi.noteOn(chan, chunk);
            notes.push(note);
        }

        return notes;
    };

    flock.midi.read.noteOn = function (chan, data) {
        return flock.midi.read.note("noteOn", chan, data);
    };

    flock.midi.read.noteOff = function (chan, data) {
        return flock.midi.read.note("noteOff", chan, data);
    };

    flock.midi.read.polyAftertouch = function (chan, data) {
        return {
            type: "aftertouch",
            chan: chan,
            note: data[1],
            pressure: data[2]
        };
    };

    flock.midi.read.controlChange = function (chan, data) {
        return {
            type: "control",
            chan: chan,
            number: data[1],
            value: data[2]
        };
    };

    flock.midi.read.programChange = function (chan, data) {
        return {
            type: "program",
            chan: chan,
            program: data[1]
        };
    };

    flock.midi.read.channelAftertouch = function (chan, data) {
        return {
            type: "aftertouch",
            chan: chan,
            pressure: data[1]
        };
    };

    flock.midi.read.pitchbend = function (chan, data) {
        // TODO: Implement this properly
        return {
            type: "pitchbend",
            chan: chan,
            value: (data[1] << 7) | data[2]
        };
    };

    flock.midi.read.sysex = function (chan, data) {
        return {
            type: "system",
            chan: chan,
            data: data.subarray(1)
        };
    };

}());
