// James Tenney's For Ann Rising.

var sked = flock.environment.asyncScheduler,
    numSynths = 240,
    synths = [],
	nextSynthIdx = 0,
	synthToRemoveIdx = 0;

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
var adder = sked.repeat(2.8, function () {
    var synth = synths[nextSynthIdx];
    synth.addToEnvironment("tail");

    nextSynthIdx++;
    if (nextSynthIdx >= numSynths) {
        sked.clear(adder);
    }
});

// Remove each synth after its envelope has reached its target.
// (Flocking doesn't yet have "done actions" like in SuperCollider).
sked.repeat(34, function () {
    var synth = synths[synthToRemoveIdx];

    // Destroying a synth will remove it from the environment as well,
    // but means that it can't be reused later.
    synth.destroy();

    synthToRemoveIdx++;
    if (synthToRemoveIdx >= numSynths) {
        sked.clearAll();
    }
});
