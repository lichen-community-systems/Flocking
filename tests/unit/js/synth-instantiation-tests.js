/*
 * Flocking Synth Instantiation Tests
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

    QUnit.module("Synth instantiation tests");

    var assertNumberOfEvaluatableUGens = function (synth, expectedNumUGens) {
        QUnit.equal(Object.keys(synth.nodeList.namedNodes).length, 3, "There should be three registered ugens.");
        QUnit.equal(synth.nodeList.nodes.length, expectedNumUGens,
            "There should be " + expectedNumUGens + " ugens in the 'all' list, including the output.");
    };

    var checkParsedTestSynthDef = function (synthDef, expectedNumEvalUGens) {
        var synth = flock.synth({
            synthDef: synthDef
        }), namedUGens = synth.nodeList.namedNodes;

        assertNumberOfEvaluatableUGens(synth, expectedNumEvalUGens);
        QUnit.ok(namedUGens.sine, "The sine ugen should be keyed by its id....");
        QUnit.equal(0, namedUGens.sine.model.phase, "...and it should be a real osc ugen.");

        QUnit.ok(namedUGens.mul, "The mul ugen should be keyed by its id...");
        QUnit.ok(namedUGens.mul.model.value, "...and it should be a real value ugen.");
    };

    var condensedTestSynthDef = {
        id: "sine",
        ugen: "flock.ugen.sinOsc",
        freq: 440,
        mul: {
            id: "mul",
            ugen: "flock.ugen.value",
            value: 1.0
        }
    };

    var expandedTestSynthDef = {
        id: flock.OUT_UGEN_ID,
        ugen: "flock.ugen.out",
        inputs: {
            sources: condensedTestSynthDef,
            bus: 0,
            expand: 2
        }
    };

    QUnit.test("flock.synth(), no output specified", function () {
        checkParsedTestSynthDef(condensedTestSynthDef, 7);
    });

    QUnit.test("flock.synth(), output specified", function () {
        checkParsedTestSynthDef(expandedTestSynthDef, 7);
    });

    QUnit.test("flock.synth() with multiple channels", function () {
        var multiChanTestSynthDef = [
            {
                id: "leftSine",
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: 440
                }
            },
            {
                id: "rightSine",
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: 444
                }
            }
        ];

        var synth = flock.synth({
            synthDef: multiChanTestSynthDef
        });
        var namedUGens = synth.nodeList.namedNodes;

        assertNumberOfEvaluatableUGens(synth, 9);
        QUnit.ok(namedUGens.leftSine, "The left sine ugen should have been parsed correctly.");
        QUnit.ok(namedUGens.rightSine, "The right sine ugen should have been parsed correctly.");
        QUnit.deepEqual(synth.out.inputs.sources,
            [namedUGens.leftSine, namedUGens.rightSine],
            "The output ugen should have an array of sources, containing the left and right sine ugens.");
    });

    QUnit.test("flock.synth() with mix of compressed and expanded ugenDefs", function () {
        var mixedSynthDef = {
            id: "carrier",
            ugen: "flock.test.ugen.mock",
            freq: {
                id: "mod",
                ugen: "flock.test.ugen.mock",
                inputs: {
                    freq: 440,
                    phase: {
                        id: "line",
                        ugen: "flock.test.ugen.mock",
                        start: 1,
                        end: 10,
                        duration: 2
                    }
                }
            }
        };

        var synth = flock.synth({
            synthDef: mixedSynthDef
        }), namedUGens = synth.nodeList.namedNodes;

        QUnit.equal(namedUGens.carrier.inputs.freq, namedUGens.mod,
            "The modulator should have been set as the frequency input to the carrier.");
        QUnit.equal(namedUGens.mod.inputs.freq.model.value, 440,
            "The modulator's frequency should be 440.");
        QUnit.equal(namedUGens.mod.inputs.phase, namedUGens.line,
            "The modulator's phase input should be set to the line ugen.");
        QUnit.equal(namedUGens.line.inputs.end.model.value, 10,
            "The line's inputs should be set correctly.");
    });
}());
