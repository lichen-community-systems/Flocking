/*
 * Flocking Web MIDI
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2014, Colin Clark
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
        var ports = {},
            portCollector = typeof access.inputs === "function" ?
                flock.midi.collectPortsLegacy : flock.midi.collectPorts;

        portCollector("inputs", access, ports);
        portCollector("outputs", access, ports);

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

        // TODO: Switch to ES6 for..of syntax when it's safe to do so
        // across all supported Flocking environments
        // (i.e. when Node.js and eventually IE support it).
        var next = iterator.next();
        while (!next.done) {
            portsForType.push(next.value);
            next = iterator.next();
        }

        return ports;
    };

    // TODO: Remove this when the new Web MIDI API makes it
    // into the Chrome release channel.
    flock.midi.collectPortsLegacy = function (type, access, ports) {
        if (access[type]) {
            ports[type] = access[type]();
        }

        return ports;
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
        return {
            type: type,
            chan: chan,
            note: data[1],
            velocity: data[2]
        };
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
            send: {
                func: "{that}.events.onSendMessage.fire"
            },

            open: {
                funcName: "flock.midi.connection.bind",
                args: [
                    "{system}.ports",
                    "{that}.options.ports",
                    "{that}.events.onReady.fire",
                    "{that}.events.raw.fire",
                    "{that}.events.onSendMessage"
                ]
            },

            close: {
                funcName: "flock.midi.connection.close",
                args: [
                    "{system}.ports",
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
            onSendMessage: null
        },

        listeners: {
            onPortsAvailable: {
                funcName: "flock.midi.connection.autoOpen",
                args: [
                    "{connection}.options.openImmediately", "{connection}.open"
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

    flock.midi.connection.bindSender = function (port, onSendMessage, openPromises) {
        var ports = fluid.makeArray(port);

        fluid.each(ports, function (port) {
            flock.midi.connection.openPort(port, openPromises);
            onSendMessage.addListener(port.send.bind(port));
        });

        return openPromises;
    };

    flock.midi.connection.fireReady = function (openPromises, onReady) {
        if (!openPromises || openPromises.length < 1) {
            return;
        }

        Promise.all(openPromises).then(onReady);
    };

    flock.midi.connection.bind = function (ports, portSpec, onReady, onRaw, onSendMessage) {
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
            flock.midi.connection.bindSender(output, onSendMessage, openPromises);
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

        events.message.fire(model);

        // TODO: Remove this special-casing of noteOn/noteOff events into note events.
        if (model.type === "noteOn" || model.type === "noteOff") {
            events.note.fire(model);
        }

        if (eventForType) {
            eventForType.fire(model);
        }
    };


    fluid.defaults("flock.midi.controller", {
        gradeNames: ["fluid.component"],

        members: {
            controlMap: "@expand:flock.midi.controller.optimizeControlMap({that}.options.controlMap)",
            noteMap: "{that}.options.noteMap"
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

                    openImmediately: true,    // Immediately upon instantiating the connection.

                    listeners: {
                        control: {
                            func: "{controller}.mapControl"
                        },
                        note: {
                            func: "{controller}.mapNote"
                        }
                    }
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
                args: ["{arguments}.0", "{that}.synthContext", "{that}.noteMap"]
            }
        }
    });

    flock.midi.controller.optimizeControlMap = function (controlMap) {
        var controlMapArray = new Array(127);
        fluid.each(controlMap, function (mapSpec, controlNum) {
            var idx = Number(controlNum);
            controlMapArray[idx] = mapSpec;
        });

        return controlMapArray;
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
        if (!map) {
            return;
        }

        value = map.transform ? flock.midi.controller.transformValue(value, map) : value;
        var synth = synthContext[map.synth] || synthContext;

        synth.set(map.input, value);
    };

    flock.midi.controller.mapControl = function (midiMsg, synthContext, controlMap) {
        var map = controlMap[midiMsg.number],
            value = midiMsg.value;

        flock.midi.controller.setMappedValue(value, map, synthContext);
    };

    // TODO: Add support for defining listener filters or subsets
    // of all midi notes (e.g. for controllers like the Quneo).
    flock.midi.controller.mapNote = function (midiMsg, synthContext, noteMap) {
        var keyMap = noteMap.note,
            key = midiMsg.note,
            velMap = noteMap.velocity,
            vel = midiMsg.velocity;

        if (keyMap) {
            flock.midi.controller.setMappedValue(key, keyMap, synthContext);
        }

        if (velMap) {
            flock.midi.controller.setMappedValue(vel, velMap, synthContext);
        }
    };

}());
