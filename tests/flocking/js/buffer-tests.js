/*!
 * Flocking - Creative audio synthesis for the Web!
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2015, Colin Clark
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

/*global require, module, test, asyncTest, expect, ok, equal, deepEqual, start*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.registerNamespace("flock.test.buffer");

    flock.init();

    module("Buffers");

    var unwrappedSampleData = new Float32Array([1, 2, 3, 4, 5]);
    var testDesc = {
        format: {
            numChannels: 1
        },
        data: {
            channels: unwrappedSampleData
        }
    };

    test("BufferDesc expansion: raw sample array", function () {
        var actual = flock.bufferDesc(unwrappedSampleData);
        var expected = {
            container: {},
            format: {
                numChannels: 1,
                numSampleFrames: 5,
                sampleRate: 44100,
                duration: 5 / 44100
            },
            data: {
                channels: [
                    unwrappedSampleData
                ]
            }
        };

        deepEqual(actual, expected,
            "A raw buffer of samples should be wrapped buffer desc.");
    });

    test("BufferDesc expansion: single channel sample array with numChannels specified", function () {
        var bufferDesc = fluid.copy(testDesc);
        var actual = flock.bufferDesc(bufferDesc);
        deepEqual(actual.data.channels, [unwrappedSampleData],
            "A raw buffer of samples should be wrapped in an array if we know we have a single channel.");
    });

    test("BufferDesc expansion: mismatched channel data", function () {
        var bufferDesc = fluid.copy(testDesc);
        bufferDesc.format.numChannels = 2;

        var thrown = false;

        try {
            flock.bufferDesc(bufferDesc);
            thrown = false;
        } catch (e) {
            thrown = true;
        }

        ok(thrown, "An exception should have been thrown when mismatching sample data was provided.");
    });

    var bufferTestSynthDef = {
        id: "play",
        ugen: "flock.ugen.playBuffer",
        buffer: flock.bufferDesc({
            data: {
                channels : [new Float32Array([1, 2, 3, 4, 5])]
            }
        })
    };

    flock.test.mockBufferUGen = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        flock.ugen.buffer(that);

        that.onBufferReady = function () {
            options.assertion(that);
            start();
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
        };

        return that;
    };

    asyncTest("Setting a bufferDef", function () {
        var s = flock.synth({
            synthDef: {
                id: "play",
                ugen: "flock.test.mockBufferUGen",
                options: {
                    assertion: function (ugen) {
                        deepEqual(ugen.buffer, s.enviro.buffers.hamster,
                            "After setting a bufferDef, the buffer should have been correctly delivered to the ugen.");
                    }
                }
            }
        });

        s.set("play.buffer", {
            id: "hamster",
            src: flock.test.audio.triangleInt16WAV
        });
    });

    test("Setting a bufferDesc", function () {
        var s = flock.synth({
            synthDef: bufferTestSynthDef
        });
        var play = s.get("play");

        // Set a bufferDesc.
        var hamsterDesc = flock.bufferDesc({
            data: {
                channels: [new Float32Array([10, 11, 12, 13, 14, 15])]
            }
        });
        s.set("play.buffer", hamsterDesc);
        deepEqual(play.inputs.buffer, hamsterDesc,
            "After setting a bufferDesc, the input should reflect the value actually set.");
        deepEqual(play.buffer, hamsterDesc,
            "And the actual buffer should be the correct bufferDesc from the environment.");
    });

    test("Setting a buffer id reference", function () {
        var s = flock.synth({
            synthDef: bufferTestSynthDef
        });
        var play = s.get("play");

        // TODO: We should expose this functionality as a method on the environment.
        var catBuffer = flock.bufferDesc({
            id: "cat",
            data: {
                channels: [new Float32Array([10, 11, 12, 13, 14, 15])]
            }
        });

        var dogBuffer = flock.bufferDesc({
            id: "dog",
            data: {
                channels: [new Float32Array([22, 23, 24, 25, 26, 27])]
            }
        });

        flock.parse.bufferForDef.resolveBuffer(catBuffer, undefined, s.enviro);
        flock.parse.bufferForDef.resolveBuffer(dogBuffer, undefined, s.enviro);

        // Set a full id reference.
        var catIdBufDef = {
            id: "cat"
        };
        s.set("play.buffer", catIdBufDef);
        deepEqual(play.inputs.buffer, catIdBufDef,
            "After setting an object id reference, the actual input should reflect the bufDef.");
        deepEqual(play.buffer, s.enviro.buffers.cat,
            "And the actual buffer should be the correct bufferDesc from the environment.");

        // Set a raw id reference.
        s.set("play.buffer", "dog");
        equal(play.inputs.buffer, "dog",
            "After setting a raw id reference, the actual input should reflect the value actually set.");
        deepEqual(play.buffer, s.enviro.buffers.dog,
            "And the actual buffer should be the correct bufferDesc from the environment.");
    });

    asyncTest("Buffer Loader", function () {
        var bufDefs = [
            {
                id: "cat",
                url: "../../shared/audio/long-triangle-int16-44100.wav"
            },
            {
                id: "dog",
                url: "../../shared/audio/long-triangle-int16-48000.wav"
            },
            {
                url: "../../shared/audio/long-triangle-int16-88200.wav"
            },
            {
                id: "fish",
                url: "../../../demos/shared/audio/hillier-first-chord.wav"
            }
        ];

        var loader;
        var listener = function (decodedBuffers) {
            expect(9);
            equal(decodedBuffers.length, 4, "All buffers should have been loaded.");
            equal(decodedBuffers[0].id, "cat",
                "The first buffer should have the correct id.");
            equal(decodedBuffers[1].id, "dog",
                "The second buffer should have the correct id.");
            equal(decodedBuffers[3].id, "fish",
                "The fourth buffer should have the correct id.");
            equal(decodedBuffers[2].id, "long-triangle-int16-88200",
                "A buffer with no id should be given an autogenerated id.");

            fluid.each(decodedBuffers, function (bufDesc) {
                ok(bufDesc.data.channels[0].length > 0,
                    "The buffer should contain channel data.");
            });

            start();
        };

        loader = flock.bufferLoader({
            bufferDefs: bufDefs,

            listeners: {
                afterBuffersLoaded: listener
            }
        });
    });
}());
