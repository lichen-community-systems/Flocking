/*
 * Flocking Band
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2013-2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, flock*/
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

    /**
     * flock.band provides an IoC-friendly interface for a collection of named synths.
     */
    // TODO: Unit tests.
    fluid.defaults("flock.band", {
        gradeNames: ["fluid.component"],

        invokers: {
            play: {
                func: "{that}.events.onPlay.fire"
            },

            pause: {
                func: "{that}.events.onPause.fire"
            },

            set: {
                func: "{that}.events.onSet.fire"
            },

            getSynths: {
                funcName: "flock.band.getSynths",
                args: ["{that}"]
            }
        },

        events: {
            onPlay: null,
            onPause: null,
            onSet: null
        },

        distributeOptions: [
            {
                source: "{that}.options.childListeners",
                removeSource: true,
                target: "{that fluid.component}.options.listeners"
            },
            {
                source: "{that}.options.synthListeners",
                removeSource: true,
                target: "{that flock.synth}.options.listeners"
            }
        ],

        childListeners: {
            "{band}.events.onDestroy": {
                func: "{that}.destroy"
            }
        },

        synthListeners: {
            "{band}.events.onPlay": {
                func: "{that}.play"
            },

            "{band}.events.onPause": {
                func: "{that}.pause"
            },

            "{band}.events.onSet": {
                func: "{that}.set"
            }
        }
    });

    flock.band.getSynths = function (that) {
        var synths = [];
        fluid.each(that.options.components, function (componentDef, name) {
            if (fluid.hasGrade(that[name].options, "flock.synth")) {
                synths.push(that[name]);
            }
        });

        return synths;
    };
}());
