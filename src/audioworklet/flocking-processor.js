/*
 * Flocking AudioWorkletProcessor
 * https://github.com/colinbdclark/flocking
 *
 * Copyright 2019, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global console, AudioWorkletProcessor, registerProcessor*/
/*jshint esversion:6*/

import {flock, fluid} from "../../dist/flocking-audioworklet.js";

const audioSettings = {
    rates: {
        audio: 48000,
        control: 750,
        scheduled: 0,
        demand: 0,
        constant: 0
    },
    blockSize: 64,
    numBlocks: 2,
    chans: 1,
    numInputBuses: 0,
    numBuses: 8,
    bufferSize: 128
};

const fakeEnviro = {
    audioSystem: {
        model: audioSettings
    },
    busManager: {
        buses: flock.enviro.createAudioBuffers(
            audioSettings.numBuses, audioSettings.blockSize)
    },
    buffers: {}
};


class FlockingProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        this.nodeList = flock.nodeList();

        this.port.onmessage = (evt) => {
            console.log("SynthDef received from main thread...");
            console.log(fluid.prettyPrintJSON(evt.data));

            this.ugens = flock.makeUGens(evt.data, flock.rates.AUDIO,
                this.nodeList, fakeEnviro, audioSettings);
        };
    }

    process(inputs, outputs) {
        for (let outputIdx = 0; outputIdx < outputs.length; outputIdx++) {
            let output = outputs[outputIdx],
                chans = output.length,
                buses = fakeEnviro.busManager.buses;

            if (this.nodeList.nodes.length < 1) {
                // If there are no ugens, write out silence.
                for (let chanIdx = 0; chanIdx < chans; chanIdx++) {
                    flock.clearBuffer(output[chanIdx]);
                }
            } else {
                for (let blockIdx = 0; blockIdx < audioSettings.numBlocks; blockIdx++) {
                    let offset = blockIdx * audioSettings.blockSize;

                    flock.evaluate.clearBuses(buses, audioSettings.numBuses,
                        audioSettings.blockSize);

                    flock.evaluate.synth(this);

                    // Output for each channel.
                    for (let chanIdx = 0; chanIdx < chans; chanIdx++) {
                        let sourceBuf = buses[chanIdx],
                            outputChannelBuf = output[chanIdx];

                        // And output each sample.
                        for (let sampIdx = 0; sampIdx < audioSettings.blockSize; sampIdx++) {
                            outputChannelBuf[sampIdx + offset] = sourceBuf[sampIdx];
                        }
                    }
                }
            }
        }

        return true;
    }
}

registerProcessor("flocking-processor", FlockingProcessor);
