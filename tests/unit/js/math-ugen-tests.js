/*!
* Flocking Math Unit Generator Unit Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-15, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    var environment = flock.init(),
        sampleRate = environment.audioSystem.model.rates.audio;

    QUnit.module("flock.ugen.math() tests");

    var testMath = function (synthDef, expected, msg) {
        synthDef.id = "math";
        var synth = flock.synth({
            synthDef: synthDef
        });
        flock.evaluate.synth(synth);
        var math = synth.nodeList.namedNodes.math;
        QUnit.deepEqual(math.output, expected, msg);
    };

    QUnit.test("flock.ugen.math() value inputs", function () {
        testMath({
            ugen: "flock.ugen.math",
            inputs: {
                source: 2,
                add: 5
            }
        }, flock.generateBufferWithValue(64, 7), "Value add");

        testMath({
            ugen: "flock.ugen.math",
            inputs: {
                source: 3,
                sub: 2
            }
        }, flock.generateBufferWithValue(64, 1), "Value subtract");

        testMath({
            ugen: "flock.ugen.math",
            inputs: {
                source: 3,
                mul: 2
            }
        }, flock.generateBufferWithValue(64, 6), "Value multiply");

        testMath({
            ugen: "flock.ugen.math",
            inputs: {
                source: 3,
                div: 2
            }
        }, flock.generateBufferWithValue(64, 1.5), "Value divide");
    });

    QUnit.test("flock.ugen.math() audio and control rate inputs", function () {
        var incBuffer = flock.generateBuffer(64, function (i) {
            return i + 1;
        });

        var expected = flock.generateBuffer(64, function (i) {
            return i + 4;
        });

        var krArUGenDef = {
            ugen: "flock.ugen.math",
            inputs: {
                source: {
                    ugen: "flock.ugen.sequence",
                    rate: "audio",
                    values: incBuffer,
                    freq: sampleRate
                },
                add: 3
            }
        };

        testMath(krArUGenDef, expected, "Audio rate source, value add");

        krArUGenDef.inputs.source.rate = "control";
        testMath(krArUGenDef, flock.generateBufferWithValue(64, 4), "Control rate source, value add");

        krArUGenDef.inputs.add = {
            ugen: "flock.ugen.sequence",
            rate: "control",
            values: incBuffer,
            freq: sampleRate
        };
        testMath(krArUGenDef, flock.generateBufferWithValue(64, 2), "Control rate source, control rate add.");

        krArUGenDef.inputs.source.rate = "audio";
        krArUGenDef.inputs.add.rate = "audio";
        testMath(krArUGenDef, flock.generateBuffer(64, function (i) {
            var j = i + 1;
            return j + j;
        }), "Audio rate source, audio rate add.");
    });


    QUnit.module("flock.ugen.sum() tests");

    QUnit.test("flock.ugen.sum()", function () {
        var addBuffer = flock.test.generateSequence(0, 31),
            one = flock.test.ugen.mock.make(addBuffer),
            two = flock.test.ugen.mock.make(addBuffer),
            three = flock.test.ugen.mock.make(addBuffer);

        one.gen(32);
        two.gen(32);
        three.gen(32);

        var inputs = {
            sources: [one]
        };

        var summer = flock.ugen.sum(inputs, new Float32Array(addBuffer.length));
        summer.gen(32);
        QUnit.deepEqual(summer.output, new Float32Array(addBuffer),
            "With a single source, the output should be identical to the source input.");

        inputs.sources = [one, two, three];
        var expected = flock.test.generateSequence(0, 93, 3);
        summer.inputs = inputs;
        summer.gen(32);
        QUnit.deepEqual(summer.output, new Float32Array(expected),
            "With three sources, the output consist of the inputs added together.");
    });

    environment.destroy();
}());
