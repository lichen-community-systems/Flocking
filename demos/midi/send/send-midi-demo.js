/*global fluid, flock*/

(function () {
    "use strict";

    fluid.defaults("flock.demo.midiInputView", {
        gradeNames: "fluid.codeMirror",

        codeMirrorOptions: {
            lineWrapping: true,
            readOnly: true
        },

        theme: "flockingcm",
        lineNumbers: true,
        lineWrapping: true,

        model: {
            content: "F0 7E 7F 06 01 F7"
        },

        invokers: {
            updateContent: {
                funcName: "flock.demo.midiInputView.updatedContentModel",
                args: ["{that}"]
            }
        },

        listeners: {
            "onCreate.setContentFromModel": {
                func: "{that}.setContent",
                args: ["{that}.model.content"]
            }
        }
    });

    flock.demo.midiInputView.updatedContentModel = function (that) {
        var content = that.getContent();
        that.applier.change("content", content);
    };

    fluid.defaults("flock.demo.midiHexStringParser", {
        gradeNames: "fluid.modelComponent",

        model: {
            commands: []
        },

        modelRelay: {
            target: "commands",
            singleTransform: {
                type: "fluid.transforms.free",
                func: "flock.demo.midiHexStringParser.parseMidiCommands",
                args: ["{midiInputView}.model.content"]
            }
        }
    });

    flock.demo.midiHexStringParser.parseMidiByteString = function (byteString, i) {
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

    flock.demo.midiHexStringParser.parseMidiCommand = function (commandString) {
        if (commandString.length < 1) {
            return;
        }

        var midiByteStrings = commandString.split(" "),
            bytes = [];

        fluid.each(midiByteStrings, function (byteString, i) {
            var byte = flock.demo.midiHexStringParser.parseMidiByteString(byteString, i);
            if (byte) {
                bytes.push(byte);
            }
        });

        return new Uint8Array(bytes);
    };

    flock.demo.midiHexStringParser.parseMidiCommands = function (midiString) {
        var commandStrings = midiString.split("\n"),
            commands = [];

        fluid.each(commandStrings, function (commandString) {
            var command = flock.demo.midiHexStringParser.parseMidiCommand(commandString);
            if (command) {
                commands.push(command);
            }
        });

        return commands;
    };

    fluid.defaults("flock.demo.midiSender", {
        gradeNames: "fluid.viewComponent",

        invokers: {
            send: "{that}.events.onSend.fire"
        },

        components: {
            connector: {
                type: "flock.ui.midiConnector",
                container: "{that}.dom.midiPortSelector",
                options: {
                    portType: "output"
                }
            }
        },

        events: {
            onSend: null
        },

        listeners: {
            "onCreate.bindSendButton": {
                "this": "{that}.dom.sendButton",
                method: "click",
                args: ["{that}.send"]
            },

            "onSend.sendMidiCommand": {
                priority: "last",
                funcName: "flock.demo.midiSender.sendCommand",
                args: ["{that}"]
            }
        },

        selectors: {
            type: ".type",
            channel: ".channel",
            note: ".note",
            velocity: ".velocity",
            sendButton: "button.send",
            midiPortSelector: "#midi-port-selector"
        }
    });

    flock.demo.midiSender.sendCommand = function (that) {
        var command = {};
        // TODO: Discuss using gpii-binder here.
        // (Sounds like a great idea!)
        fluid.each(["type", "channel", "note", "velocity"], function (param) {
            var element = that.locate(param);
            command[param] = JSON.parse(element.val());
        });

        // TODO: This is a bit ugly...
        // Channels in Flocking MIDI messageSpecs are currently
        // 0-indexed (i.e. 0-15). But to make better UIs easier,
        // should we automatically convert them to start at 1?
        if (command.channel) {
            command.channel = command.channel - 1;
        }

        that.connector.connection.send(command);
    };
}());
