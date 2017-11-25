/*global fluid, flock*/

(function () {
    "use strict";

    fluid.defaults("flock.demo.rawMIDIInputView", {
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
                funcName: "flock.demo.rawMIDIInputView.updatedContentModel",
                args: ["{that}"]
            }
        },

        listeners: {
            onCreate: "{that}.setContent({that}.model.content)"
        }
    });

    flock.demo.rawMIDIInputView.updatedContentModel = function (that) {
        var content = that.getContent();
        that.applier.change("content", content);
    };

    fluid.defaults("flock.demo.rawMIDIParser", {
        gradeNames: "fluid.modelComponent",

        model: {
            commands: []
        },

        modelRelay: {
            target: "commands",
            singleTransform: {
                type: "fluid.transforms.free",
                func: "flock.demo.rawMIDIParser.parseMIDICommands",
                args: ["{midiInputView}.model.content"]
            }
        }
    });

    flock.demo.rawMIDIParser.parseMIDIByteString = function (byteString, i) {
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

    flock.demo.rawMIDIParser.parseMIDICommand = function (commandString) {
        if (commandString.length < 1) {
            return;
        }

        var midiByteStrings = commandString.split(" "),
            bytes = [];

        fluid.each(midiByteStrings, function (byteString, i) {
            var byte = flock.demo.rawMIDIParser.parseMIDIByteString(byteString, i);
            if (byte) {
                bytes.push(byte);
            }
        });

        return new Uint8Array(bytes);
    };

    flock.demo.rawMIDIParser.parseMIDICommands = function (midiString) {
        var commandStrings = midiString.split("\n"),
            commands = [];

        fluid.each(commandStrings, function (commandString) {
            var command = flock.demo.rawMIDIParser.parseMIDICommand(commandString);
            if (command) {
                commands.push(command);
            }
        });

        return commands;
    };

    fluid.defaults("flock.demo.rawMIDISender", {
        gradeNames: "fluid.viewComponent",

        commandDelay: 0.1,

        model: {
            commandScore: []
        },

        modelRelay: {
            target: "commandScore",
            singleTransform: {
                type: "fluid.transforms.free",
                func: "flock.demo.rawMIDISender.schedulerScoreForCommands",
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
                type: "flock.demo.rawMIDIParser"
            },

            midiInputView: {
                type: "flock.demo.rawMIDIInputView",
                container: "{that}.dom.rawMIDIArea"
            },

            scheduler: {
                type: "flock.scheduler.async"
            }
        },

        events: {
            onSend: null
        },

        listeners: {
            onCreate: [
                {
                    "this": "{that}.dom.sendButton",
                    method: "click",
                    args: ["{that}.send"]
                }
            ],

            onSend: [
                {
                    priority: "first",
                    func: "{midiInputView}.updateContent"
                },
                {
                    priority: "last",
                    funcName: "flock.demo.rawMIDISender.enqueueMIDICommands",
                    args: ["{that}.model.commandScore", "{that}"]
                }
            ]
        },

        selectors: {
            rawMIDIArea: "#code",
            sendButton: "button.send",
            midiPortSelector: "#midi-port-selector"
        }
    });

    flock.demo.rawMIDISender.sendCommand = function (command, that) {
        that.connector.connection.sendRaw(command);
    };

    flock.demo.rawMIDISender.schedulerScoreForCommands = function (commands, that) {
        return fluid.transform(commands, function (command, i) {
            return {
                interval: "once",
                time: i * that.options.commandDelay,
                change: function () {
                    flock.demo.rawMIDISender.sendCommand(command, that);
                }
            };
        });
    };

    flock.demo.rawMIDISender.enqueueMIDICommands = function (commandScore, that) {
        if (commandScore.length < 1 || !that.connector.connection) {
            return;
        }

        // Stop any currently-queued MIDI commands prior to sending new ones.
        that.scheduler.clearAll();
        that.scheduler.schedule(commandScore);
    };
}());
