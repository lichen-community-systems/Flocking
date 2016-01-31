/*!
* Flocking Buffer Unit Generator Unit Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-15, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, QUnit, Float32Array*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var environment = flock.silentEnviro(),
        sampleRate = environment.audioSystem.model.rates.audio;

    var $ = fluid.registerNamespace("jQuery");
    fluid.registerNamespace("flock.test");

    QUnit.module("flock.ugen.playBuffer", {
        setup: function () {
            environment = flock.init();

            var bufDesc = flock.bufferDesc({
                id: flock.test.ugen.playBuffer.playbackDef.inputs.buffer.id,
                format: {
                    sampleRate: sampleRate
                },
                data: {
                    channels: [flock.test.generateSequence(1, 64)]
                }
            });
            flock.parse.bufferForDef.resolveBuffer(bufDesc, undefined, environment);
        }
    });

    fluid.registerNamespace("flock.test.ugen.playBuffer");

    flock.test.ugen.playBuffer.playbackDef = {
        ugen: "flock.ugen.playBuffer",
        inputs: {
            buffer: {
                id: "playBuffer-unit-tests"
            },

            speed: 1.0
        }
    };

    fluid.each(["audio", "control", "constant"], function (rate) {
        QUnit.test("Normal speed, " + rate + " rate", function () {
            var def = fluid.copy(flock.test.ugen.playBuffer.playbackDef);
            def.inputs.speed = {
                ugen: "flock.ugen.value",
                value: 1.0,
                rate: rate
            };

            var player = flock.parse.ugenForDef(def);

            // Make sure to generate the input's signal if necessary.
            if (player.inputs.speed.rate !== flock.rates.CONSTANT) {
                player.inputs.speed.gen(64);
            }

            player.gen(64);
            var expected = flock.environment.buffers[def.inputs.buffer.id].data.channels[0];
            QUnit.deepEqual(player.output, expected, "With a playback speed of 1.0, the output buffer should be identical to the source buffer.");

            player.gen(64);
            expected = flock.generateBufferWithValue(64, 0.0);
            QUnit.deepEqual(player.output, expected, "With looping turned off, the output buffer should be silent once we hit the end of the source buffer.");

            player.input("loop", 1.0);
            player.gen(64);
            expected = flock.environment.buffers[def.inputs.buffer.id].data.channels[0];
            QUnit.deepEqual(player.output, expected, "With looping turned on, the output buffer should repeat the source buffer from the beginning.");
        });

        QUnit.test("Double speed, " + rate + " rate", function () {
            var def = fluid.copy(flock.test.ugen.playBuffer.playbackDef);
            def.inputs.speed = {
                ugen: "flock.ugen.value",
                value: 2.0,
                rate: rate
            };

            var player = flock.parse.ugenForDef(def),
                expected = new Float32Array(64),
                expectedFirst = new Float32Array([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63]),
                expectedSecond = flock.generateBufferWithValue(32, 0);

            // Make sure to generate the input's signal if necessary.
            if (player.inputs.speed.rate !== flock.rates.CONSTANT) {
                player.inputs.speed.gen(64);
            }

            player.gen(64);
            expected.set(expectedFirst);
            expected.set(expectedSecond, 32);
            QUnit.deepEqual(player.output, expected,
                "At double speed, the output buffer contain odd values from the source buffer, padded with zeros.");

            player.gen(64);
            expected = flock.generateBufferWithValue(64, 0.0);
            QUnit.deepEqual(player.output, expected, "With looping turned off, the output buffer should be silent once we hit the end of the source buffer.");

            player.input("loop", 1.0);
            player.gen(64);
            expected.set(expectedFirst);
            expected.set(expectedFirst, 32);
            QUnit.deepEqual(player.output, expected,
                "At double speed with looping on, the output buffer should contain two repetitions of the odd values from the source buffer.");
        });

        QUnit.test("backward speed at " + rate + " rate", function () {
            var player = flock.parse.ugenForDef(flock.test.ugen.playBuffer.playbackDef),
                expected = flock.test.generateSequence(64, 1);

            player.input("speed", {
                ugen: "flock.ugen.value",
                value: -1.0,
                rate: rate
            });

            // Make sure to generate the input's signal if necessary.
            if (player.inputs.speed.rate !== flock.rates.CONSTANT) {
                player.inputs.speed.gen(64);
            }

            player.gen(64);
            QUnit.deepEqual(player.output, expected, "The buffer should be read in reverse");

            player.gen(64);
            QUnit.deepEqual(player.output, flock.test.silentBlock64, "Playback should not loop.");

            player.input("loop", 1.0);
            player.gen(64);
            QUnit.deepEqual(player.output, expected,
                "With looping turned on, the buffer should again be read in reverse");
        });

        QUnit.test("trigger " + rate + " rate, initially closed", function () {
            var player = flock.parse.ugenForDef(flock.test.ugen.playBuffer.playbackDef);

            player.set("trigger", {
                ugen: "flock.ugen.value",
                value: 0.0,
                rate: rate
            });
            player.gen(64);

            QUnit.deepEqual(player.output, flock.test.silentBlock64,
                "When not looping, and before the trigger has fired, the unit generator should output silence.");

            player.set("loop", {
                ugen: "flock.ugen.value",
                value: 1.0,
                rate: rate
            });
            player.gen(64);

            QUnit.deepEqual(player.output, flock.test.silentBlock64,
                "When looping, but before the trigger has fired, the unit generator should output silence.");
        });
    });


    flock.test.ugen.playBuffer.rawBufferArray = new Float32Array([
        0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
        0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0,
        -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0,
        -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, -0.0
    ]);

    flock.test.ugen.playBuffer.bufDefTestSpecs = [
        {
            name: "Raw buffer specified as the buffer input",
            buffer: flock.test.ugen.playBuffer.rawBufferArray
        },
        {
            name: "BufferDesc specified as the buffer input",
            buffer: {
                data: {
                    channels: [flock.test.ugen.playBuffer.rawBufferArray]
                },
                format: {
                    numChannels: 1
                }
            }
        }
    ];

    flock.test.ugen.playBuffer.testBufferInput = function (testSpec) {
        QUnit.test(testSpec.name, function () {
            var s = flock.synth({
                synthDef: {
                    id: "player",
                    ugen: "flock.ugen.playBuffer",
                    trigger: 1.0,
                    loop: 1.0,
                    buffer: testSpec.buffer
                }
            });

            flock.evaluate.synth(s);
            flock.test.unbrokenAudioSignalInRange(s.get("player").output, -1.0, 1.0);
        });
    };

    fluid.each(flock.test.ugen.playBuffer.bufDefTestSpecs,
        flock.test.ugen.playBuffer.testBufferInput);


    QUnit.module("flock.ugen.writeBuffer");

    fluid.registerNamespace("flock.test.ugen.writeBuffer");

    flock.test.ugen.writeBuffer.makeMockDef = function (id, buffer) {
        return {
            id: id,
            ugen: "flock.test.ugen.mock",
            options: {
                model: {
                    writeIdx: 0
                },
                buffer: buffer,
                gen: function (that, numSamps) {
                    for (var i = 0; i < numSamps; i++) {
                        that.output[i] = that.options.buffer[that.model.writeIdx];
                        that.model.writeIdx++;
                    }
                }
            }
        };
    };

    flock.test.ugen.writeBuffer.makeSynth = function () {
        var expected = flock.test.generateSequence(1, 256);

        var synth = flock.synth({
            synthDef: {
                id: "writer",
                ugen: "flock.ugen.writeBuffer",
                options: {
                    duration: 1,
                    numOutputs: 1
                },
                buffer: {
                    id: "cats"
                },
                sources: flock.test.ugen.writeBuffer.makeMockDef("input", expected)
            }
        });

        return synth;
    };

    QUnit.test("Buffer is created and registered with the environment", function () {
        var synth = flock.test.ugen.writeBuffer.makeSynth();
        QUnit.equal(synth.enviro.buffers.cats, synth.get("writer").buffer,
            "The buffer should have been created and registered with the environment.");
    });

    flock.test.ugen.writeBuffer.testOutput = function (numBlocks, numInputs, numOutputs, bufferName, synth) {
        var samplesGenerated = 0,
            writerUGen = synth.get("writer"),
            sources = synth.get("writer.sources"),
            enviroBuffer = synth.enviro.buffers[bufferName],
            humanChannelNum,
            source,
            actual,
            expected;

        QUnit.equal(enviroBuffer.data.channels.length, numInputs,
            "A " + numInputs + " channel buffer should have been created.");
        QUnit.equal(writerUGen.output.length, numOutputs,
            numOutputs + " output channels should have been created.");

        if (numInputs > 1) {
            QUnit.equal(writerUGen.inputs.sources.length, numInputs,
                "The unit generator should have " + numInputs + " inputs.");
        } else {
            QUnit.ok(!flock.isIterable(writerUGen.inputs.sources),
                "The unit generator should have one input.");
        }

        for (var i = 0; i < 4; i++) {
            flock.evaluate.synth(synth);
            samplesGenerated += 64;

            for (var j = 0; j < numInputs; j++) {
                humanChannelNum = j + 1;
                source = numInputs > 1 ? sources[j] : sources;
                actual = enviroBuffer.data.channels[j].subarray(0, samplesGenerated);
                expected = source.options.buffer.subarray(0, samplesGenerated);

                QUnit.deepEqual(actual, expected,
                    "Channel #" + humanChannelNum + " should have been written to the buffer.");
            }

            for (var k = 0; k < numOutputs; k++) {
                humanChannelNum = k + 1;
                source = numInputs > 1 ? sources[k] : sources;

                QUnit.deepEqual(writerUGen.output[k], source.output,
                    "The synth's output #" + humanChannelNum +
                    " should pass through input #" + humanChannelNum +".");
            }
        }
    };

    QUnit.test("One input", function () {
        var synth = flock.test.ugen.writeBuffer.makeSynth();
        flock.test.ugen.writeBuffer.testOutput(4, 1, 1, "cats", synth);
    });

    flock.test.ugen.writeBuffer.fourChannelDef = {
        id: "writer",
        ugen: "flock.ugen.writeBuffer",
        buffer: "hamsters",
        options: {
            duration: 1,
            numOutputs: 4
        },
        sources: [
            flock.test.ugen.writeBuffer.makeMockDef("one", flock.test.generateSequence(1, 256)),
            flock.test.ugen.writeBuffer.makeMockDef("two", flock.test.generateSequence(1000, 1256)),
            flock.test.ugen.writeBuffer.makeMockDef("three", flock.test.generateSequence(2000, 2256)),
            flock.test.ugen.writeBuffer.makeMockDef("four", flock.test.generateSequence(3000, 3256))
        ]
    };

    QUnit.test("Four inputs", function () {
        var synth = flock.synth({
            synthDef: flock.test.ugen.writeBuffer.fourChannelDef
        });

        flock.test.ugen.writeBuffer.testOutput(4, 4, 4, "hamsters", synth);
    });

    QUnit.test("Fewer outputs than inputs", function () {
        var synth = flock.synth({
            synthDef: $.extend(true, {}, flock.test.ugen.writeBuffer.fourChannelDef, {
                buffer: "gerbils",
                options: {
                    duration: 1,
                    numOutputs: 1
                }
            })
        });

        flock.test.ugen.writeBuffer.testOutput(4, 4, 1, "gerbils", synth);
    });

    flock.test.ugen.writeBuffer.testLooping = function (shouldLoop) {
        var synth = flock.synth({
            synthDef: $.extend(true, {}, flock.test.ugen.writeBuffer.fourChannelDef, {
                sources: flock.test.ugen.writeBuffer.makeMockDef("one", flock.test.generateSequence(1, 256)),
                buffer: "giraffes",
                loop: shouldLoop ? 1.0 : 0.0,
                options: {
                    duration: 128 / environment.audioSystem.model.rates.audio
                }
            })
        });

        for (var i = 0; i < 4; i++) {
            flock.evaluate.synth(synth);
        }

        var actual = synth.enviro.buffers.giraffes.data.channels[0],
            expected = shouldLoop ? flock.test.generateSequence(129, 256) : flock.test.generateSequence(1, 128);

        QUnit.deepEqual(actual,expected,
            "The unit generator should " + (shouldLoop ? "" : "not ") +
            "have looped around to the beginning.");

    };

    QUnit.test("Write past duration, no loop", function () {
        flock.test.ugen.writeBuffer.testLooping(false);
    });

    QUnit.test("Write past duration, loop", function () {
        flock.test.ugen.writeBuffer.testLooping(true);
    });


    QUnit.module("flock.ugen.bufferDuration tests", {
        setup: function () {
            var environment = flock.init();

            var bufDesc = flock.bufferDesc({
                id: "bufferDurationTests",
                format: {
                    sampleRate: sampleRate
                },
                data: {
                    channels: [flock.test.ascendingBuffer(sampleRate * 2.5, 0)] // 2.5 second buffer
                }
            });
            flock.parse.bufferForDef.resolveBuffer(bufDesc, undefined, environment);
        }
    });

    var testBufferDuration = function (rate) {
        QUnit.test(rate + " rate", function () {
            var durationDef = {
                id: "dur",
                rate: rate,
                ugen: "flock.ugen.bufferDuration",
                buffer: {
                    id: "bufferDurationTests"
                }
            };

            var synth = flock.synth({
                synthDef: durationDef
            });
            var durUGen = synth.nodeList.namedNodes.dur;

            flock.evaluate.synth(synth);
            QUnit.equal(durUGen.output[0], 2.5,
                "The buffer's length in seconds should be returned");
        });
    };

    var testBufferDurationAtAllRates = function () {
        var supportedRates = ["constant", "control"];
        $.each(supportedRates, function (i, rate) {
            testBufferDuration(rate);
        });
    };

    testBufferDurationAtAllRates();


    QUnit.module("flock.ugen.chopBuffer");


    QUnit.asyncTest("Static default inputs", function () {
        var s = flock.synth({
            synthDef: {
                id: "chopper",
                ugen: "flock.ugen.chopBuffer",
                start: 0.1,
                buffer: "honey"
            }
        });

        var chopper = s.get("chopper");

        flock.bufferLoader({
            bufferDefs: [
                {
                    id: "honey",
                    url: "../../../demos/shared/audio/where-the-honey-is.mp3"
                }
            ],
            listeners: {
                afterBuffersLoaded: function () {
                    flock.evaluate.synth(s);
                    flock.test.unbrokenAudioSignalInRange(chopper.output, -1, 1);
                    QUnit.start();
                }
            }
        });
    });

}());
