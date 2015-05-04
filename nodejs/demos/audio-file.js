/*jshint node:true*/
/*global require, __dirname*/

"use strict";

var currentDir = __dirname, //jshint ignore:line
    flock = require(currentDir + "/../index.js"),
    enviro = flock.init();

flock.synth({
    synthDef: {
        ugen: "flock.ugen.playBuffer",
        buffer: {
            id: "hillier-first-chord",
            url: currentDir + "/../../demos/shared/audio/hillier-first-chord.wav"
        },
        loop: 1,
        speed: {
            ugen: "flock.ugen.lfNoise",
            freq: 2.5,
            mul: {
                ugen: "flock.ugen.math",
                source: 1,
                div: {
                    ugen: "flock.ugen.bufferDuration",
                    buffer: {
                        id: "hillier-first-chord"
                    }
                }
            },
            add: 1.0,
            options: {
                interpolation: "linear"
            }
        }
    }
});

enviro.start();
