/* global require */
var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";
    fluid.defaults("flock.midi.rawMIDIParser", {
        gradeNames: "fluid.modelComponent",

        model: {
            commands: []
        },

        modelRelay: {
            target: "commands",
            singleTransform: {
                type: "fluid.transforms.free",
                func: "flock.midi.rawMIDIParser.parseMIDICommands",
                args: ["{midiInputView}.model.content"]
            }
        }
    });

    fluid.registerNamespace("flock.midi.rawMIDIParser");
    flock.midi.rawMIDIParser.parseMIDIByteString = function (byteString, i) {
        if (byteString.length < 1) {
            return;
        }

        if (byteString.length !== 2) {
            flock.fail("An invalid byte was found at token index " + i + ": " + byteString);
            return;
        }

        var byte = parseInt(byteString, 16);

        return byte;
    };

    flock.midi.rawMIDIParser.parseMIDICommand = function (commandString) {
        if (commandString.length < 1) {
            return;
        }

        var midiByteStrings = commandString.split(" "),
            bytes = [];

        fluid.each(midiByteStrings, function (byteString, i) {
            var byte = flock.midi.rawMIDIParser.parseMIDIByteString(byteString, i);
            if (byte !== undefined) {
                bytes.push(byte);
            }
        });

        return new Uint8Array(bytes);
    };

    flock.midi.rawMIDIParser.parseMIDICommands = function (midiString) {
        var commandStrings = midiString.split("\n"),
            commands = [];

        fluid.each(commandStrings, function (commandString) {
            var command = flock.midi.rawMIDIParser.parseMIDICommand(commandString);
            if (command) {
                commands.push(command);
            }
        });

        return commands;
    };
})();
