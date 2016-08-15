/*global fluid, flock*/

(function () {
    "use strict";

    var environment = flock.init();

    fluid.defaults("flock.demo.midiReceive.messageView", {
        gradeNames: "fluid.codeMirror",

        codeMirrorOptions: {
            readOnly: true
        },

        theme: "flockingcm",
        lineNumbers: true,
        readOnly: true
    });

    fluid.defaults("flock.midiDemo", {
        gradeNames: "fluid.viewComponent",

        components: {
            enviro: "{flock.enviro}",

            midiMessageView: {
                type: "flock.demo.midiReceive.messageView",
                container: "{that}.dom.messageRegion"
            },

            midiConnector: {
                type: "flock.ui.midiConnector",
                container: "{that}.dom.midiPortSelector",
                options: {
                    listeners: {
                        message: {
                            func: "flock.midiDemo.logMIDIMessage",
                            args: [
                                "{midiDemo}.midiMessageView",
                                "{midiDemo}.options.strings.midiMessage",
                                "{arguments}.0",
                                "{arguments}.1"
                            ]
                        },

                        noteOn: {
                            func: "{synth}.noteOn",
                            args: [
                                "{arguments}.0.note",
                                {
                                    "freq.note": "{arguments}.0.note",
                                    "amp.velocity": "{arguments}.0.velocity"
                                }
                            ]
                        },

                        noteOff: "{synth}.noteOff({arguments}.0.note)"
                    }
                }
            },

            synth: {
                type: "flock.midiDemo.synth"
            }
        },

        listeners: {
            onCreate: [
                "{enviro}.start()"
            ]
        },

        selectors: {
            midiPortSelector: "#midi-port-selector",
            messageRegion: "#midiMessageRegion"
        },

        strings: {
            midiMessage: "%hours:%minutes:%seconds.%millis - %manufacturer %name: %msg"
        }
    });

    flock.midiDemo.logMIDIMessage = function (midiMessageView, msgTemplate, msg, rawEvent) {
        var content = midiMessageView.getContent(),
            nowDate = new Date();

        var port = rawEvent.target,
            messageText = fluid.stringTemplate(msgTemplate, {
                hours: nowDate.getHours(),
                minutes: nowDate.getMinutes(),
                seconds: nowDate.getSeconds(),
                millis: nowDate.getMilliseconds(),
                manufacturer: port.manufacturer,
                name: port.name,
                msg: fluid.prettyPrintJSON(msg)
            });

        content += messageText + "\n\n";
        midiMessageView.setContent(content);
    };

    fluid.defaults("flock.midiDemo.synth", {
        gradeNames: ["flock.synth.polyphonic"],

        synthDef: {
            ugen: "flock.ugen.square",
            freq: {
                id: "freq",
                ugen: "flock.ugen.midiFreq",
                note: 60
            },
            mul: {
                id: "env",
                ugen: "flock.ugen.envGen",
                envelope: {
                    type: "flock.envelope.adsr",
                    attack: 0.2,
                    decay: 0.1,
                    sustain: 1.0,
                    release: 1.0
                },
                gate: 0.0,
                mul: {
                    id: "amp",
                    ugen: "flock.ugen.midiAmp",
                    velocity: 0
                }
            }
        }
    });

}());
