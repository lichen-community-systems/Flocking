var fundamental = 440;

var polySynth = flock.synth.polyphonic({
    synthDef: {
        id: "carrier",
        ugen: "flock.ugen.sin",
        freq: fundamental,
        mul: {
            id: "env",
            ugen: "flock.ugen.asr",
            attack: 0.25,
            sustain: 1.0,
            release: 0.5
        }
    }
});

var score = [
    {
        action: "noteOn",
        noteName: "root",
        change: {
            "carrier.freq": fundamental
        }
    },

    {
        action: "noteOn",
        noteName: "mediant",
        change: {
            "carrier.freq": fundamental * 5/4
        }
    },

    {
        action: "noteOn",
        noteName: "dominant",
        change: {
            "carrier.freq": fundamental * 3/2
        }
    },

    {
        action: "noteOff",
        noteName: "root"
    },

    {
        action: "noteOff",
        noteName: "mediant"
    },

    {
        action: "noteOff",
        noteName: "dominant"
    }
];


// Outside of the Playground, you'll need to
// specify a flock.enviro.withScheduler or
// define your own Scheduler.
var idx = 0;
flock.environment.scheduler.schedule({
    type: "repeat",
    interval: 0.5,
    callback: function () {
        if (idx >= score.length) {
            idx = 0;
        }
        var event = score[idx];
        polySynth[event.action](event.noteName, event.change);
        idx++;
    }
});
