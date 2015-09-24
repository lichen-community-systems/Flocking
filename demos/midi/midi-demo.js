/*global fluid, flock*/

(function () {
    "use strict";

    var environment = flock.init();

    fluid.defaults("flock.midiDemo", {
        gradeNames: "fluid.viewComponent",

        components: {
            enviro: "{flock.enviro}",

            midiConnector: {
                type: "flock.ui.midiConnector",
                container: "{that}.container",
                options: {
                    listeners: {
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
        }
    });


    // Imperative equivalent to the above.
    flock.programmaticMIDIDemo = function (container) {
        var that = {
            midiConnector: flock.ui.midiConnector(container),
            synth: flock.midiDemo.synth()
        };

        that.midiConnector.events.noteOn.addListener(function (noteEvent) {
            that.synth.noteOn(noteEvent.note, {
                "freq.note": noteEvent.note,
                "amp.velocity": noteEvent.velocity,
                "env.gate": 1.0
            });
        });

        that.midiConnector.events.noteOff.addListener(function (noteEvent) {
            that.synth.noteOff(noteEvent.note);
        });

        environment.start();

        return that;
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
