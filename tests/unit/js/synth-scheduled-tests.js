/*
 * Flocking Framerate Synth Tests
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

    QUnit.module("Scheduled Synth");

    QUnit.test("Frame rate synth gets set up with the correct scheduled rate", function () {
        var s = flock.synth.frameRate({
            fps: 60,

            synthDef: {
                id: "oscillator",
                ugen: "flock.ugen.sin",
                freq: 1
            }
        });

        QUnit.equal(s.audioSettings.rates.scheduled, 60,
            "The frame rate should have been specified as the synth's scheduled rate.");
        QUnit.equal(s.get("oscillator").model.sampleRate, 60,
            "The unit generator should have its sample rate set to 60 fps.");
    });

}());
