/*
 * Flocking Modelized Synth
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2013-2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    // TODO: Unit tests.
    fluid.defaults("flock.modelSynth", {
        gradeNames: "flock.synth",

        modelListeners: {
            "": "flock.modelSynth.updateUGens({that}, {change}.value)"
        }
    });

    flock.modelSynth.updateUGens = function (that, changeValue) {
        var changeSpec = {};
        flock.modelSynth.flattenModel("", changeValue, changeSpec);
        that.set(changeSpec);
    };

    flock.modelSynth.flattenModel = function (path, model, changeSpec) {
        for (var key in model) {
            var value = model[key],
                newPath = fluid.pathUtil.composePath(path, key.toString());

            if (fluid.isPrimitive(value) || value.ugen) {
                changeSpec[newPath] = value;
            } else {
                flock.modelSynth.flattenModel(newPath, value, changeSpec);
            }
        }

        return changeSpec;
    };
}());
