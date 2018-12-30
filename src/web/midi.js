/*
 * Flocking Web MIDI
 * https://github.com/colinbdclark/flocking
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

    // Unsupported, non-API function.
    flock.midi.read.note = function (type, channel, data) {
        return {
            type: type,
            channel: channel,
            note: data[1],
            velocity: data[2]
        };
    };

    // Unsupported, non-API function.
    flock.midi.read.noteOn = function (channel, data) {
        return flock.midi.read.note("noteOn", channel, data);
    };

    // Unsupported, non-API function.
    flock.midi.read.noteOff = function (channel, data) {
        return flock.midi.read.note("noteOff", channel, data);
    };

    // Unsupported, non-API function.
    flock.midi.read.polyAftertouch = function (channel, data) {
        return {
            type: "aftertouch",
            channel: channel,
            note: data[1],
            pressure: data[2]
        };
    };

    // Unsupported, non-API function.
    flock.midi.read.controlChange = function (channel, data) {
        return {
            type: "control",
            channel: channel,
            number: data[1],
            value: data[2]
        };
    };

    // Unsupported, non-API function.
    flock.midi.read.programChange = function (channel, data) {
        return {
            type: "program",
            channel: channel,
            program: data[1]
        };
    };

    // Unsupported, non-API function.
    flock.midi.read.channelAftertouch = function (channel, data) {
        return {
            type: "aftertouch",
            channel: channel,
            pressure: data[1]
        };
    };

    // Unsupported, non-API function.
    flock.midi.read.twoByteValue = function (data) {
        return (data[2] << 7) | data[1];
    };

    // Unsupported, non-API function.
    flock.midi.read.pitchbend = function (channel, data) {
        return {
            type: "pitchbend",
            channel: channel,
            value: flock.midi.read.twoByteValue(data)
        };
    };

    // Unsupported, non-API function.
    flock.midi.read.system = function (status, data) {
        if (status === 1) {
            return flock.midi.messageFailure("quarter frame MTC");
        }

        var fn;
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

    // Unsupported, non-API function.
    flock.midi.messageFailure = function (type) {
        flock.fail("Flocking does not currently support MIDI " + type + " messages.");
        return;
    };

    // Unsupported, non-API function.
    flock.midi.read.sysex = function (data) {
        var begin = data[0] === 0xF0 ? 1 : 0,
            end = data.length - (data[data.length - 1] === 0xF7 ? 1 : 0);

        // Avoid copying the data if we're working with a typed array.
        var trimmedData = data instanceof Uint8Array ?
            data.subarray(begin, end) :
            data.slice(begin, end);

        return {
            type: "sysex",
            data: trimmedData
        };
    };

    // Unsupported, non-API function.
    flock.midi.read.valueMessage = function (type, value) {
        return {
            type: type,
            value: value
        };
    };

    // Unsupported, non-API function.
    flock.midi.read.songPointer = function (data) {
        var val = flock.midi.read.twoByteValue(data);
        return flock.midi.read.valueMessage("songPointer", val);
    };

    // Unsupported, non-API function.
    flock.midi.read.songSelect = function (data) {
        return flock.midi.read.valueMessage("songSelect", data[1]);
    };

    // Unsupported, non-API function.
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

    // Unsupported, non-API function.
    flock.midi.createSystemRealtimeMessageReaders = function (systemRealtimeMessages) {
        fluid.each(systemRealtimeMessages, function (type) {
            flock.midi.read[type] = function () {
                return {
                    type: type
                };
            };
        });
    };

    // Unsupported, non-API function.
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
            "onCreate.requestAccess": {
                func: "{that}.requestAccess"
            },

            "onAccessGranted.setAccess": {
                func: "flock.midi.system.setAccess",
                args: ["{that}", "{arguments}.0"]
            },

            "onAccessGranted.refreshPorts": {
                priority: "after:setAccess",
                func: "{that}.refreshPorts"
            },

            "onAccessGranted.fireOnReady": {
                priority: "after:refreshPorts",
                func: "{that}.events.onReady.fire",
                args: ["{that}.ports)"]
            },

            "onAccessError.logError": {
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
            pitchbend: null,
            sysex: null,
            songPointer: null,
            songSelect: null,
            tuneRequest: null,
            clock: null,
            start: null,
            continue: null,
            stop: null,
            activeSense: null,
            reset: null
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
                args: ["{that}", "{arguments}.0"]
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
            "onPortsAvailable.open": {
                funcName: "flock.midi.connection.autoOpen",
                args: [
                    "{that}.options.openImmediately", "{that}.open"
                ]
            },

            "onError.logError": {
                funcName: "fluid.log",
                args: [fluid.logLevel.WARN, "{arguments}.0"]
            },

            "raw.fireMidiEvent": {
                funcName: "flock.midi.connection.fireEvent",
                args: ["{arguments}.0", "{that}.events"]
            },

            "onDestroy.close": "{that}.close()"
        }
    });

    /**
     *
     * Take a MIDI messageSpec object and convert it to an array of raw bytes suitable for sending to a MIDI device.
     *
     * @param {Object} midiMessage a MIDI messageSpec object
     * @returns {Uint8Array} - an array containing the encoded MIDI message's bytes
     *
     */
    flock.midi.write = function (midiMessage) {
        if (midiMessage.type === "sysex") {
            return flock.midi.write.sysex(midiMessage);
        }

        // MIDI status nibbles are helpfully documented in this
        // SparkFun article:
        // https://learn.sparkfun.com/tutorials/midi-tutorial/all#messages
        switch (midiMessage.type) {
            case "noteOn":
                return flock.midi.write.note(9, midiMessage);
            case "noteOff":
                return flock.midi.write.note(8, midiMessage);
            case "aftertouch":
                return flock.midi.write.aftertouch(midiMessage);
            case "control":
                return flock.midi.write.controlChange(midiMessage);
            case "program":
                return flock.midi.write.programChange(midiMessage);
            case "pitchbend":
                return flock.midi.write.largeValueMessage(14, midiMessage.channel, midiMessage);
            case "songPointer":
                return flock.midi.write.largeValueMessage(15, 2, midiMessage);
            case "songSelect":
                return flock.midi.write.largeValueMessage(15, 3, midiMessage);
            case "tuneRequest":
                return flock.midi.write.singleByteMessage(15, 6);
            case "clock":
                return flock.midi.write.singleByteMessage(15, 8);
            case "start":
                return flock.midi.write.singleByteMessage(15, 10);
            case "continue":
                return flock.midi.write.singleByteMessage(15, 11);
            case "stop":
                return flock.midi.write.singleByteMessage(15, 12);
            case "activeSense":
                return flock.midi.write.singleByteMessage(15, 14);
            case "reset":
                return flock.midi.write.singleByteMessage(15, 15);
            default:
                flock.fail("Cannot write an unrecognized MIDI message of type '" + midiMessage.type + "'.");
        }
    };

    // Unsupported, non-API function.
    flock.midi.write.note = function (status, midiMessage) {
        return flock.midi.write.threeByteMessage(status, midiMessage.channel,
            midiMessage.note, midiMessage.velocity);
    };

    // Unsupported, non-API function.
    flock.midi.write.controlChange = function (midiMessage) {
        return flock.midi.write.threeByteMessage(11, midiMessage.channel,
            midiMessage.number, midiMessage.value);
    };

    // Unsupported, non-API function.
    flock.midi.write.programChange = function (midiMessage) {
        return flock.midi.write.twoByteMessage(12, midiMessage.channel, midiMessage.program);
    };

    // Unsupported, non-API function.
    flock.midi.write.aftertouch = function (midiMessage) {
        // polyAfterTouch
        if (midiMessage.note) {
            return flock.midi.write.note(10, midiMessage);
        }

        // afterTouch
        return flock.midi.write.twoByteMessage(13, midiMessage.channel, midiMessage.pressure);
    };

    // Unsupported, non-API function.
    flock.midi.write.singleByteMessage = function (msNibble, lsNibble) {
        var data = new Uint8Array(1);
        data[0] = flock.midi.write.statusByte(msNibble, lsNibble);
        return data;
    };

    // Unsupported, non-API function.
    flock.midi.write.twoByteMessage = function (msNibble, lsNibble, data1) {
        var data = new Uint8Array(2);
        data[0] = flock.midi.write.statusByte(msNibble, lsNibble);
        data[1] = data1;
        return data;
    };

    // Unsupported, non-API function.
    flock.midi.write.threeByteMessage = function (msNibble, lsNibble, data1, data2) {
        var data = new Uint8Array(3);
        data[0] = flock.midi.write.statusByte(msNibble, lsNibble);
        data[1] = data1;
        data[2] = data2;
        return data;
    };

    // Unsupported, non-API function.
    flock.midi.write.largeValueMessage = function (msNibble, lsNibble, midiMessage) {
        var data = new Uint8Array(3);
        data[0] = flock.midi.write.statusByte(msNibble, lsNibble);
        flock.midi.write.twoByteValue(midiMessage.value, data, 1);
        return data;
    };

    /**
     *
     * Output a status byte.
     *
     * @param {Number} msNibble - the first nibble of the status byte (often the command code).
     * @param {Number} lsNibble - the second nibble of the status byte (often the channel).
     * @return {Byte} A status byte that combines the two inputs.
     */
    // Unsupported, non-API function.
    flock.midi.write.statusByte = function (msNibble, lsNibble) {
        return (msNibble << 4) + lsNibble;
    };

    /**
     *
     * Converts a 14-bit numeric value to two MIDI bytes.
     *
     * @param {Number} value - A 14-bit number to convert
     * @param {Unit8TypedArray} array - An array to write the value to.
     * @param {Integer} offset - The optional offset in the array to start writing at.  Defaults to 0.
     *
     */
    // Unsupported, non-API function.
    flock.midi.write.twoByteValue =  function (value, array, offset) {
        offset = offset || 0;
        array[offset] = value & 0x7f; // LSB
        array[offset + 1] = (value >> 7) & 0x7f; // MSB
    };

    /**
     *
     * Convert a MIDI Message represented as a Javascript Object into a Sysex message represented as a Uint8Array.
     *
     * NOTE: This function does not accept framing, i.e. a leading 0xF0 and/or trailing 0xF7, and will fail if called
     * with either.
     *
     * @param {Object} midiMessage - The MIDI message represented as a Javascript Object.
     * @return {Uint8Array} - The sysex message.
     */
    // Unsupported, non-API function.
    flock.midi.write.sysex = function (midiMessage) {
        if (midiMessage.data[0] === 0xF0 || midiMessage.data[midiMessage.data.length - 1] === 0xF7) {
            flock.fail("Sysex payloads should not include framing bytes.");
        }

        var data = midiMessage.data,
            len = data.length;

        var framedData = new Uint8Array(len + 2);
        framedData[0] = 0xF0;
        framedData[len + 1] = 0xF7;
        framedData.set(data, 1);

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
