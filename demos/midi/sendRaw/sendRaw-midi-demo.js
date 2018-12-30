/*global fluid, flock*/

(function () {
    "use strict";

    fluid.defaults("flock.demo.rawMidiInputView", {
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
                funcName: "flock.demo.rawMidiInputView.updatedContentModel",
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

    flock.demo.rawMidiInputView.updatedContentModel = function (that) {
        var content = that.getContent();
        that.applier.change("content", content);
    };

    fluid.defaults("flock.demo.rawMidiParser", {
        gradeNames: "fluid.modelComponent",

        model: {
            commands: []
        },

        modelRelay: {
            target: "commands",
            singleTransform: {
                type: "fluid.transforms.free",
                func: "flock.demo.rawMidiParser.parseMidiCommands",
                args: ["{midiInputView}.model.content"]
            }
        }
    });

    flock.demo.rawMidiParser.parseMidiByteString = function (byteString, i) {
        if (byteString.length < 1) {
            return;
        }

        if (byteString.length !== 2) {
            flock.fail("An invalid byte was found at token index " + i + ": " + byteString);
            return;
        }

        var byte = parseInt(byteString, 16);

        if (isNaN(byte)) {
            flock.fail("A non-numeric value was found at token index " + i + ": " + byteString);
            return;
        }

        return byte;
    };

    flock.demo.rawMidiParser.parseMidiCommand = function (commandString) {
        if (commandString.length < 1) {
            return;
        }

        var midiByteStrings = commandString.split(" "),
            bytes = [];

        fluid.each(midiByteStrings, function (byteString, i) {
            var byte = flock.demo.rawMidiParser.parseMidiByteString(byteString, i);
            if (byte !== undefined) {
                bytes.push(byte);
            }
        });

        return new Uint8Array(bytes);
    };

    flock.demo.rawMidiParser.parseMidiCommands = function (midiString) {
        var commandStrings = midiString.split("\n"),
            commands = [];

        fluid.each(commandStrings, function (commandString) {
            var command = flock.demo.rawMidiParser.parseMidiCommand(commandString);
            if (command) {
                commands.push(command);
            }
        });

        return commands;
    };

    fluid.defaults("flock.demo.rawMidiSender", {
        gradeNames: "fluid.viewComponent",

        commandDelay: 0.1,

        model: {
            commandScore: []
        },

        modelRelay: {
            target: "commandScore",
            singleTransform: {
                type: "fluid.transforms.free",
                func: "flock.demo.rawMidiSender.schedulerScoreForCommands",
                args: ["{that}.parser.model.commands", "{that}"]
            }
        },

        invokers: {
            send: "{that}.events.onSend.fire"
        },

        components: {
            connector: {
                type: "flock.ui.midiConnector",
                container: "{that}.dom.midiPortSelector",
                options: {
                    portType: "output",
                    components: {
                        connection: {
                            options: {
                                sysex: true
                            }
                        }
                    }
                }
            },
            parser: {
                type: "flock.demo.rawMidiParser"
            },

            midiInputView: {
                type: "flock.demo.rawMidiInputView",
                container: "{that}.dom.rawMidiArea"
            },

            scheduler: {
                type: "flock.scheduler.async"
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

            "onSend.updateContent": {
                priority: "first",
                func: "{midiInputView}.updateContent"
            },

            "onSend.sendMidiCommands": {
                priority: "last",
                funcName: "flock.demo.rawMidiSender.enqueueMidiCommands",
                args: ["{that}.model.commandScore", "{that}"]
            }
        },

        selectors: {
            rawMidiArea: "#code",
            sendButton: "button.send",
            midiPortSelector: "#midi-port-selector"
        }
    });

    flock.demo.rawMidiSender.sendCommand = function (command, that) {
        that.connector.connection.sendRaw(command);
    };

    flock.demo.rawMidiSender.schedulerScoreForCommands = function (commands, that) {
        return fluid.transform(commands, function (command, i) {
            return {
                interval: "once",
                time: i * that.options.commandDelay,
                change: function () {
                    flock.demo.rawMidiSender.sendCommand(command, that);
                }
            };
        });
    };

    flock.demo.rawMidiSender.enqueueMidiCommands = function (commandScore, that) {
        if (commandScore.length < 1 || !that.connector.connection) {
            return;
        }

        // Stop any currently-queued MIDI commands prior to sending new ones.
        that.scheduler.clearAll();
        that.scheduler.schedule(commandScore);
    };
}());
