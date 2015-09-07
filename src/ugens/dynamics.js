/*
 * Flocking Dynamics Unit Generators
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2015, Colin Clark
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

    flock.ugen.normalize = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function () {
            var m = that.model,
                out = that.output,
                max = that.inputs.max.output[0], // Max is kr.
                source = that.inputs.source.output;

            // Note, this normalizes the source input ugen's output buffer directly in place.
            flock.normalize(source, max, out);
            m.value = m.unscaledValue = out[out.length - 1];
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.normalize", {
        rate: "audio",
        inputs: {
            max: 1.0,
            source: null
        }
    });

}());
