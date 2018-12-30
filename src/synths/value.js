/*
 * Flocking Value Synth
 * https://github.com/colinbdclark/flocking
 *
 * Copyright 2013-2018, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, flock*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

fluid.defaults("flock.synth.value", {
    gradeNames: ["flock.synth"],

    rate: "demand",
    addToEnvironment: false,

    invokers: {
        generate: {
            funcName: "flock.evaluate.synthValue"
        }
    }
});
