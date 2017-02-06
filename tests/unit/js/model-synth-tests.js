/*
 * Flocking Model Synth Tests
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2015, OCAD University
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    var environment;
    QUnit.module("Model synths", {
        setup: function () {
            environment = flock.silentEnviro();
        },
        teardown: function () {
            environment.destroy();
        }
    });

    fluid.registerNamespace("flock.test.modelSynth");

    fluid.defaults("flock.test.modelSynth.amSynth", {
        gradeNames: "flock.modelSynth",

        synthDef: {
            id: "carrier",
            ugen: "flock.ugen.sin",
            freq: 440,
            mul: {
                id: "modulator",
                ugen: "flock.ugen.sin",
                freq: 110,
                mul: {
                    id: "volSequencer",
                    ugen: "flock.ugen.sequencer",
                    durations: [2.0, 3.0],
                    values: [0.5, 0.4],
                    loop: 1.0
                }
            }
        }
    });

    flock.test.modelSynth.setValueTestSpecs = [
        {
            name: "Primitive values",
            type: "flock.test.modelSynth.amSynth",
            modelPath: "inputs.carrier.freq",
            synthPath: "carrier.freq",
            value: 123,
            msg: "The model value should have been updated with the primitive value."
        },
        {
            name: "Arrays",
            type: "flock.test.modelSynth.amSynth",
            modelPath: "inputs.volSequencer.durations",
            synthPath: "volSequencer.durations",
            value: [1.0, 2.0],
            msg: "The model value should have been updated with an array value."
        },
        {
            name: "ugenDefs",
            type: "flock.test.modelSynth.amSynth",
            modelPath: "inputs.modulator",
            synthPath: "modulator",
            value: {
                ugen: "flock.ugen.triOsc",
                freq: 10,
                mul: {
                    ugen: "flock.ugen.sin",
                    freq: 1/10,
                    mul: 0.5,
                    add: 0.5
                }
            },
            test: function (actual, testSpec) {
                QUnit.ok(actual.tags.indexOf("flock.ugen") > -1, "The input should have been updated to a new unit generator");
                QUnit.equal(actual.options.ugenDef.ugen, testSpec.value.ugen, "The input should be the correct type of unit generator");
            }
        },
        {
            name: "arrays of ugenDefs",
            type: "flock.test.modelSynth.amSynth",
            modelPath: "inputs.flocking-out.sources",
            synthPath: "flocking-out.sources",
            value: [
                {
                    ugen: "flock.ugen.saw",
                    freq: 60
                }, {
                    ugen: "flock.ugen.square",
                    freq: 120
                }
            ],
            test: function (actual, testSpec) {
                QUnit.equal(actual.length, 2, "Two unit generators should have been set on the input.");
                QUnit.equal(actual[0].options.ugenDef.ugen, testSpec.value[0].ugen, "The first ugen input should be the correct type of unit generator");
                QUnit.equal(actual[1].options.ugenDef.ugen, testSpec.value[1].ugen, "The second ugen input should be the correct type of unit generator");
            }
        }
    ];

    flock.test.modelSynth.testSetValue = function (testSpec) {
        var synth = fluid.invokeGlobalFunction(testSpec.type);
        synth.applier.change(testSpec.modelPath, testSpec.value);

        var actual = synth.get(testSpec.synthPath);
        if (typeof (testSpec.test) === "function") {
            testSpec.test(actual, testSpec);
        } else {
            var expected = testSpec.expected !== undefined ? testSpec.expected : testSpec.value;
            QUnit.deepEqual(actual, expected, testSpec.msg);
        }
    };

    flock.test.modelSynth.setValueTests = function (testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            QUnit.test(testSpec.name, function () {
                flock.test.modelSynth.testSetValue(testSpec);
            });
        });
    };

    flock.test.modelSynth.setValueTests(flock.test.modelSynth.setValueTestSpecs);

    fluid.defaults("flock.test.modelSynth.valueSynth", {
        gradeNames: ["flock.synth.value", "flock.modelSynth"],

        model: {
            value: 0
        },

        synthDef: {
            ugen: "flock.ugen.value",
            value: 42
        },

        modelListeners: {
            value: {
                excludeSource: "init",
                funcName: "flock.test.modelSynth.valueTester",
                args: ["{that}", "{change}"]
            }
        }
    });

    flock.test.modelSynth.valueTester = function (synth, change) {
        QUnit.equal(synth.model.value, 42,
            "The synth's model should have been updated.");
        QUnit.equal(change.value, 42,
            "The model listener's change spec should reflect the change.");
    };

    QUnit.test("value() updates the synth's model", function () {
        QUnit.expect(2);

        var s = flock.test.modelSynth.valueSynth();
        s.value();
    });

}());
