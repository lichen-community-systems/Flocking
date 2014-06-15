var fluid = require("infusion"),
    loader = fluid.getLoader(__dirname),
    flock = require(__dirname + "/../index.js");

flock.init();

var midiBand = flock.band({
    components: {
        synth: {
            type: "flock.synth",
            options: {
                synthDef: {
                    id: "carrier",
                    ugen: "flock.ugen.sinOsc",
                    freq: 440,
                    mul: {
                        id: "mod",
                        ugen: "flock.ugen.sinOsc",
                        freq: 1.0,
                        mul: 0.25
                	}
            	}
            }
        },

        midiConnection: {
            type: "flock.midi.connection",
            options: {
                openImmediately: true,

                ports: 0,

            	listeners: {
                    onError: {
                        "this": "console",
                        method: "log"
                    },

                    message: {
                        "this": "console",
                        method: "log"
                    },

                	control: {
                        func: "{synth}.set",
                        args: {
                            "carrier.freq": "@expand:flock.midiFreq({arguments}.0.value)"
                        }
                	}
            	}
            }
        }
    }
});

midiBand.play();
