/*
 * Flocking Web MIDI
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2014-2016, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, Promise, console*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

// TODO: Factor out the cross-platform parts of this file.
(function () {

    "use strict";

    fluid.registerNamespace("flock.midi");

    flock.midi.requestAccess = function (sysex, onAccessGranted, onError) {
        if (!navigator.requestMIDIAccess) {
            var msg = "The Web MIDI API is not available. You may need to enable it in your browser's settings.";
            fluid.log(fluid.logLevel.WARN, msg);
            onError(msg);
            return;
        }

        var p = navigator.requestMIDIAccess({
            sysex: sysex
        });

        p.then(onAccessGranted, onError);
    };

    flock.midi.getPorts = function (access) {
        var ports = {};

        flock.midi.collectPorts("inputs", access, ports);
        flock.midi.collectPorts("outputs", access, ports);

        return ports;
    };

    flock.midi.requestPorts = function (success, error) {
        function wrappedSuccess (access) {
            var ports = flock.midi.getPorts(access);
            success(ports);
        }

        flock.midi.requestAccess(false, wrappedSuccess, error);
    };

    flock.midi.createPortViews = function (portsArray) {
        return fluid.transform(portsArray, function (port) {
            return {
                id: port.id,
                name: port.name,
                manufacturer: port.manufacturer,
                state: port.state,
                connection: port.connection
            };
        });
    };

    flock.midi.prettyPrintPorts = function (ports) {
        return fluid.prettyPrintJSON({
            inputs: flock.midi.createPortViews(ports.inputs),
            outputs: flock.midi.createPortViews(ports.outputs)
        });
    };

    flock.midi.logPorts = function () {
        function success (ports) {
            var printed = flock.midi.prettyPrintPorts(ports);
            console.log(printed);
        }

        function error (err) {
            console.log(err);
        }

        flock.midi.requestPorts(success, error);
    };

    flock.midi.collectPorts = function (type, access, ports) {
        var portsForType = ports[type] = ports[type] || [],
            iterator = access[type].values();

        var next = iterator.next();
        while (!next.done) {
            portsForType.push(next.value);
            next = iterator.next();
        }

        return ports;
    };


    flock.midi.read = function (data) {
        var status = data[0],
            type = status >> 4,
            channel = status & 0xf,
            fn;

        // TODO: Factor this into a lookup table by providing a generic
        // flock.midi.read.note that determines if it should be forwarded to noteOn/Off.
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
                fn = flock.midi.read.system;
                break;
            default:
                return flock.fail("Received an unrecognized MIDI message: " +
                    fluid.prettyPrintJSON(data));
        }

        return fn(channel, data);
    };

    flock.midi.read.note = function (type, channel, data) {
        return {
            type: type,
            channel: channel,
            note: data[1],
            velocity: data[2]
        };
    };

    flock.midi.read.noteOn = function (channel, data) {
        return flock.midi.read.note("noteOn", channel, data);
    };

    flock.midi.read.noteOff = function (channel, data) {
        return flock.midi.read.note("noteOff", channel, data);
    };

    flock.midi.read.polyAftertouch = function (channel, data) {
        return {
            type: "aftertouch",
            channel: channel,
            note: data[1],
            pressure: data[2]
        };
    };

    flock.midi.read.controlChange = function (channel, data) {
        return {
            type: "control",
            channel: channel,
            number: data[1],
            value: data[2]
        };
    };

    flock.midi.read.programChange = function (channel, data) {
        return {
            type: "program",
            channel: channel,
            program: data[1]
        };
    };

    flock.midi.read.channelAftertouch = function (channel, data) {
        return {
            type: "aftertouch",
            channel: channel,
            pressure: data[1]
        };
    };

    flock.midi.read.twoByteValue = function (data) {
        return (data[2] << 7) | data[1];
    };

    flock.midi.read.pitchbend = function (channel, data) {
        return {
            type: "pitchbend",
            channel: channel,
            value: flock.midi.read.twoByteValue(data)
        };
    };

    flock.midi.read.system = function (status, data) {
        if (status === 1) {
            return flock.midi.messageFailure("quarter frame MTC");
        }

        var fn;
        // TODO: Factor this into a lookup table.
        switch (status) {
            case 0:
                fn = flock.midi.read.sysex;
                break;
            case 2:
                fn = flock.midi.read.songPointer;
                break;
            case 3:
                fn = flock.midi.read.songSelect;
                break;
            case 6:
                fn = flock.midi.read.tuneRequest;
                break;
            case 8:
                fn = flock.midi.read.clock;
                break;
            case 10:
                fn = flock.midi.read.start;
                break;
            case 11:
                fn = flock.midi.read.continue;
                break;
            case 12:
                fn = flock.midi.read.stop;
                break;
            case 14:
                fn = flock.midi.read.activeSense;
                break;
            case 15:
                fn = flock.midi.read.reset;
                break;
            default:
                return flock.fail("Received an unrecognized MIDI system message: " +
                    fluid.prettyPrintJSON(data));
        }

        return fn(data);
    };

    flock.midi.messageFailure = function (type) {
        flock.fail("Flocking does not currently support MIDI " + type + " messages.");
        return;
    };

    flock.midi.read.sysex = function (data) {
        return {
            type: "sysex",
            data: data
        };
    };

    flock.midi.read.valueMessage = function (type, value) {
        return {
            type: type,
            value: value
        };
    };

    flock.midi.read.songPointer = function (data) {
        var val = flock.midi.read.twoByteValue(data);
        return flock.midi.read.valueMessage("songPointer", val);
    };

    flock.midi.read.songSelect = function (data) {
        return flock.midi.read.valueMessage("songSelect", data[1]);
    };

    flock.midi.read.tuneRequest = function () {
        return {
            type: "tuneRequest"
        };
    };

    flock.midi.systemRealtimeMessages = [
        "tuneRequest",
        "clock",
        "start",
        "continue",
        "stop",
        "activeSense",
        "reset"
    ];

    flock.midi.createSystemRealtimeMessageReaders = function (systemRealtimeMessages) {
        fluid.each(systemRealtimeMessages, function (type) {
            flock.midi.read[type] = function () {
                return {
                    type: type
                };
            };
        });
    };

    flock.midi.createSystemRealtimeMessageReaders(flock.midi.systemRealtimeMessages);

    /**
     * Represents the overall Web MIDI system,
     * including references to all the available MIDI ports
     * and the MIDIAccess object.
     */
    // TODO: This should be a model component!
    fluid.defaults("flock.midi.system", {
        gradeNames: ["fluid.component"],

        sysex: false,

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
                args: ["{that}", "{that}.access", "{that}.events.onPortsAvailable.fire"]
            }
        },

        events: {
            onAccessGranted: null,
            onAccessError: null,
            onReady: null,
            onPortsAvailable: null
        },

        listeners: {
            onCreate: {
                func: "{that}.requestAccess"
            },

            onAccessGranted: [
                "flock.midi.system.setAccess({that}, {arguments}.0)",
                "{that}.refreshPorts()",
                "{that}.events.onReady.fire({that}.ports)"
            ],

            onAccessError: {
                funcName: "fluid.log",
                args: [fluid.logLevel.WARN, "MIDI Access Error: ", "{arguments}.0"]
            }

            // TODO: Provide an onDestroy listener
            // that will close any ports that are open.
        }
    });

    flock.midi.system.setAccess = function (that, access) {
        that.access = access;
    };

    flock.midi.system.refreshPorts = function (that, access, onPortsAvailable) {
        that.ports = flock.midi.getPorts(access);
        onPortsAvailable(that.ports);
    };


    /**
     * An abstract grade that the defines the event names
     * for receiving MIDI messages
     */
    fluid.defaults("flock.midi.receiver", {
        gradeNames: ["fluid.component"],

        events: {
            raw: null,
            message: null,
            note: null,
            noteOn: null,
            noteOff: null,
            control: null,
            program: null,
            aftertouch: null,
            pitchbend: null
        }
    });


    /*
     * A MIDI Connection represents a connection between an arbitrary set of
     * input and output ports across one or more MIDI devices connected to the system.
     */
    // TODO: Handle port disconnection events.
    fluid.defaults("flock.midi.connection", {
        gradeNames: ["flock.midi.receiver"],

        openImmediately: false,

        sysex: false,

        distributeOptions: {
            source: "{that}.options.sysex",
            target: "{that > system}.options.sysex"
        },

        // Supported PortSpec formats:
        //  - Number: the index of the input and output port to use (this is the default)
        //  - { manufacturer: "akai", name: "LPD8"}
        //  - { input: Number, output: Number}
        //  - { input: { manufacturer: "akai", name: "LPD8"}, output: {manufacturer: "korg", name: "output"}}
        ports: 0,

        invokers: {
            sendRaw: {
                func: "{that}.events.onSendRaw.fire"
            },

            send: {
                funcName: "flock.midi.connection.send",
                args:     ["{that}", "{arguments}.0"]
            },

            open: {
                funcName: "flock.midi.connection.bind",
                args: [
                    "{that}.system.ports",
                    "{that}.options.ports",
                    "{that}.events.onReady.fire",
                    "{that}.events.raw.fire",
                    "{that}.events.onSendRaw"
                ]
            },

            close: {
                funcName: "flock.midi.connection.close",
                args: [
                    "{that}.system.ports",
                    "{that}.events.raw.fire"
                ]
            }
        },

        components: {
            system: {
                type: "flock.midi.system",
                options: {
                    events: {
                        onReady: "{connection}.events.onPortsAvailable"
                    }
                }
            }
        },

        events: {
            onPortsAvailable: null,
            onReady: null,
            onError: null,
            onSendRaw: null
        },

        listeners: {
            onPortsAvailable: {
                funcName: "flock.midi.connection.autoOpen",
                args: [
                    "{that}.options.openImmediately", "{that}.open"
                ]
            },

            onError: {
                funcName: "fluid.log",
                args: [fluid.logLevel.WARN, "{arguments}.0"]
            },

            raw: {
                funcName: "flock.midi.connection.fireEvent",
                args: ["{arguments}.0", "{that}.events"]
            },

            onDestroy: [
                "{that}.close()"
            ]
        }
    });


    /**
     *
     * Take a MIDI messages object and convert it to an array of raw bytes suitable for sending to a MIDI device.
     *
     * @param {Object} midiMessage a MIDI messageSpec object
     * @returns {Uint8Array} - an array containing the encoded MIDI message's bytes
     *
     */
    flock.midi.write = function (midiMessage) {
        var dataBytes = [],
            channel = midiMessage.channel ? midiMessage.channel : 0,
            statusInt;

        switch (midiMessage.type) {
            case "noteOn":
                statusInt = 9;
                dataBytes = [midiMessage.note, midiMessage.velocity];
                break;
            case "noteOff":
                statusInt = 8;
                dataBytes = [midiMessage.note, midiMessage.velocity];
                break;
            case "aftertouch":
                // polyAfterTouch
                if (midiMessage.note) {
                    statusInt = 10;
                    dataBytes = [midiMessage.note, midiMessage.pressure];
                }
                // afterTouch
                else {
                    statusInt = 13;
                    dataBytes = [midiMessage.pressure];
                }
                break;
            case "control":
                statusInt = 11;
                dataBytes = [midiMessage.number, midiMessage.value];
                break;
            case "program":
                statusInt = 12;
                dataBytes = [midiMessage.program];
                break;
            case "pitchbend":
                statusInt = 14;
                dataBytes = flock.midi.write.valueToTwoByteArray(midiMessage.value);
                break;
            case "sysex":
                return flock.midi.write.sysex(midiMessage);
            case "songPointer":
                channel = 2;
                statusInt = 15;
                dataBytes = flock.midi.write.valueToTwoByteArray(midiMessage.value);
                break;
            case "songSelect":
                channel = 3;
                statusInt = 15;
                dataBytes = flock.midi.write.valueToTwoByteArray(midiMessage.value);
                break;
            case "tuneRequest":
                channel = 6;
                statusInt = 15;
                break;
            case "clock":
                channel = 8;
                statusInt = 15;
                break;
            case "start":
                channel = 10;
                statusInt = 15;
                break;
            case "continue":
                channel = 11;
                statusInt = 15;
                break;
            case "stop":
                channel = 12;
                statusInt = 15;
                break;
            case "activeSense":
                channel = 14;
                statusInt = 15;
                break;
            case "reset":
                channel = 15;
                statusInt = 15;
                break;
            // TODO: Discuss with Colin, this should never be hit
            // case "system":
            //     statusInt = 15;
            //     break;
            default:
                flock.fail("Cannot handle MIDI message of type '" + midiMessage.type + "'.");
        }

        var midiMessage = new Uint8Array(dataBytes.length + 1);
        midiMessage[0] = (statusInt << 4) + channel;
        if (dataBytes) {
            midiMessage.set(dataBytes, 1);
        }
        return midiMessage;
    };

    /**
     *
     * Convert a large numeric value to an array of two separate bytes.
     *
     * @param value {Number} A 14-bit integer to convert
     * @returns {Array} - An array of two 7-bit values
     *
     */
    flock.midi.write.valueToTwoByteArray =  function (value) {
        return [
            value & 0x7f,       // LSB
            (value >> 7) & 0x7f // MSB
        ];
    };

    flock.midi.write.sysex = function (midiMessage) {
        var data = midiMessage.data,
            len = data.length,
            framedData = new Uint8Array(data);

        // TODO: Reduce duplication.
        if (data[0] !== 0xF0 && data[len - 1] !== 0xF7) {
            framedData = new Uint8Array(len + 2);
            framedData[0] = 0xF0;
            framedData[len + 1] = 0xF7;
            framedData.set(data, 1);
        } else if (data[0] !== 0xF0) {
            framedData = new Uint8Array(len + 1);
            framedData[0] = 0xF0;
            framedData.set(data, 1);
        } else if (data[len - 1] !== 0xF7) {
            framedData = new Uint8Array(len + 1);
            framedData[len] = 0xF7;
            framedData.set(data, 0);
        }

        return framedData;
    };

    /**
     *
     * Sends a MIDI message.
     *
     * @param that {Object} - the flock.midi.connection component itself
     * @param midiMessage {Object} - a MIDI messageSpec
     */
    flock.midi.connection.send = function (that, midiMessage) {
        var midiBytes = flock.midi.write(midiMessage);
        that.events.onSendRaw.fire(midiBytes);
    };

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
        if (typeof portSpec === "number") {
            return flock.midi.findPorts.byIndex(portSpec);
        }

        if (typeof portSpec === "string") {
            portSpec = {
                name: portSpec
            };
        }

        var matcher = portSpec.id ? flock.midi.findPorts.idMatcher(portSpec.id) :
            portSpec.manufacturer && portSpec.name ?
            flock.midi.findPorts.bothMatcher(portSpec.manufacturer, portSpec.name) :
            portSpec.manufacturer ? flock.midi.findPorts.manufacturerMatcher(portSpec.manufacturer) :
            flock.midi.findPorts.nameMatcher(portSpec.name);

        return function (ports) {
            return ports.filter(matcher);
        };
    };

    flock.midi.findPorts.byIndex = function (idx) {
        return function (ports) {
            var port = ports[idx];
            return port ? [port] : [];
        };
    };

    flock.midi.findPorts.lowerCaseContainsMatcher = function (matchSpec) {
        return function (obj) {
            var isMatch;
            for (var prop in matchSpec) {
                var objVal = obj[prop];
                var matchVal = matchSpec[prop];

                isMatch = (matchVal === "*") ? true :
                    objVal && (objVal.toLowerCase().indexOf(matchVal.toLowerCase()) > -1);

                if (!isMatch) {
                    break;
                }
            }

            return isMatch;
        };
    };

    flock.midi.findPorts.idMatcher = function (id) {
        return function (port) {
            return port.id === id;
        };
    };

    flock.midi.findPorts.bothMatcher = function (manu, name) {
        return flock.midi.findPorts.lowerCaseContainsMatcher({
            manufacturer: manu,
            name: name
        });
    };

    flock.midi.findPorts.manufacturerMatcher = function (manu) {
        return flock.midi.findPorts.lowerCaseContainsMatcher({
            manufacturer: manu
        });
    };

    flock.midi.findPorts.nameMatcher = function (name) {
        return flock.midi.findPorts.lowerCaseContainsMatcher({
            name: name
        });
    };

    flock.midi.findPorts.eachPortOfType = function (port, type, fn) {
        var ports = fluid.makeArray(port);
        fluid.each(ports, function (port) {
            if (port.type === type) {
                fn(port);
            }
        });
    };

    flock.midi.connection.openPort = function (port, openPromises) {
        // Remove this conditional when Chrome 43 has been released.
        if (port.open) {
            var p = port.open();
            openPromises.push(p);
        }

        return openPromises;
    };

    flock.midi.connection.listen = function (port, onRaw, openPromises) {
        flock.midi.findPorts.eachPortOfType(port, "input", function (port) {
            flock.midi.connection.openPort(port, openPromises);
            port.addEventListener("midimessage", onRaw, false);
        });

        return openPromises;
    };

    flock.midi.connection.stopListening = function (port, onRaw) {
        flock.midi.findPorts.eachPortOfType(port, "input", function (port) {
            port.close();
            port.removeEventListener("midimessage", onRaw, false);
        });
    };

    flock.midi.connection.bindSender = function (port, onSendRaw, openPromises) {
        var ports = fluid.makeArray(port);

        fluid.each(ports, function (port) {
            flock.midi.connection.openPort(port, openPromises);
            onSendRaw.addListener(port.send.bind(port));
        });

        return openPromises;
    };

    flock.midi.connection.fireReady = function (openPromises, onReady) {
        if (!openPromises || openPromises.length < 1) {
            return;
        }

        Promise.all(openPromises).then(onReady);
    };

    flock.midi.connection.bind = function (ports, portSpec, onReady, onRaw, onSendRaw) {
        portSpec = flock.midi.connection.expandPortSpec(portSpec);

        var input = flock.midi.findPorts(ports.inputs, portSpec.input),
            output = flock.midi.findPorts(ports.outputs, portSpec.output),
            openPromises = [];

        if (input && input.length > 0) {
            flock.midi.connection.listen(input, onRaw, openPromises);
        } else if (portSpec.input !== undefined) {
            flock.midi.connection.logNoMatchedPorts("input", portSpec);
        }

        if (output && output.length > 0) {
            flock.midi.connection.bindSender(output, onSendRaw, openPromises);
        } else if (portSpec.output !== undefined) {
            flock.midi.connection.logNoMatchedPorts("output", portSpec);
        }

        flock.midi.connection.fireReady(openPromises, onReady);
    };

    flock.midi.connection.close = function (ports, onRaw) {
        flock.midi.connection.stopListening(ports.inputs, onRaw);
        // TODO: Come up with some scheme for unbinding port senders
        // since they use Function.bind().
    };

    flock.midi.connection.logNoMatchedPorts = function (type, portSpec) {
        fluid.log(fluid.logLevel.WARN,
            "No matching " + type + " ports were found for port specification: ", portSpec[type]);
    };

    flock.midi.connection.expandPortSpec = function (portSpec) {
        if (portSpec.input !== undefined || portSpec.output !== undefined) {
            return portSpec;
        }

        var expanded = {
            input: {},
            output: {}
        };

        if (typeof portSpec === "number") {
            expanded.input = expanded.output = portSpec;
        } else {
            flock.midi.connection.expandPortSpecProperty("manufacturer", portSpec, expanded);
            flock.midi.connection.expandPortSpecProperty("name", portSpec, expanded);
        }

        return expanded;
    };

    flock.midi.connection.expandPortSpecProperty = function (propName, portSpec, expanded) {
        expanded.input[propName] = expanded.output[propName] = portSpec[propName];
        return expanded;
    };

    flock.midi.connection.fireEvent = function (midiEvent, events) {
        var model = flock.midi.read(midiEvent.data),
            eventForType = model.type ? events[model.type] : undefined;

        events.message.fire(model, midiEvent);

        // TODO: Remove this special-casing of noteOn/noteOff events into note events.
        if (model.type === "noteOn" || model.type === "noteOff") {
            events.note.fire(model, midiEvent);
        }

        if (eventForType) {
            eventForType.fire(model, midiEvent);
        }
    };

}());
