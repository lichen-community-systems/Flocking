/*
* Flocking Node.js-Specific Code
* http://github.com/colinbdclark/flocking
*
* Copyright 2013, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global */
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var fs = require("fs"),
    url = require("url"),
    fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock"),
    Speaker = require("speaker"),
    Readable = require("stream").Readable,
    midi = require("midi");

(function () {
    "use strict";

    /*********************************************************
     * Override default clocks with same-thread alternatives *
     *********************************************************/

    fluid.demands("flock.scheduler.webWorkerIntervalClock", ["flock.platform.nodejs", "flock.scheduler.async"], {
        funcName: "flock.scheduler.intervalClock"
    });

    fluid.demands("flock.scheduler.webWorkerScheduleClock", ["flock.platform.nodejs", "flock.scheduler.async"], {
        funcName: "flock.scheduler.scheduleClock"
    });


    /********************************************
     * Override buffer loading implementations. *
     ********************************************/

    fluid.registerNamespace("flock.file");

    flock.file.readFromPath = function (options) {
        var path = options.src;

        fs.exists(path, function (exists) {
            if (!exists && options.error) {
                options.error(path + " doesn't exist.");
                return;
            }

            fs.stat(path, function (error, stats) {
                fs.open(path, "r", function (error, fd) {
                    var buf = new Buffer(stats.size);
                    fs.read(fd, buf, 0, buf.length, null, function (error, bytesRead) {
                        var type = flock.file.parseFileExtension(path);
                        var arr = new Int8Array(buf);
                        options.success(arr.buffer, type);
                    });
                });
            });
        })
    };

    fluid.registerNamespace("flock.net");

    flock.net.readBufferFromUrl = function (options) {
        throw new Error("Loading files from URLs is not currently supported in Node.js.");
    };

    fluid.registerNamespace("flock.audio.loadBuffer");

    flock.audio.loadBuffer.readerForSource = function (src) {
        if (typeof (src) !== "string") {
            throw new Error("Flocking error: Can't load a buffer from an unknown type of source. " +
                "Only paths and URLs are currently supported on Node.js.");
        }
        var parsed = url.parse(src);
        return parsed.protocol === "data:" ? flock.file.readBufferFromDataUrl :
            !parsed.protocol ? flock.file.readFromPath : flock.net.readBufferFromUrl;
    };

    fluid.registerNamespace("flock.audio.decode");

    // TODO: Use a stream-style interface for decoding rather than just dumping the whole job on nextTick().
    flock.audio.decode.async = function (options) {
        process.nextTick(function () {
            flock.audio.decode.sync(options);
        });
    };


    /*********************************************
     * Node.js-based Environment implementation. *
     *********************************************/

    fluid.registerNamespace("flock.enviro");

    fluid.defaults("flock.enviro.nodejs", {
        gradeNames: ["flock.enviro.audioStrategy", "autoInit"]
    });

    flock.enviro.nodejs.finalInit = function (that) {
        that.startGeneratingSamples = function () {
            that.outputStream._read = that.writeSamples;
            that.outputStream.pipe(that.speaker);
        };

        that.writeSamples = function (numBytes) {
            var settings = that.options.audioSettings,
                m = that.model,
                playState = m.playState,
                bytesPerSample = m.bytesPerSample,
                blockSize = settings.blockSize,
                chans = settings.chans,
                krPeriods = numBytes / m.bytesPerBlock,
                evaluator = that.nodeEvaluator,
                outputStream = that.outputStream,
                out = new Buffer(numBytes);

            if (numBytes < m.bytesPerBlock) {
                return;
            }

            if (evaluator.nodes.length < 1) {
                // If there are no nodes providing samples, write out silence.
                flock.generate.silence(out);
            } else {
                for (var i = 0, offset = 0; i < krPeriods; i++, offset += m.bytesPerBlock) {
                    evaluator.clearBuses();
                    evaluator.gen();

                    // Interleave each output channel.
                    for (var chan = 0; chan < chans; chan++) {
                        var bus = evaluator.buses[chan];
                        for (var sampIdx = 0; sampIdx < blockSize; sampIdx++) {
                            var frameIdx = (sampIdx * chans + chan) * bytesPerSample;
                            out.writeFloatLE(bus[sampIdx], offset + frameIdx);
                        }
                    }
                }
            }

            outputStream.push(out);

            playState.written += settings.bufferSize * chans;
            if (playState.written >= playState.total) {
                that.stop();
            }
        };

        that.stopGeneratingSamples = function () {
            that.outputStream.unpipe(that.speaker);
            that.outputStream._read = undefined;
        };

        // TODO: Implement audio input on Node.js.
        that.startReadingAudioInput = that.stopReadingAudioInput = function () {
            throw new Error("Audio input is not currently supported on Node.js");
        };

        that.init = function () {
            var settings = that.options.audioSettings,
                rates = settings.rates,
                bufSize = settings.bufferSize,
                m = that.model;

            m.bytesPerSample = 4;// Flocking uses Float32s, hence 4 bytes.
            m.bytesPerBlock = settings.blockSize * settings.chans * m.bytesPerSample;
            m.pushRate = (bufSize / rates.audio) * 1000;
            that.speaker = new Speaker({
                sampleRate: settings.rates.audio,
                float: true,
                bitDepth: 32,
                signed: true,
                endianness: "LE",
                samplesPerFrame: settings.blockSize
            });
            that.outputStream = flock.enviro.nodejs.setupOutputStream(settings);
        };

        that.init();
    };

    flock.enviro.nodejs.setupOutputStream = function (settings) {
        var outputStream = new Readable({
            highWaterMark: settings.bufferSize * settings.chans * 4
        });

        outputStream.bitDepth = 32;
        outputStream.float = true
        outputStream.signed = true;
        outputStream.channels = settings.chans;
        outputStream.sampleRate = settings.rates.audio;
        outputStream.samplesPerFrame = settings.bufferSize;

        return outputStream;
    };

    fluid.demands("flock.enviro.audioStrategy", "flock.platform.nodejs", {
        funcName: "flock.enviro.nodejs"
    });


    /****************************
     * Web MIDI Pseudo-Polyfill *
     ****************************/

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
        this.midi.openPort(this.portNum);
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
        fn.__flock_midi_id = guid

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

    // TODO: Replace this with something more civilized!
    flock.midi.requestAccess = flock.midi.nodejs.requestAccess;

}());
