/*!
* Flocking Envelope Unit Generator Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2014-2017, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    /*****************************
     * Line Unit Generator Tests *
     *****************************/

    fluid.defaults("flock.test.ugen.line", {
        gradeNames: "flock.test.module",

        name: "flock.ugen.line",

        lineDef: {
            ugen: "flock.ugen.line",
            rate: flock.rates.AUDIO,
            inputs: {
                start: 0,
                end: 64
            }
        },

        listeners: {
            onCreate: {
                funcName: "flock.test.ugen.line.runTests",
                args: "{that}"
            }
        }
    });

    flock.test.ugen.line.makeUGen = function (module) {
        var lineDef = fluid.copy(module.options.lineDef),
            sampleRate = module.environment.audioSystem.model.rates.audio;

        lineDef.inputs.duration = 64 / sampleRate; // 64 samples.

        return flock.parse.ugenForDef(lineDef);
    };

    flock.test.ugen.line.runTests = function (module) {
        QUnit.test("Generate a full line.", function () {
            var line = flock.test.ugen.line.makeUGen(module);

            line.gen(64);
            var expected = flock.test.generateSequence(0, 63);
            QUnit.deepEqual(line.output, expected, "Line should generate all samples for its duration but one.");

            line.gen(64);
            expected = flock.generateBufferWithValue(64, 64);
            QUnit.deepEqual(line.output, expected, "After the line's duration is finished, it should constantly output the end value.");
        });

        QUnit.test("Generate a partial line.", function () {
            var line = flock.test.ugen.line.makeUGen(module);

            line.gen(32);

            // It's a 64 sample buffer, so split it in half to test it.
            QUnit.deepEqual(flock.copyBuffer(line.output, 0, 32), flock.test.generateSequence(0, 31),
                "The first half of the line's values should but generated.");
            QUnit.deepEqual(flock.copyBuffer(line.output, 32), flock.generateBufferWithValue(32, 0),
                "The last 32 samples of the buffer should be empty.");

            line.gen(32);
            QUnit.deepEqual(flock.copyBuffer(line.output, 0, 32), flock.test.generateSequence(32, 63),
                "The second half of the line's values should be generated.");
            QUnit.deepEqual(flock.copyBuffer(line.output, 32), flock.generateBufferWithValue(32, 0),
                "The last 32 samples of the buffer should be empty.");

            line.gen(32);
            QUnit.deepEqual(flock.copyBuffer(line.output, 0, 32), flock.generateBufferWithValue(32, 64),
                "After the line's duration is finished, it should constantly output the end value.");
        });
    };

    flock.test.ugen.line();


    /******************
     * ASR UGen Tests *
     ******************/

    fluid.defaults("flock.test.ugen.asr", {
        gradeNames: "flock.test.module",

        name: "flock.ugen.asr",

        asrDef: {
            ugen: "flock.ugen.asr",
            rate: flock.rates.AUDIO,
            inputs: {
                start: 0.0,
                sustain: 1.0
            }
        },

        listeners: {
            onCreate: {
                funcName: "flock.test.ugen.asr.runTests",
                args: "{that}"
            }
        }
    });

    flock.test.ugen.asr.makeUGen = function (module) {
        var asrDef = fluid.copy(module.options.asrDef),
            sampleRate = module.environment.audioSystem.model.rates.audio;

        asrDef.inputs.attack = 1 / (sampleRate / 63);
        asrDef.inputs.release = 1 / (sampleRate / 63);

        return flock.parse.ugenForDef(asrDef);
    };

    flock.test.ugen.asr.testEnvelopeStage = function (buffer, numSamps, expectedStart, expectedEnd, stageName) {
        QUnit.equal(buffer[0], expectedStart,
            "During the " + stageName + " stage, the starting level should be " + expectedStart + ".");
        QUnit.equal(buffer[numSamps - 1], expectedEnd,
            "At the end of the " + stageName + " stage, the expected end level should have been reached.");
        flock.test.arrayUnbroken(buffer, "The output should not contain any dropouts.");
        flock.test.arrayWithinRange(buffer, 0.0, 1.0,
            "The output should always remain within the range between " + expectedStart +
            " and " + expectedEnd + ".");
        flock.test.continuousArray(buffer, 0.02, "The buffer should move continuously within its range.");

        var isClimbing = expectedStart < expectedEnd;
        var directionText = isClimbing ? "climb" : "fall";
        flock.test.rampingArray(buffer, isClimbing,
            "The buffer should " + directionText + " steadily from " + expectedStart + " to " +
            expectedEnd + ".");
    };

    flock.test.ugen.asr.runTests = function (module) {
        QUnit.test("Constant values for all inputs", function () {
            var asr = flock.test.ugen.asr.makeUGen(module);

            // Until the gate is closed, the ugen should just output silence.
            asr.gen(64);
            QUnit.deepEqual(asr.output, flock.generateBufferWithValue(64, 0.0),
                "When the gate is open at the beginning, the envelope's output should be 0.0.");

            // Trigger the attack stage.
            asr.input("gate", 1.0);
            asr.gen(64);
            flock.test.ugen.asr.testEnvelopeStage(asr.output, 64, 0.0, 1.0, "attack");

            // Output a full control period of the sustain value.
            asr.gen(64);
            QUnit.deepEqual(asr.output, flock.generateBufferWithValue(64, 1.0),
                "While the gate is open, the envelope should hold at the sustain level.");

            // Release the gate and test the release stage.
            asr.input("gate", 0.0);
            asr.gen(64);
            flock.test.ugen.asr.testEnvelopeStage(asr.output, 64, 1.0, 0.0, "release");

            // Test a full control period of the end value.
            asr.gen(64);
            QUnit.deepEqual(asr.output, flock.generateBufferWithValue(64, 0.0),
                "When the gate is closed and the release stage has completed, the envelope's output should be 0.0.");

            // Trigger the attack stage again.
            asr.input("gate", 1.0);
            asr.gen(64);
            flock.test.ugen.asr.testEnvelopeStage(asr.output, 64, 0.0, 1.0, "second attack");

            // And the release stage again.
            asr.input("gate", 0.0);
            asr.gen(64);
            flock.test.ugen.asr.testEnvelopeStage(asr.output, 64, 1.0, 0.0, "second release");
        });

        QUnit.test("Release midway through attack", function () {
            var asr = flock.test.ugen.asr.makeUGen(module);
            asr.input("gate", 1.0);
            asr.gen(32);
            flock.test.ugen.asr.testEnvelopeStage(asr.output.subarray(0, 32), 32, 0.0, 0.4920634925365448, "halfway through the attack");

            // If the gate closes during the attack stage, the remaining portion of the attack stage should be output before the release stage starts.
            asr.input("gate", 0.0);
            asr.gen(32);
            flock.test.ugen.asr.testEnvelopeStage(asr.output.subarray(0, 32), 32, 0.5079365372657776, 1.0, "rest of the attack");

            // After the attack stage has hit 1.0, it should immediately start the release phase.
            asr.gen(64);
            flock.test.ugen.asr.testEnvelopeStage(asr.output, 64, 1.0, 0.0, "release");
        });

        QUnit.test("Attack midway through release", function () {
            var asr = flock.test.ugen.asr.makeUGen(module);

            // Trigger the attack stage, then the release stage immediately.
            asr.input("gate", 1.0);
            asr.gen(64);
            flock.test.ugen.asr.testEnvelopeStage(asr.output, 64, 0.0, 1.0, "attack");
            asr.input("gate", 0.0);
            asr.gen(32);
            flock.test.ugen.asr.testEnvelopeStage(flock.copyBuffer(asr.output, 0, 32), 32, 1.0, 0.5079365372657776, "halfway release");

            // Then trigger a new attack halfway through the release stage.
            // The envelope should immediately pick up the attack phase from the current level
            // TODO: Note that there will be a one-increment lag before turning direction to the attack phase in this case. Is this a noteworthy bug?
            asr.input("gate", 1.0);
            asr.gen(32);
            flock.test.ugen.asr.testEnvelopeStage(flock.copyBuffer(asr.output, 0, 32), 32, 0.4920634925365448, 0.7420005202293396, "attack after halfway release");

            // Generate another control period of samples, which should be at the sustain level.
            asr.gen(64);
            flock.test.ugen.asr.testEnvelopeStage(flock.copyBuffer(asr.output, 0, 32), 32, 0.7500630021095276, 1.0, "second half of the attack after halfway release second half.");
            QUnit.deepEqual(flock.copyBuffer(asr.output, 32), flock.generateBufferWithValue(32, 1.0),
                "While the gate remains open after a mid-release attack, the envelope should hold at the sustain level.");
        });

        QUnit.test("Square envelope (zero attack, zero decay)", function () {
            var squareASRDef = {
                ugen: "flock.ugen.asr",
                rate: "audio",
                attack: 0,
                sustain: 0.25,
                release: 0
            };

            var asr = flock.parse.ugenForDef(squareASRDef);
            asr.gen(64);
            flock.test.arraySilent(asr.output,
                "Before the gate has been opened, the output should be silent");

            asr.input("gate", 1.0);
            asr.gen(64);
            QUnit.deepEqual(asr.output, flock.generateBufferWithValue(64, 0.25),
                "When the gate is opened the target sustain level is reached immediately");

            asr.gen(64);
            QUnit.deepEqual(asr.output, flock.generateBufferWithValue(64, 0.25),
                "While the envelope is sustaining, it continues to output at the target level");

            asr.input("gate", 0.0);
            asr.gen(64);
            flock.test.arraySilent(asr.output,
                "As soon as the gate is closed, the envelope should be silent.");
        });
    };

    flock.test.ugen.asr();
}());
