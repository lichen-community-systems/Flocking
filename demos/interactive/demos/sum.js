/*global flock*/

// A bank of oscillators added together.
var harmonics = [1, 3, 5, 7, 11, 13, 15, 17, 19, 21],
    ugenTypes = ["flock.ugen.sin", "flock.ugen.lfSaw", "flock.ugen.lfPulse", "flock.ugen.lfNoise"],
    fundamentalMultiplier = 440,
    maxFreq = flock.environment.audioSettings.rates.audio / 4; // Highest harmonic shouldn't be more than a quarter of the Nyquist frequency.

var makeHarmonic = function (ugenTypes, fundamental, harmonic, octave, maxAmp) {
    var freqScale = (harmonic * octave),
        ugen = flock.choose(ugenTypes);

    return {
        ugen: ugen,
        freq: fundamental * freqScale,
        mul: maxAmp / freqScale
    };
};

var makeHarmonics = function (fundamental) {
    var sources = [],
        freqs = [];

    $.each(harmonics, function (i, harmonic) {
        var freq = fundamental,
            octave = 1;

        while (freq <= maxFreq) {
            var ugenDef = makeHarmonic(ugenTypes, fundamental, harmonic, octave, 0.1);
            freq = ugenDef.freq;
            if (freq <= maxFreq && freqs.indexOf(freq) === -1) {
                freqs.push(freq);
                sources.push(ugenDef);
            }
            octave++;
        }
    });

    return sources;
};

var synth = flock.synth({
    synthDef: {
        id: "adder",
        ugen: "flock.ugen.sum",
        sources: makeHarmonics(fundamentalMultiplier)
    }
});

synth.enviro.asyncScheduler.repeat(0.5, function () {
    var fundamental = (fundamentalMultiplier * Math.random()) + 60;
    synth.input("adder.sources", makeHarmonics(fundamental));
});

synth;
