/*!
* Flocking Oscillator Unit Generator Unit Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-15, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, Float32Array*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    var environment = flock.silentEnviro(),
        sampleRate = environment.audioSystem.model.rates.audio;

    QUnit.module("flock.ugen.osc() tests");

    var makeOsc = function (freq, table, bufferSize, sampleRate) {
        return flock.parse.ugenForDef({
            ugen: "flock.ugen.osc",
            inputs: {
                freq: {
                    ugen: "flock.ugen.value",
                    value: freq
                },
                table: table
            },
            options: {
                sampleRate: sampleRate
            }
        });
    };

    var paddedBuffer = function (values, length) {
        var buf = new Float32Array(length),
            i;
        for (i = 0; i < values.length; i++) {
            buf[i] = values[i];
        }
        return buf;
    };

    var checkOsc = function (testSpec, expected, msg) {
        var osc = makeOsc(testSpec.freq, testSpec.table, testSpec.numSamps, testSpec.sampleRate);
        expected = paddedBuffer(expected, osc.output.length);
        osc.gen(testSpec.numSamps);
        QUnit.deepEqual(osc.output, expected, msg);
    };

    QUnit.test("flock.ugen.osc() empty table", function () {
        checkOsc({
            freq: 440,
            sampleRate: 44100,
            numSamps: 64,
            table: []
        }, new Float32Array(64), "With an empty table input, osc should output silence.");
    });

    QUnit.test("flock.ugen.osc() simple table lookup", function () {
        var table = new Float32Array([1, 2, 3, 4]);

        checkOsc({
            freq: 1,
            sampleRate: 1,
            numSamps: 1,
            table: table
        }, new Float32Array([1]),
        "At a frequency of 1 and sampling rate of 1, we should only get the first value in the table.");

        checkOsc({
            freq: 1,
            sampleRate: 4,
            numSamps: 4,
            table: table
        },
        table,
        "At a frequency of 1 and sampling rate of 4, requesting 4 samples should return the whole table.");

        checkOsc({
            freq: 1,
            sampleRate: 4,
            numSamps: 8,
            table: table
        },
        new Float32Array([1, 2, 3, 4, 1, 2, 3, 4]),
        "At a frequency of 1 and sampling rate of 4, requesting 8 samples should return the whole table twice.");

        checkOsc({
            freq: 2,
            sampleRate: 4,
            numSamps: 4,
            table: table
        },
        new Float32Array([1, 3, 1, 3]),
        "At a frequency of 2 and sampling rate of 4, requesting 4 samples should return the first and third samples.");

        checkOsc({
            freq: 2,
            sampleRate: 4,
            numSamps: 16,
            table: table
        },
        new Float32Array([1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]),
        "At a frequency of 2 and sampling rate of 4, 16 samples should still consist of the first and third samples.");
    });


    QUnit.module("flock.ugen.osc() tests: specific wave forms");

    var basicDef = {
        rate: flock.rates.AUDIO,
        inputs: {
            freq: 2,
            mul: 0.75
        }
    };

    var makeAndPrimeOsc = function (ugenType, outputSize) {
        basicDef.ugen = ugenType;
        var ug = flock.parse.ugenForDef(basicDef);
        ug.output = new Float32Array(outputSize);
        ug.gen(outputSize);
        return ug;
    };

    var testOsc = function (ugenType, otherTests) {
        QUnit.test(ugenType, function () {
            var ug = makeAndPrimeOsc(ugenType, sampleRate);
            flock.test.unbrokenAudioSignalInRange(ug.output, -0.75, 0.75);
            if (otherTests) {
                otherTests(ug);
            }
        });
    };

    var testContinuousWaveformOsc = function (ugenType, otherTests) {
        testOsc(ugenType, function (ug) {
            flock.test.continuousArray(ug.output, 0.01,
                "The ugen should produce a continuously changing signal.");
            if (otherTests) {
                otherTests(ug);
            }
        });
    };

    var testSineishWaveformOsc = function (ugenType) {
        testContinuousWaveformOsc(ugenType, function (sine) {
            flock.test.sineishArray(sine.output, 0.75, true,
                "The " + ugenType + " ugen should continuously rise and fall between 0.75/-0.75.");
        });
    };

    var testDroppingWaveformOsc = function (ugenType) {
        testOsc(ugenType);
    };

    testSineishWaveformOsc("flock.ugen.sinOsc");
    testContinuousWaveformOsc("flock.ugen.triOsc");
    testContinuousWaveformOsc("flock.ugen.squareOsc");
    testContinuousWaveformOsc("flock.ugen.sawOsc");

    testSineishWaveformOsc("flock.ugen.sin");
    testDroppingWaveformOsc("flock.ugen.lfPulse");
    testDroppingWaveformOsc("flock.ugen.lfSaw");


    QUnit.module("flock.ugen.impulse() tests");

    var genOneSecondImpulse = function (freq, phase) {
        var impulseDef = {
            ugen: "flock.ugen.impulse",
            freq: freq,
            phase: phase
        };
        var imp = flock.parse.ugenForDef(impulseDef),
            numSamps = sampleRate;

        imp.output = new Float32Array(numSamps);
        imp.gen(numSamps);

        return imp.output;
    };

    var testImpulses = function (buffer, impulseLocations, msg) {
        var i;

        flock.test.valueCount(buffer, 1.0, impulseLocations.length, msg + " should contain the expected number of impulses.");
        flock.test.arrayContainsOnlyValues(buffer, [0.0, 1.0], msg + " should only contain zeros and ones.");

        for (i = 0; i < buffer.length; i++) {
            if (impulseLocations.indexOf(i) !== -1) {
                QUnit.equal(buffer[i], 1.0, msg + ", the sample at index " + i + " should contain an impulse.");
            } else {
                if (buffer[i] !== 0.0) {
                    QUnit.equal(buffer[i], 0.0, msg + ", the sample at index " + i + " should be silent.");
                }
            }
        }
    };

    QUnit.test("flock.ugen.impulse()", function () {
        // TODO: Why are we always one sample late?
        var actual = genOneSecondImpulse(1.0, 0.0);
        testImpulses(actual, [], "With a frequency of 1 Hz and phase of 0.0");

        actual = genOneSecondImpulse(1.0, 1.0);
        testImpulses(actual, [0], "With a frequency of 1 Hz and phase of 1.0");

        actual = genOneSecondImpulse(1.0, 0.5);
        testImpulses(actual, [sampleRate / 2], "With a frequency of 1 Hz and phase of 0.5");

        actual = genOneSecondImpulse(1.0, 0.01);
        testImpulses(actual, [sampleRate - (sampleRate / 100) + 1], "With a frequency of 1 Hz and phase of 0.01");

        actual = genOneSecondImpulse(2.0, 0.0);
        testImpulses(actual, [sampleRate / 2], "With a frequency of 2 Hz and phase of 0");

        actual = genOneSecondImpulse(2.0, 0.5);
        testImpulses(actual, [sampleRate / 4, sampleRate - sampleRate / 4], "With a frequency of 2 Hz and phase of 0.5");

        actual = genOneSecondImpulse(2.0, 1.0);
        testImpulses(actual, [0, sampleRate / 2], "With a frequency of 2 Hz and phase of 1");
    });

    environment.destroy();
}());
