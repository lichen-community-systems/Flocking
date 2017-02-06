/*!
* Flocking Filter Unit Generator Unit Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2015, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    fluid.defaults("flock.test.ugen.delay", {
        gradeNames: "flock.test.module",

        name: "flock.ugen.delay",

        listeners: {
            onCreate: {
                funcName: "flock.test.ugen.delay.runTests",
                args: "{that}"
            }
        }
    });

    flock.test.ugen.delay.runTests = function (module) {
        QUnit.test("flock.ugen.delay", function () {
            var sampleRate = module.environment.audioSystem.model.rates.audio;

            var sourceBuffer = flock.test.ascendingBuffer(64, 1),
                sampGenCount = 0,
                incrementingMock = {
                    ugen: "flock.test.ugen.mock",
                    options: {
                        buffer: sourceBuffer,
                        gen: function (that, numSamps) {
                            var i;
                            for (i = 0; i < numSamps; i++) {
                                that.output[i] = that.options.buffer[i] + sampGenCount;
                            }
                            sampGenCount += numSamps;
                        }
                    }
                },
                delayLineDef = {
                    id: "delay",
                    ugen: "flock.ugen.delay",
                    inputs: {
                        source: incrementingMock,
                        time: 64 / sampleRate
                    }
                };

            var delaySynth = flock.synth({
                synthDef: delayLineDef
            });
            var delay = delaySynth.nodeList.namedNodes.delay;
            flock.evaluate.synth(delaySynth);

            // First block should be silent.
            var expected = new Float32Array(64);
            QUnit.deepEqual(delay.output, expected,
                "With a delay time equal to the length of a block, the first output block should be silent.");

            // Second should contain the first block's contents.
            flock.evaluate.synth(delaySynth);
            expected = flock.test.ascendingBuffer(64, 1);
            QUnit.deepEqual(delay.output, expected,
                "The delay's second block should contain the source's first block of samples.");

            // Third block should be similarly delayed.
            flock.evaluate.synth(delaySynth);
            expected = flock.test.ascendingBuffer(64, 65);
            QUnit.deepEqual(delay.output, expected,
                "The delay's third block should contain the source's second block of samples.");
        });
    };

    flock.test.ugen.delay();


    fluid.defaults("flock.test.ugen.filter", {
        gradeNames: "flock.test.module",

        name: "flock.ugen.filter tests",

        filterInputValues: [
            {
                freq: 440,
                q: 1.0
            },
            {
                freq: 880,
                q: 0.5
            },
            {
                freq: 22050,
                q: 0.1
            },
            {
                freq: 440,
                q: 10
            },
            {
                freq: 880,
                q: 20
            },
            {
                freq: 22050,
                q: 100
            }
        ],

        listeners: {
            onCreate: {
                funcName: "flock.test.ugen.filter.runTests",
                args: "{that}"
            }
        }
    });


    flock.test.ugen.filter.checkCoefficient = function (coefficient) {
        QUnit.ok(!isNaN(coefficient), "The coefficient should never be NaN");
        QUnit.ok(coefficient !== Infinity, "The coefficient should never be Infinity");
        QUnit.ok(coefficient !== Number.NEGATIVE_INFINITY, "The coefficient should never be negative Infinity");
        //ok(coefficient >= -1.0 && coefficient <= 1.0, "The coefficient should be in the range of -1.0 to 1.0");
    };

    flock.test.ugen.filter.checkCoefficients = function (model) {
        fluid.each(model.coeffs, function (coefficientArray) {
            fluid.each(coefficientArray, function (coefficient) {
                flock.test.ugen.filter.checkCoefficient(coefficient);
            });
        });
    };

    flock.test.ugen.filter.forEachFilterType = function (fn) {
        fluid.each(flock.coefficients, function (recipe, recipeName) {
            fluid.each(recipe, function (calculator, filterType) {
                // TODO: This suggests that the payload for filter recipes isn't quite right.
                if (filterType === "sizes") {
                    return;
                }
                fn(recipeName, recipe, filterType, calculator);
            });
        });
    };

    flock.test.ugen.filter.testEachFilterInputValue = function (module, name, fn) {
        QUnit.test(name, function () {
            fluid.each(module.options.filterInputValues, function (inputs) {
                fn(inputs, module);
            });
        });
    };

    // Test all coefficient recipes.
    flock.test.ugen.filter.runTests = function (module) {
        flock.test.ugen.filter.forEachFilterType(function (recipeName, receipe, filterType, fn) {
            var name = "flock.coefficients." + recipeName + "." + filterType;

            flock.test.ugen.filter.testEachFilterInputValue(module, name, function (inputs, module) {
                var model = {
                    coeffs: {
                        a: new Float32Array(2),
                        b: new Float32Array(3)
                    },
                    sampleRate: module.environment.audioSystem.model.rates.audio

                };

                fn(model, inputs.freq, inputs.q);
                flock.test.ugen.filter.checkCoefficients(model);
            });
        });
    };

    flock.test.ugen.filter();

    // Test the flock.ugen.filter unit generator with all filter types and a set of generic input values.
    /*
    forEachFilterType(function (recipeName, recipe, filterType) {
        var name = "flock.ugen.filter() " + recipeName + "." + filterType;
        testEachFilterInputValue(name, function (inputs) {
            var ugen = {
                id: "filter",
                ugen: "flock.ugen.filter",
                inputs: inputs,
                options: {
                    // TODO: API bug. I should just be able to specify a type (as a key path) without a recipe if I want.
                    recipe: recipe,
                    type: filterType
                }
            };
            ugen.inputs.source = {
                ugen: "flock.ugen.lfNoise",
                inputs: {
                    freq: 440,
                    mul: 0.95
                }
            };

            var filterSynth = flock.synth(ugen);
            filterSynth.gen(64);
            flock.test.arrayUnbrokenSignal(filterSynth.get("filter"), -1.0, 1.0);
        });
    });
    */
}());
