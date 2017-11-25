/*!
 * Flocking Buffer Tests
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2015-2017, Colin Clark
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    fluid.registerNamespace("flock.test.buffer");

    flock.test.module({
        name: "Buffers"
    });

    var unwrappedSampleData = new Float32Array([1, 2, 3, 4, 5]);
    var testDesc = {
        format: {
            numChannels: 1
        },
        data: {
            channels: unwrappedSampleData
        }
    };

    QUnit.test("BufferDesc expansion: raw sample array", function () {
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

        QUnit.deepEqual(actual, expected,
            "A raw buffer of samples should be wrapped buffer desc.");
    });

    QUnit.test("BufferDesc expansion: raw multiple channels", function () {
        var channels = [new Float32Array(), new Float32Array()],
            actual = flock.bufferDesc(channels, 44100, 2),
            expected = {
                container: {},
                format: {
                    numChannels: 2,
                    numSampleFrames: 0,
                    sampleRate: 44100,
                    duration: 0
                },
                data: {
                    channels: channels
                }
            };

        QUnit.deepEqual(actual, expected,
            "When an array of channel data is provided, the correct bufDesc should be returned.");
    });

    QUnit.test("BufferDesc expansion: single channel sample array with numChannels specified", function () {
        var bufferDesc = fluid.copy(testDesc);
        var actual = flock.bufferDesc(bufferDesc);
        QUnit.deepEqual(actual.data.channels, [unwrappedSampleData],
            "A raw buffer of samples should be wrapped in an array if we know we have a single channel.");
    });

    QUnit.test("BufferDesc expansion: empty buffer description", function () {
        var actual = flock.bufferDesc(),
            expected = {
                container: {},
                format: {
                    numChannels: 0,
                    numSampleFrames: 0,
                    sampleRate: 44100,
                    duration: 0
                },
                data: {
                    channels: []
                }
            };

        QUnit.deepEqual(actual, expected,
            "A valid but empty bufferDesc should be returned when no arguments are provided to flock.bufferDesc().");
    });

    QUnit.test("BufferDesc expansion: mismatched channel data", function () {
        var bufferDesc = fluid.copy(testDesc);
        bufferDesc.format.numChannels = 2;

        var thrown = false;

        try {
            flock.bufferDesc(bufferDesc);
            thrown = false;
        } catch (e) {
            thrown = true;
        }

        QUnit.ok(thrown, "An exception should have been thrown when mismatching sample data was provided.");
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
            QUnit.start();
        };

        that.onInputChanged = function (inputName) {
            that.onBufferInputChanged(inputName);
        };

        return that;
    };

    QUnit.asyncTest("Setting a bufferDef", function () {
        var s = flock.synth({
            synthDef: {
                id: "play",
                ugen: "flock.test.mockBufferUGen",
                options: {
                    assertion: function (ugen) {
                        QUnit.deepEqual(ugen.buffer, s.enviro.buffers.hamster,
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

    QUnit.test("Setting a bufferDesc", function () {
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
        QUnit.deepEqual(play.inputs.buffer, hamsterDesc,
            "After setting a bufferDesc, the input should reflect the value actually set.");
        QUnit.deepEqual(play.buffer, hamsterDesc,
            "And the actual buffer should be the correct bufferDesc from the environment.");
    });

    QUnit.test("Setting a buffer id reference", function () {
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
        QUnit.deepEqual(play.inputs.buffer, catIdBufDef,
            "After setting an object id reference, the actual input should reflect the bufDef.");
        QUnit.deepEqual(play.buffer, s.enviro.buffers.cat,
            "And the actual buffer should be the correct bufferDesc from the environment.");

        // Set a raw id reference.
        s.set("play.buffer", "dog");
        QUnit.equal(play.inputs.buffer, "dog",
            "After setting a raw id reference, the actual input should reflect the value actually set.");
        QUnit.deepEqual(play.buffer, s.enviro.buffers.dog,
            "And the actual buffer should be the correct bufferDesc from the environment.");
    });

    QUnit.asyncTest("Buffer Loader", function () {
        var bufDefs = [
            {
                id: "cat",
                url: flock.test.audioFilePath("long-triangle-int16-44100.wav")
            },
            {
                url: flock.test.audioFilePath("long-triangle-int16-48000.wav")
            },
            {
                id: "fish",
                url: flock.test.pathForResource("../../../demos/shared/audio/hillier-first-chord.wav")
            }
        ];

        var loader;
        var listener = function (decodedBuffers) {
            QUnit.expect(7);
            QUnit.equal(decodedBuffers.length, 3, "All buffers should have been loaded.");
            QUnit.equal(decodedBuffers[0].id, "cat",
                "The first buffer should have the correct id.");
            QUnit.equal(decodedBuffers[1].id, "long-triangle-int16-48000",
                "A buffer with no id should be given an autogenerated id.");
            QUnit.equal(decodedBuffers[2].id, "fish",
                "The fourth buffer should have the correct id.");

            fluid.each(decodedBuffers, function (bufDesc) {
                QUnit.ok(bufDesc.data.channels[0].length > 0,
                    "The buffer should contain channel data.");
            });

            QUnit.start();
        };

        loader = flock.bufferLoader({
            bufferDefs: bufDefs,

            listeners: {
                afterBuffersLoaded: listener
            }
        });
    });
}());
