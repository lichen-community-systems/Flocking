/*!
* Flocking Buffer Unit Generator Unit Tests
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

    var QUnit = fluid.registerNamespace("QUnit");

    fluid.registerNamespace("flock.test.ugen.bufferDuration");

    var module = flock.test.module({
        name: "flock.ugen.bufferDuration tests",

        enviroOptions: {
            listeners: {
                "onCreate.resolveTestBuffer": {
                    funcName: "flock.test.ugen.bufferDuration.resolveTestBuffer",
                    args: ["{that}"]
                }
            }
        }
    });

    flock.test.ugen.bufferDuration.resolveTestBuffer = function (environment) {
        var sampleRate = environment.audioSystem.model.rates.audio;
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
    };

    flock.test.ugen.bufferDuration.runTestAtRate = function (rate) {
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

    flock.test.ugen.bufferDuration.runTests = function () {
        var supportedRates = ["constant", "control"];
        fluid.each(supportedRates, function (rate) {
            flock.test.ugen.bufferDuration.runTestAtRate(rate);
        });
    };

    flock.test.ugen.bufferDuration.runTests();


    fluid.registerNamespace("flock.test.ugen.chopBuffer");

    flock.test.ugen.chopBuffer.runTest = function () {
        var s = flock.synth({
            synthDef: {
                id: "chopper",
                ugen: "flock.ugen.chopBuffer",
                start: 0.25,
                end: 0.5,
                buffer: "honey"
            },

            members: {
                audioSettings: {
                    // Ensure we're generating a large enough buffer to get some sound.
                    blockSize: 2048
                }
            }
        });

        var chopper = s.get("chopper");

        flock.bufferLoader({
            bufferDefs: [
                {
                    id: "honey",
                    url: flock.test.pathForResource("../../../demos/shared/audio/hillier-first-chord.wav")
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
    };

    module = flock.test.module({
        name: "flock.ugen.chopBuffer"
    });

    QUnit.asyncTest("Constant rate inputs", flock.test.ugen.chopBuffer.runTest);

}());
