/*global flock*/

// Adds together a bank of sine oscillators to make
// a rudimentary clarinet tone with additive synthesis.

var fundamental = 440,
    harmonics = [1, 3, 5, 7, 9, 13, 15], // Clarinets only have odd partials.
    baseHarmonicDef = {
        ugen: "flock.ugen.saw",
        freq: 440,
        mul: {
            ugen: "flock.ugen.envGen",
            envelope: {
                type: "flock.envelope.adsr",
                attack: 0.1,
                decay: 0.05,
                sustain: 0.75,
                release: 0.2
            },
            gate: {
                id: "gate",
                ugen: "flock.ugen.inputChangeTrigger",
                source: 1.0,
                duration: 0.8
            },
            mul: 1.0
        }
    };

function expandHarmonics(fundamental, harmonics) {
    return fluid.transform(harmonics, function (harmonic, i) {
        var partialNum = i + 1;

        // Merge together the base ugenDef for all harmonics
        // with the parameters for this specific harmonic.
        return $.extend(true, {}, baseHarmonicDef, {
            freq: fundamental * harmonic,
            mul: {
                // Amplitude for a clarient should be the
                // inverse of the partial number. Then we scale
                // the amplitude for the number of partials
                // so that we don't clip.
                mul: (1 / partialNum) / harmonics.length
            }
        });
    });
}

function updateHarmonics(fundamental, harmonics, ugens) {
    fluid.each(harmonics, function (harmonic, i) {
        var ugen = ugens[i],
            freq = fundamental * harmonic;

        ugen.set({
            "freq": freq,
            "mul.gate.source": 1.0
        });
    });
}

var synth = flock.synth({
    synthDef: {
        ugen: "flock.ugen.filter.biquad.bp",
        freq: 500,
        q: 3.0,
        source: {
            id: "sum",
            ugen: "flock.ugen.sum",
            sources: expandHarmonics(fundamental, harmonics)
        }
    }
});

synth.enviro.asyncScheduler.repeat(1.0, function () {
    var fundamental = Math.random() * 1000 + 100;
	updateHarmonics(fundamental, harmonics, synth.get("sum.sources"));
});
