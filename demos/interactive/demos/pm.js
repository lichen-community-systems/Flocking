/*global flock*/

flock.synth({
    "description": "Modulating a sine wave's phase with another sine wave.",
    "synthDef": {
        "id": "carrier",
        "ugen": "flock.ugen.sinOsc",
        "freq": 440,
        "phase": {
            "id": "mod",
            "ugen": "flock.ugen.sinOsc",
            "freq": 20.0,
            "mul": flock.TWOPI
        },
        "mul": 0.25
    }
});
