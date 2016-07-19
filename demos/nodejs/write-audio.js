/*
 * Flocking Node.js Audio File Writing Demo
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2016, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*jslint node: true */

"use strict";

var currentDir = __dirname,
    flock = require(currentDir + "/../../index.js"),
    enviro = flock.init();

var granularDef = {
    id: "granulator",
    ugen: "flock.ugen.triggerGrains",
    buffer: {
        id: "hillier-first-chord",
        url: currentDir + "/../../demos/shared/audio/hillier-first-chord.wav"
    },
    centerPos: {
        ugen: "flock.ugen.lfNoise",
        freq: 10,
        options: {
            interpolation: "linear"
        },
        mul: {
            ugen: "flock.ugen.bufferDuration",
            buffer: "hillier-first-chord",
            mul: 0.9,
            add: 0.1
        }
    },
    dur: {
        ugen: "flock.ugen.lfNoise",
        freq: 8,
        options: {
            interpolation: "linear"
        },
        mul: 1,
        add: 0.2
    },
    trigger: {
        ugen: "flock.ugen.dust",
        freq: 4,
        density: {
            ugen: "flock.ugen.lfNoise",
            mul: 10.0,
            add: 5.0
        }
    },
    speed: {
        ugen: "flock.ugen.sequence",
        freq: {
            ugen: "flock.ugen.lfNoise",
            options: {
                interpolation: "linear"
            },
            freq: 1/2,
            mul: 10,
            add: 10
        },
        loop: 1.0,
        values: [0.7, 0.93333333, 1.05]
    }
};

var s = flock.synth({
    synthDef: {
        ugen: "flock.ugen.writeBuffer",
        options: {
            duration: 15,
            numOutputs: 1
        },
        buffer: "recording",
        sources: granularDef
    }
});

enviro.asyncScheduler.once(10, function () {
    s.set("granulator.mul", {
        ugen: "flock.ugen.line",
        start: 1.0,
        end: 0.0,
        duration: 4
    });
});

enviro.asyncScheduler.once(15, function () {
    enviro.stop();
    console.log("Saving a", enviro.audioSystem.model.rates.audio, "Hz audio file...");
    enviro.saveBuffer({
        type: "wav",
        format: "int16",
        buffer: "recording",
        path: "my-recording.wav",
        success: function () {
            console.log("The audio file was successfully saved!");
        }
    });
});

console.log("Writing audio to a buffer for 15 seconds...");

enviro.start();
