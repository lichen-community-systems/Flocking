/*
 * Flocking Core Utilities Tests
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

    fluid.registerNamespace("flock.test.core");

    QUnit.module("Utility tests");

    QUnit.test("flock.isIterable()", function () {
        QUnit.expect(9);

        var iterable = [
            {
                val: ["cat", "dog"],
                msg: "A standard Array should be iterable."
            },
            {
                val: new Float32Array([0, 1, 2]),
                msg: "A typed array should be iterable."
            }
        ];

        var notIterable = [
            {
                val: {
                    cat: "dog"
                },
                msg: "An Object should not be iterable."
            },
            {
                val: true,
                msg: "A boolean should not be iterable."
            },
            {
                val: function () {
                    "cat";
                },
                msg: "A Function should not be iterable."
            },
            {
                val: "Stringy",
                msg: "A String should not be iterable."
            },
            {
                val: 42,
                msg: "A number should not be iterable."
            },
            {
                val: undefined,
                msg: "Undefined should not be iterable."
            },
            {
                val: null,
                msg: "Null should not be iterable."
            }
        ];

        fluid.each(iterable, function (testSpec) {
            QUnit.ok(flock.isIterable(testSpec.val), testSpec.msg);
        });

        fluid.each(notIterable, function (testSpec) {
            QUnit.ok(!flock.isIterable(testSpec.val), testSpec.msg);
        });
    });

    QUnit.test("flock.parseMidiString", function () {
        QUnit.expect(8);

        function runMidiStringTest(testSpec) {
            var actual = flock.parseMidiString(testSpec.note);
            QUnit.deepEqual(actual, testSpec.expected, testSpec.name);
        }

        var testSpecs = [
            {
                name: "No accidental, c0",
                note: "c0",
                expected: 0
            },
            {
                name: "No accidental",
                note: "e9",
                expected: 112
            },
            {
                name: "Sharp lower case",
                note: "g#6",
                expected: 80
            },
            {
                name: "Sharp upper case",
                note: "F#6",
                expected: 78
            },
            {
                name: "Flat",
                note: "Bb8",
                expected: 106
            },
            {
                name: "Two digits",
                note: "G10",
                expected: 127
            },
            {
                name: "Two digits with accidental",
                note: "C#10",
                expected: 121
            },
            {
                name: "Invalid note name",
                note: "cat27",
                expected: NaN
            }
            // What about out of range octaves? Should it work?
        ];

        fluid.each(testSpecs, runMidiStringTest);
    });

    var defaultFailMode = flock.debug.failHard;
    QUnit.module("Path utilities", {
        teardown: function () {
            flock.debug.failHard = defaultFailMode;
        }
    });

    QUnit.test("flock.set()", function () {
        var root = {
            cat: "meow",
            dog: {
                sheltie: "bark"
            }
        };

        var tests = [
            {
                path: "cat",
                value: "rreow",
                msg: "Single-segment path."
            },
            {
                path: "dog.sheltie",
                value: "roof",
                msg: "Multi-segment path."
            },
            {
                path: "dog.sheltie",
                value: {
                    fur: {
                        primary: "sable",
                        secondary: "white"
                    }
                },
                msg: "Multi-segment path, object value."
            },
            {
                path: "dog.claws.count",
                value: 25,
                msg: "Path with non-existent middle segment should cause the container to be created."
            },
            {
                path: "dog.sheltie",
                value: undefined,
                msg: "Valid path, undefined value."
            },
            {
                path: "dog.sheltie",
                value: null,
                msg: "Valid path, null value."
            }
        ];

        fluid.each(tests, function (spec) {
            flock.set(root, spec.path, spec.value);
            QUnit.equal(flock.get(root, spec.path), spec.expected || spec.value, spec.msg);
        });

        // Error cases
        try {
            flock.set(root, "cat.claws.count", 25);
            QUnit.ok(false);
        } catch (e) {
            QUnit.ok(e.message.indexOf("cat") !== -1);
        }
    });

    var assertNoErrorThrown = function (fn) {
        try {
            fn();
            QUnit.ok(true, "A hard error shouldn't be thrown.");
        } catch (e) {
            QUnit.ok(false, "A hard error shouldn't be thrown.");
        }
    };

    var assertErrorThrown = function (fn) {
        try {
            fn();
            QUnit.ok(false, "A hard error should be thrown.");
        } catch (e) {
            QUnit.ok(true, "A hard error should be thrown.");
        }
    };

    QUnit.test("Getting and setting invalid paths with soft failure enabled", function () {
        flock.debug.failHard = false;

        assertNoErrorThrown(function () {
            flock.get({}, "cow.moo");
        });

        assertNoErrorThrown(function () {
            flock.set({}, "cow.moo", true);
        });
    });

    QUnit.test("Getting and setting invalid paths with hard failure enabled", function () {
        flock.debug.failHard = true;

        assertErrorThrown(function () {
            flock.get({}, "cow.moo");
        });

        assertErrorThrown(function () {
            flock.set({}, "cow.moo", true);
        });
    });

    var testInputPathExpansion = function (testSpecs) {
        fluid.each(testSpecs, function (spec) {
            var actual = flock.input.pathExpander(spec.path);
            QUnit.equal(actual, spec.expected, spec.msg,
                "Setting to a non-container type should cause an error to be thrown.");
        });
    };

    QUnit.test("flock.synth.inputPathExpander()", function () {
        testInputPathExpansion([
            {
                path: "cat.dog",
                expected: "cat.inputs.dog",
                msg: "With a single dot, the path should have been expanded as an input path."
            },
            {
                path: "cat.dog.hamster",
                expected: "cat.inputs.dog.inputs.hamster",
                msg: "With multiple dots, the path should have been expanded as an input path."
            },
            {
                path: "cat.dog.1.hamster",
                expected: "cat.inputs.dog.1.inputs.hamster",
                msg: "With a single-digit number, all segments except immediately preceding the number path should have been expanded."
            },
            {
                path: "cat.dog.27.hamster",
                expected: "cat.inputs.dog.27.inputs.hamster",
                msg: "With a multi-digit number, all segments except immediately preceding the number path should have been expanded."
            },
            {
                path: "cat27.dog.0.fish42",
                expected: "cat27.inputs.dog.0.inputs.fish42",
                msg: "Path segments with numbers should be handled correctly."
            },
            {
                path: "cat.dog.model.value",
                expected: "cat.inputs.dog.model.value",
                msg: "The special 'model' keyword should not be expanded"
            },
            {
                path: "cat.dog.options.isAwesome",
                expected: "cat.inputs.dog.options.isAwesome",
                msg: "The special 'options' keyword should not be expanded"
            },
            {
                path: "cat.dog.options.model",
                expected: "cat.inputs.dog.options.model",
                msg: "Reference to options.model should not be expanded"
            },
            {
                path: "cat.dog.Options.Model",
                expected: "cat.inputs.dog.inputs.Options.inputs.Model",
                msg: "The match must be case sensitive"
            },
            {
                path: "fish.modelizedCat.dogoptions.hamster.model.options.model",
                expected: "fish.inputs.modelizedCat.inputs.dogoptions.inputs.hamster.model.options.model",
                msg: "Partial matches on the words 'options' or 'model' should be ignored."
            },
            {
                path: "dog.optionsCat.modelDog.value",
                expected: "dog.inputs.optionsCat.inputs.modelDog.inputs.value",
                msg: "Partial matches on the words 'options' or 'model' should be ignored."
            },
            {
                path: "sine.freq.model",
                expected: "sine.inputs.freq.model",
                msg: "Special segment at the end should be matched"
            },
            {
                path: "sine.freq.options",
                expected: "sine.inputs.freq.options",
                msg: "Special segment at the end should be matched"
            },
            {
                path: "model.freq",
                expected: "model.inputs.freq",
                msg: "Special segment at the beginning should not be matched"
            }
        ]);
    });

    QUnit.test("flock.generateBufferWithValue()", function () {
        // Buffer size and static number for the generator.
        var expected = new Float32Array([1.0, 1.0, 1.0]);
        var actual = flock.generateBufferWithValue(3, 1.0);
        QUnit.deepEqual(actual, expected, "Buffer size as a number and generator as a scalar.");
    });

    QUnit.test("flock.generateBuffer()", function () {
        // Buffer size and generator function
        var expected = new Float32Array([0, 42, 0, 42, 0]);
        var actual = flock.generateBuffer(5, function (i) {
            return i % 2 > 0 ? 42 : 0;
        });
        QUnit.deepEqual(actual, expected, "Buffer size as a number and generator function.");
    });

    QUnit.test("flock.fillBufferWithValue()", function () {
        // Pre-existing buffer and a static number for the generator.
        var expected = new Float32Array(5);
        var actual = flock.fillBufferWithValue(expected, 42.0);
        QUnit.equal(actual, expected, "When a buffer is supplied as the first argument, it should operated on in place.");
    });

    QUnit.test("flock.fillBuffer()", function () {
        // Pre-existing buffer and a generator function.
        var expected = new Float32Array([99.9, 199.8]);
        var inputBuffer = new Float32Array(2);
        var actual = flock.fillBuffer(inputBuffer, function (i) {
            return 99.9 * (i + 1);
        });
        QUnit.equal(actual, inputBuffer,
            "When a buffer is supplied as the first argument and a generator as the second, the buffer should operated on in place.");
        QUnit.deepEqual(actual, expected,
            "The generator should be invoked with the increment value as its first argument, and its output should be placed in the buffer.");
    });


    var testNormalize = function (normal, unnormalized, expected) {
        var actual = flock.normalize(unnormalized, normal);
        QUnit.deepEqual(actual, expected, "Buffer normalized to " + normal + ".");
    };

    QUnit.test("flock.reverse()", function () {
        QUnit.expect(5);

        var forwardRaw = [1, 2, 3, 4, 5],
            forwardTyped = new Float32Array(forwardRaw),
            reverseRaw = [5, 4, 3, 2, 1],
            reverseTyped = new Float32Array(reverseRaw),
            actual = flock.reverse(forwardTyped);

        QUnit.deepEqual(actual, reverseTyped, "A typed array should be reversed as expected.");

        actual = flock.reverse(forwardRaw);
        QUnit.deepEqual(actual, reverseRaw, "A plain JS array should be reversed as expected.");

        var empty = [];
        actual = flock.reverse(empty);
        QUnit.equal(actual, empty, "An empty array should be returned as is.");

        var oneItemList = ["Cat"];
        actual = flock.reverse(oneItemList);
        QUnit.equal(actual, oneItemList, "A single-item list should be returned as is.");

        var nonArray = {a: "cat", b: new Float32Array([1, 2, 3])};
        actual = flock.reverse(nonArray);
        QUnit.equal(actual, nonArray, "A non array argument should be returned as is.");
    });

    QUnit.test("flock.normalize()", function () {
        QUnit.expect(6);
        var unnormalized = [0.0, 0.5, 1.0, 1.5, 2.0];
        testNormalize(1.0, unnormalized, [0.0, 0.25, 0.5, 0.75, 1.0]);
        testNormalize(0.5, unnormalized, [0.0, 0.125, 0.25, 0.375, 0.5]);
        testNormalize(3.0, unnormalized, [0.0, 0.75, 1.5, 2.25, 3.0]);

        var mixedUnnormalized = [-1.0, -0.5, 0.0, 0.5, 1.0, 0.5, 0.0];
        testNormalize(1.0, mixedUnnormalized, mixedUnnormalized);
        testNormalize(0.5, mixedUnnormalized, [-0.5, -0.25, 0.0, 0.25, 0.5, 0.25, 0.0]);

        var negUnnormalized = [-5.0, -4.0, -3.0, -2.0, -1.0, -0.5, -0.25];
        testNormalize(1.0, negUnnormalized, [-1.0, -0.8, -0.6, -0.4, -0.2, -0.1, -0.05]);
    });

}());
