/*!
* Flocking Dynamics Unit Generator Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2017, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    var module = flock.test.module({
        name: "Normalizer"
    });

    QUnit.test("flock.ugen.normalize()", function () {
        var testBuffer = flock.test.ascendingBuffer(64, -31),
            mock = {
                ugen: "flock.test.ugen.mock",
                options: {
                    buffer: testBuffer
                }
            };

        var normalizerSynth = flock.synth({
            synthDef: {
                id: "normalizer",
                ugen: "flock.ugen.normalize",
                inputs: {
                    source: {
                        ugen: "flock.ugen.sum",
                        inputs: {
                            sources: [mock, mock]
                        }
                    },
                    max: 1.0
                }
            }
        });

        var normalizer = normalizerSynth.nodeList.namedNodes.normalizer;
        flock.evaluate.synth(normalizerSynth);

        var expected = flock.normalize(flock.test.ascendingBuffer(64, -31), 1.0);
        QUnit.deepEqual(normalizer.output, expected,
            "The signal should be normalized to 1.0.");

        normalizer.input("max", 0.5);
        normalizer.gen(64);
        expected = flock.normalize(flock.test.ascendingBuffer(64, -31), 0.5);
        QUnit.deepEqual(normalizer.output, expected,
            "When the 'max' input is changed to 0.5, the signal should be normalized to 0.5");
    });

    module.destroy();
}());
