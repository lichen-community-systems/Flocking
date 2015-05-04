/*jshint node:true*/
/*global require, __dirname*/

"use strict";

// TODO: This file duplicates the Four Channels demo
// from the Flocking Playground.
// Once the IoCified Playground is merged in,
// this should be replaced by a Node.js demo loader
// so that we can share most demos between both platforms.

var currentDir = __dirname, //jshint ignore:line
    flock = require(currentDir + "/../index.js"),
    enviro = flock.init({
        chans: 4
    });

flock.synth({
    synthDef: [
        {
            ugen: "flock.ugen.sinOsc",
            freq: {
                ugen: "flock.ugen.xLine",
                start: 60,
                end: 90,
                duration: 120
            },
            mul: {
                ugen: "flock.ugen.sinOsc",
                freq: {
                    ugen: "flock.ugen.xLine",
                    start: 1/120,
                    end: 1/2,
                    duration: 120
                },
                mul: 0.125,
                add: 0.125
            }
        },
        {
            ugen: "flock.ugen.sinOsc",
            freq: {
                ugen: "flock.ugen.xLine",
                start: 90,
                end: 60,
                duration: 90
            },
            mul: {
                ugen: "flock.ugen.sinOsc",
                freq: {
                    ugen: "flock.ugen.lfNoise",
                    freq: {
                        ugen: "flock.ugen.xLine",
                        start: 1/240,
                        end: 1/120,
                        duration: 90
                    },
                    mul: 1/30,
                    add: 1/30
                },
                mul: 0.125,
                add: 0.125
            }
        },
        {
            ugen: "flock.ugen.sinOsc",
            freq: {
                ugen: "flock.ugen.xLine",
                start: 270,
                end: 240,
                duration: 120
            },
            mul: {
                ugen: "flock.ugen.sinOsc",
                freq: {
                    ugen: "flock.ugen.xLine",
                    start: 1/120,
                    end: 1/2,
                    duration: 120
                },
                mul: 0.125,
                add: 0.125
            }
        },
        {
            ugen: "flock.ugen.sinOsc",
            freq: {
                ugen: "flock.ugen.xLine",
                start: 210,
                end: 180,
                duration: 90
            },
            mul: {
                ugen: "flock.ugen.sinOsc",
                freq: {
                    ugen: "flock.ugen.lfNoise",
                    freq: {
                        ugen: "flock.ugen.xLine",
                        start: 1/240,
                        end: 1/120,
                        duration: 180
                    },
                    mul: 1/60,
                    add: 1/60
                },
                mul: 0.125,
                add: 0.125
            }
        }
    ]
});

enviro.start();
