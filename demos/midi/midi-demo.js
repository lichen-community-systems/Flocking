/*global fluid, flock*/

(function () {
    "use strict";

    flock.init();

    fluid.defaults("flock.midiDemo", {
        gradeNames: ["fluid.viewComponent"],

        components: {
            environment: "{environment}",

            midiConnector: {
                type: "flock.ui.midiConnector",
                container: "{that}.container",
                options: {
                    listeners: {
                        noteOn: {
                            func: "{synth}.set",
                            args: {
                                "freq.note": "{arguments}.0.note",
                                "amp.velocity": "{arguments}.0.velocity",
                                "env.gate": 1.0
                            }
                        },

                        noteOff: "{synth}.set(env.gate, 0.0)"
                    }
                }
            },

            synth: {
                type: "flock.midiDemo.synth"
            }
        },

        listeners: {
            onCreate: [
                "{environment}.start()"
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
            that.synth.set({
                "freq.note": noteEvent.note,
                "amp.velocity": noteEvent.velocity,
                "env.gate": 1.0
            });
        });

        that.midiConnector.events.noteOff.addListener(function () {
            that.synth.set("env.gate", 0.0);
        });

        flock.environment.start();

        return that;
    };

    
    fluid.defaults("flock.midiDemo.synth", {
        gradeNames: ["flock.synth"],

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
