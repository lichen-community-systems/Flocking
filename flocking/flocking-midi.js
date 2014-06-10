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

    fluid.registerNamespace("flock.midi");

    flock.midi.requestAccess = function (sysex, onAccessGranted, onError) {
        var p = navigator.requestMIDIAccess({
            sysex: sysex
        });

        p.then(onAccessGranted, onError);
    };

    flock.midi.getPorts = function (access) {
        var ports = {};

        if (access.inputs) {
            ports.inputs = access.inputs();
        }

        if (access.outputs) {
            ports.outputs = access.outputs();
        }

        return ports;
    };

    /**
     * Represents the overall Web MIDI system,
     * including references to all the available MIDI ports
     * and the MIDIAccess object.
     */
    fluid.defaults("flock.midi.system", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        sysex: true,

        members: {
            access: undefined,
            ports: undefined
        },

        invokers: {
            requestAccess: {
                funcName: "flock.midi.requestAccess",
                args: [
                    "{that}.options.sysex",
                    "{that}.events.onAccessGranted.fire",
                    "{that}.events.onAccessError.fire"
                ]
            },

            refreshPorts: {
                funcName: "flock.midi.system.refreshPorts",
                args: ["{that}", "{that}.access"]
            }
        },

        events: {
            onAccessGranted: null,
            onAccessError: null,
            onReady: null
        },

        listeners: {
            onCreate: {
                func: "{that}.requestAccess"
            },

            onAccessGranted: [
                {
                    funcName: "flock.midi.system.setAccess",
                    args: ["{that}", "{arguments}.0"]
                },
                {
                    func: "{that}.refreshPorts"
                },
                {
                    func: "{that}.events.onReady.fire",
                    args: "{that}.ports"
                }
            ]
        }
    });

    flock.midi.system.setAccess = function (that, access) {
        that.access = access;
    };

    flock.midi.system.refreshPorts = function (that, access) {
        that.ports = flock.midi.getPorts(access);
    };


    /*
     * A MIDI Connection represents a connection between an arbitrary set of
     * input and output ports across one or more MIDI devices connected to the system.
     */
    // TODO: Handle port disconnection events.
    fluid.defaults("flock.midi.connection", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        sysex: false,
        openImmediately: false,

        ports: {},

        invokers: {
            send: {
                func: "{that}.events.onSendMessage.fire"
            },

            open: {
                funcName: "flock.midi.bindConnection",
                args: [
                    "{system}.ports",
                    "{that}.options.ports",
                    "{that}.events.rawMIDI.fire",
                    "{that}.events.onSendMessage"
                ]
            },

            close: {
                funcName: "flock.midi.closeConnection",
                args: [
                    "{system}.ports",
                    "{that}.events.rawMIDI.fire"
                ]
            }
        },

        components: {
            system: {
                type: "flock.midi.system"
            }
        },

        events: {
            onReady: {
                event: "{system}.events.onReady"
            },
            onError: null,
            onSendMessage: null,

            rawMIDI: null,
            message: null,
            note: null,
            noteOn: null,
            noteOff: null,
            control: null,
            program: null,
            aftertouch: null,
            pitchbend: null
        },

        listeners: {
            onReady: {
                funcName: "flock.midi.connection.autoOpen",
                args: ["{that}.options.openImmediately", "{that}.open"]
            },

            rawMIDI: {
                funcName: "flock.midi.fireEvent",
                args: ["{arguments}.0", "{that}.events"]
            }
        }
    });

    flock.midi.connection.autoOpen = function (openImmediately, openFn) {
        if (openImmediately) {
            openFn();
        }
    };

    flock.midi.findPorts = function (ports, portSpecs) {
        portSpecs = fluid.makeArray(portSpecs);

        var matches = [];

        fluid.each(portSpecs, function (portSpec) {
            var portFinder = flock.midi.findPorts.portFinder(portSpec),
                matchesForSpec = portFinder(ports);

            matches = matches.concat(matchesForSpec);
        });

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
            var manuMatches = port.manufacturer.toLowerCase().match(manu.toLowerCase()) !== null,
                nameMatches = port.name.toLowerCase().match(name.toLowerCase()) !== null;

            return manuMatches && nameMatches;
        };
    };

    flock.midi.findPorts.manufacturerMatch = function (manu) {
        return function (port) {
            return port.manufacturer.toLowerCase().match(manu.toLowerCase()) !== null;
        };
    };

    flock.midi.findPorts.nameMatch = function (name) {
        return function (port) {
            return port.name.toLowerCase().match(name.toLowerCase()) !== null;
        };
    };

    flock.midi.forEachInputPort = function (port, fn) {
        var ports = fluid.makeArray(port);
        fluid.each(ports, function (port) {
            if (port.type === "input") {
                fn(port);
            }
        });
    };

    flock.midi.listenToPort = function (port, onRawMIDI) {
        flock.midi.forEachInputPort(port, function (port) {
            port.addEventListener("midimessage", onRawMIDI, false);
        });
    };

    flock.midi.stopListeningToPort = function (port, onRawMIDI) {
        flock.midi.forEachInputPort(port, function (port) {
            port.removeEventListener("midimessage", onRawMIDI, false);
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

        if (input && input.length > 0) {
            flock.midi.listenToPort(input, onRawMIDI);
        } else {
            flock.midi.bindConnection.logNoPorts("input", portSpec);
        }

        if (output && output.length > 0) {
            flock.midi.bindPortSender(output, onSendMessage);
        } else {
            flock.midi.bindConnection.logNoPorts("output", portSpec);
        }
    };

    flock.midi.closeConnection = function (ports, onRawMIDI) {
        flock.midi.stopListeningToPort(ports.inputs, onRawMIDI);
        // TODO: Come up with some scheme for unbinding port senders
        // since they use Function.bind().
    };

    flock.midi.bindConnection.logNoPorts = function (type, portSpec) {
        fluid.log("No matching " + type + " ports were found for port specification: ", portSpec[type]);
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

        events.message.fire(model);

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

        return flock.midi.read.runningStatus(type, chan, data);
    };

    flock.midi.read.runningStatus = function (type, chan, data) {
        var msgs = [],
            start = 0,
            end = 3,
            len = data.length + 1;

        while (end < len) {
            var chunk = data.subarray(start, end);
            var msg = flock.midi.read[type](chan, chunk);
            msgs.push(msg);
            start += 3;
            end += 3;
        }

        return msgs;
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
