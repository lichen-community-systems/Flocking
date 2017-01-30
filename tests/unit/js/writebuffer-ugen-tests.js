/*!
* Flocking WriteBuffer Unit Generator Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-17, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit"),
        $ = fluid.registerNamespace("jQuery");

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

    flock.test.ugen.writeBuffer.testCreation = function () {
        var synth = flock.test.ugen.writeBuffer.makeSynth();
        QUnit.equal(synth.enviro.buffers.cats, synth.get("writer").buffer,
            "The buffer should have been created and registered with the environment.");
    };

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

    flock.test.ugen.writeBuffer.testOneInput = function () {
        var synth = flock.test.ugen.writeBuffer.makeSynth();
        flock.test.ugen.writeBuffer.testOutput(4, 1, 1, "cats", synth);
    };

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

    flock.test.ugen.writeBuffer.testFourInputs = function () {
        var synth = flock.synth({
            synthDef: flock.test.ugen.writeBuffer.fourChannelDef
        });

        flock.test.ugen.writeBuffer.testOutput(4, 4, 4, "hamsters", synth);
    };

    flock.test.ugen.writeBuffer.testFewerOutputsThanInputs = function () {
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
    };

    flock.test.ugen.writeBuffer.testLooping = function (shouldLoop, environment) {
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

    flock.test.ugen.writeBuffer.testNoLoop = function (environment) {
        flock.test.ugen.writeBuffer.testLooping(false, environment);
    };

    flock.test.ugen.writeBuffer.testLoop = function (environment) {
        flock.test.ugen.writeBuffer.testLooping(true, environment);
    };

    fluid.defaults("flock.test.ugen.writeBuffer.tester", {
        gradeNames: "fluid.test.testCaseHolder",

        modules: [
            {
                name: "flock.ugen.writeBuffer",
                tests: [
                    {
                        name: "Buffer is created and registered with the environment",
                        expect: 1,
                        sequence: [
                            {
                                funcName: "flock.test.ugen.writeBuffer.testCreation"
                            }
                        ]
                    },
                    {
                        name: "One input",
                        expect: 11,
                        sequence: [
                            {
                                funcName: "flock.test.ugen.writeBuffer.testOneInput"
                            }
                        ]
                    },
                    {
                        name:  "Four inputs",
                        expect: 35,
                        sequence: [
                            {
                                funcName: "flock.test.ugen.writeBuffer.testFourInputs"
                            }
                        ]
                    },
                    {
                        name: "Fewer outputs than inputs",
                        expect: 23,
                        sequence: [
                            {
                                funcName: "flock.test.ugen.writeBuffer.testFewerOutputsThanInputs"
                            }
                        ]
                    },
                    {
                        name: "Write past duration, no loop",
                        expect: 1,
                        sequence: [
                            {
                                funcName: "flock.test.ugen.writeBuffer.testNoLoop",
                                args: ["{environment}"]
                            }
                        ]
                    },
                    {
                        name: "Write past duration, loop",
                        expect: 1,
                        sequence: [
                            {
                                funcName: "flock.test.ugen.writeBuffer.testLoop",
                                args: ["{environment}"]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    fluid.defaults("flock.test.ugen.writeBuffer.tests", {
        gradeNames: "flock.test.testEnvironment",

        components: {
            tester: {
                type: "flock.test.ugen.writeBuffer.tester"
            }
        }
    });

    fluid.test.runTests("flock.test.ugen.writeBuffer.tests");
}());
