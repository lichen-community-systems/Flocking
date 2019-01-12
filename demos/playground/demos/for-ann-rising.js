// James Tenney's For Ann Rising.

// Outside of the Playground, you'll need to
// specify a flock.enviro.withScheduler or
// define your own Scheduler.
var scheduler = flock.environment.scheduler,
    numSynths = 240,
    synths = [];

var forAnnSynthDef = {
    ugen: "flock.ugen.sinOsc",
    freq: {
        ugen: "flock.ugen.envGen",
        envelope: {
            levels: [40, 10240],
            times: [33.6],
            curve: "exponential"
        },
        gate: 1.0
    },
    mul: {
        ugen: "flock.ugen.envGen",
        envelope: {
            type: "flock.envelope.linear",
            attack: 8.4,
            sustain: 16.8,
            release: 8.4
        },
        gate: 1.0,
        mul: 0.1
    }
};

// To save cycles during performance,
// create all the voices ahead of time.
for (var i = 0; i < numSynths; i++) {
    var synth = flock.synth({
        synthDef: forAnnSynthDef,
        addToEnvironment: false
    });

    synths[i] = synth;
}

// Use the scheduler to start a new synth playing
// every 2.8 seconds.
var nextSynthIdx = 0;
scheduler.schedule({
    type: "repeat",
    freq: 1/2.8,
    end: 2.8 * numSynths,
    callback: function () {
        var synth = synths[nextSynthIdx];
        synth.addToEnvironment("tail");
        nextSynthIdx++;
    }
});

// Remove each synth after its envelope has reached its target.
// (Flocking doesn't yet have "done actions" like in SuperCollider).
var synthToRemoveIdx = 0;
scheduler.schedule({
    type: "repeat",
    freq: 1/34,
    time: 34,
    callback: function () {
        var synth = synths[synthToRemoveIdx];
        synth.pause();

        synthToRemoveIdx++;
        if (synthToRemoveIdx === numSynths - 1) {
            scheduler.clearAll();
        }
    }
});
