/*
 * Flocking All Node.js Tests Runner
 *
 * Copyright 2016-2017, Colin Clark
 * Licensed under the MIT and GPL 3 licenses.
 */

/*jshint node:true*/

"use strict";

// Ensure Flocking is loaded and available for test modules to
// source via a call to fluid.registerNamespace().
require("../../../index.js");

// General test dependencies.
var fluid = require("infusion");
fluid.require("%flocking/tests/unit/js/flocking-test-utils.js");
fluid.require("%flocking/tests/unit/js/audiofile-test-utils.js");
fluid.require("%flocking/tests/shared/js/audiofile-dataurls.js");

// Test files.
var testIncludes = [
    "../js/perf-tests.js",       // Note: This test must run first
                                 // because it is unreliable and
                                 // timing-dependent. It needs to be
                                 // refactored or replaced.
    "../js/audiofile-decoder-tests.js",
    "../js/audiofile-tests.js",
    "../js/band-tests.js",
    "../js/bandlimited-ugen-tests.js",
    "../js/buffer-tests.js",
    "../js/buffer-ugen-tests.js",
    "../js/bus-tests.js",
    "../js/core-tests.js",
    "../js/core-utilities-tests.js",
    "../js/dynamics-ugen-tests.js",
    "../js/envelope-ugen-tests.js",
    "../js/envgen-ugen-tests.js",
    "../js/filter-ugen-tests.js",
    "../js/gate-ugen-tests.js",
    "../js/ioc-integration-tests.js",
    "../js/listening-ugen-tests.js",
    "../js/math-ugen-tests.js",
    "../js/midi-tests.js",
    "../js/model-synth-tests.js",
    "../js/multichannel-ugen-tests.js",
    "../js/nodelist-tests.js",
    "../js/osc-ugen-tests.js",
    "../js/parser-tests.js",
    "../js/phasor-ugen-tests.js",
    "../js/playbuffer-ugen-tests.js",
    "../js/random-ugen-tests.js",
    "../js/scheduler-tests.js",
    "../js/scheduler-timing-tests.js",
    "../js/scheduling-ugen-tests.js",
    "../js/synth-tests.js",
    "../js/synth-environment-tests.js",
    "../js/synth-evaluation-tests.js",
    "../js/synth-group-tests.js",
    "../js/synth-instantiation-tests.js",
    "../js/synth-note-target-tests.js",
    "../js/synth-scheduled-tests.js",
    "../js/trigger-ugen-tests.js",
    "../js/ugen-tests.js",
    "../js/writebuffer-ugen-tests.js",

    // This test file is wildly unstable when run in Node.js,
    // perhaps due to node-speaker or just because it contains
    // terribly-designed tests?
    // "../js/synth-removal-tests.js"
];

testIncludes.forEach(function (path) {
    require(path);
});
