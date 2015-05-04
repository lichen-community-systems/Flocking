/*jshint node:true*/
/*global require, __dirname*/

"use strict";

var flock = require(__dirname + "/../index.js"), //jshint ignore:line
    enviro = flock.init();

var synth = flock.synth({
    id: "noise-sine-synth",
    synthDef: {
        ugen: "flock.ugen.sum",
        sources: [
            {
                ugen: "flock.ugen.filter.biquad.bp",
                freq: {
                    ugen: "flock.ugen.sin",
                    rate: "control",
                    freq: {
                        ugen: "flock.ugen.lfNoise",
                        rate: "control",
                        options: {
                            interpolation: "linear"
                        },
                        freq: 0.005,
                        mul: 200,
                        add: 210
                    },
                    mul: 400,
                    add: {
                        ugen: "flock.ugen.lfNoise",
                        rate: "control",
                        freq: 0.05,
                        mul: 300,
                        add: 900
                    }
                },
                source: {
                    id: "noiseSource",
                    ugen: "flock.ugen.whiteNoise",
                    mul: {
                        ugen: "flock.ugen.line",
                        start: 0.0,
                        end: 0.02,
                        duration: 5.0
                    }
                },
                q: {
                    ugen: "flock.ugen.sin",
                    rate: "control",
                    freq: 0.01,
                    mul: 4.0,
                    add: 4.5
                }
            },
            {
                ugen: "flock.ugen.sin",
                freq: {
                    ugen: "flock.ugen.lfNoise",
                    rate: "control",
                    options: {
                        interpolation: "linear"
                    },
                    freq: 0.25,
                    mul: 30,
                    add: 90
                },
                mul: {
                    id: "sineVol",
                    ugen: "flock.ugen.lfNoise",
                    rate: "control",
                    options: {
                        interpolation: "linear"
                    },
                    freq: 0.005,
                    mul: {
                        ugen: "flock.ugen.line",
                        start: 0.0,
                        end: 0.025,
                        duration: 5.0
                    },
                    add: {
                        ugen: "flock.ugen.line",
                        start: 0.0,
                        end: 0.025,
                        duration: 5.0
                    }
                }
            }
        ]
    }
});

enviro.start();
console.log("Playing...");

var clock = flock.scheduler.async();
// Fade out after 10 minutes.
clock.once(600, function () {
    synth.set({
        "sineVol.mul.start": 0.025,
        "sineVol.mul.end": 0.0,
        "sineVol.add.start": 0.025,
        "sineVol.add.end": 0.0,
        "noiseSource.mul.start": 0.02,
        "noiseSource.mul.end": 0.0
    });

    // Wait ten seconds, then clean up.
    clock.once(10.0, clock.end);
});
