/*
 * Flocking Node.js Web MIDI Polyfill/Monkeypatch
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2014-2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true,
    browser: false, node: true, forin: true, continue: true, nomen: true,
    bitwise: true, maxerr: 100, indent: 4 */

"use strict";

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock"),
    midi = require("midi");

fluid.registerNamespace("flock.midi.nodejs");

/**
 * MIDIAccess represents access to the midi system.
 * @constructor
 */
flock.midi.nodejs.MIDIAccess = function (options) {
    this.sysex = options.sysex !== undefined ? options.sysex : false;
    this.input = new midi.input();
    this.output = new midi.output();

    this.input.ignoreTypes(this.sysex, false, false);
};

var p = flock.midi.nodejs.MIDIAccess.prototype = {};
p.constructor = flock.midi.nodejs.MIDIAccess;

p.inputs = function () {
    return flock.midi.nodejs.getAllPorts("input", this.input);
};

p.outputs = function () {
    return flock.midi.nodejs.getAllPorts("output", this.output);
};

flock.midi.nodejs.getAllPorts = function (type, midi) {
    var numPorts = midi.getPortCount(),
        ports = new Array(numPorts);

    for (var i = 0; i < numPorts; i++) {
        ports[i] = new flock.midi.nodejs.MIDIPort(type, i);
    }

    return ports;
};


/**
 * MIDIPort represents a MIDI input or output port.
 * @constructor
 */
flock.midi.nodejs.MIDIPort = function (type, portNum) {
    this.type = type;
    this.midi = new midi[this.type]();
    this.portNum = portNum;
    this.name = this.midi.getPortName(this.portNum);
    this.listeners = {};
};

p = flock.midi.nodejs.MIDIPort.prototype = {};
p.constructor = flock.midi.nodejs.MIDIPort;

p.addEventListener = function (evtName, fn) {
    flock.midi.nodejs.throwIfNotMIDIMessage(evtName);
    this.midi.on("message", flock.midi.nodejs.wrapMessageListener(this, fn));
};

p.removeEventListener = function (evtName, fn) {
    flock.midi.nodejs.throwIfNotMIDIMessage(evtName);
    var listenerGUID = fn.__flock_midi_id,
        wrapper = this.listeners[listenerGUID];

    if (wrapper) {
        this.midi.removeListener("message", wrapper);
        this.listeners[listenerGUID] = undefined;
    }

    // TODO: Should we close the port when we have no listeners?
};

p.open = function () {
    this.midi.openPort(this.portNum);
};

p.send = function (data) {
    if (this.type !== "output") {
        throw new Error("An input port can't be used to send MIDI messages.");
    }

    this.midi.sendMessage(data);
};


flock.midi.nodejs.throwIfNotMIDIMessage = function (evtName) {
    if (evtName !== "midimessage") {
        throw new Error("Port.addListener() only supports the midimessage event.");
    }
};

var listenerID = 0;
flock.midi.nodejs.wrapMessageListener = function (that, fn) {
    var guid = "flock-guid-" + listenerID++;
    fn.__flock_midi_id = guid;

    var wrapper = function (deltaTime, data) {
        var e = {
            receivedTime: deltaTime,
            data: data
        };

        fn(e);
    };

    wrapper.__flock_midi_id = guid;
    that.listeners[guid] = wrapper;

    return wrapper;
};

flock.midi.nodejs.requestAccess = function (sysex, onAccessGranted, onError) {
    try {
        var access = new flock.midi.nodejs.MIDIAccess(sysex);
        onAccessGranted(access);
        return access;
    } catch (e) {
        onError(e);
    }
};

flock.midi.nodejs.openPort = function (port) {
    port.open();
};


// TODO: Replace this with something more civilized!
flock.midi.requestAccess = flock.midi.nodejs.requestAccess;
flock.midi.connection.openPort = flock.midi.nodejs.openPort;
