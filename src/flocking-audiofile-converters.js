/*
 * Flocking Audio Converters
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, self, global */
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

    var g = typeof (window) !== "undefined" ? window :
        typeof (self) !== "undefined" ? self : global;

    fluid.registerNamespace("flock.audio.convert");

    flock.audio.convert.maxFloatValue = function (formatSpec) {
        return 1 - 1 / formatSpec.scale;
    };

    flock.audio.convert.pcm = {
        int8: {
            scale: 128,
            setter: "setInt8",
            width: 1
        },

        int16: {
            scale: 32768,
            setter: "setInt16",
            width: 2
        },

        int32: {
            scale: 2147483648,
            setter: "setInt32",
            width: 4
        },

        float32: {
            scale: 1,
            setter: "setFloat32",
            width: 4
        }
    };

    // Precompute the maximum representable float value for each format.
    for (var key in flock.audio.convert.pcm) {
        var formatSpec = flock.audio.convert.pcm[key];
        formatSpec.maxFloatValue = flock.audio.convert.maxFloatValue(formatSpec);
    }

    // Unsupported, non-API function.
    flock.audio.convert.specForPCMType = function (format) {
        var convertSpec = typeof format === "string" ? flock.audio.convert.pcm[format] : format;
        if (!convertSpec) {
            flock.fail("Flocking does not support " + format + " format PCM wave files.");
        }

        return convertSpec;
    };


    /**
     * Converts the value from float to integer format
     * using the specified format specification.
     *
     * @param {Number} value the float to convert
     * @param {Object} formatSpec a specification of the format conversion
     * @return {Number} the value converted to int format, constrained to the bounds defined by formatSpec
     */
    flock.audio.convert.floatToInt = function (value, formatSpec) {
        // Clamp to within bounds.
        var s = Math.min(formatSpec.maxFloatValue, value);
        s = Math.max(-1.0, s);

        // Scale to the output number format.
        s = s * formatSpec.scale;

        // Round to the nearest whole sample.
        // TODO: A dither here would be optimal.
        s = Math.round(s);

        return s;
    };

    flock.audio.convert.floatsToInts = function (buf, formatSpec) {
        if (!buf) {
            return;
        }

        var arrayType = "Int" + (8 * formatSpec.width) + "Array",
            converted = new g[arrayType](buf.length);

        for (var i = 0; i < buf.length; i++) {
            var floatVal = buf[i],
                intVal = flock.audio.convert.floatToInt(floatVal, formatSpec);

            converted[i] = intVal;
        }

        return converted;
    };

    /**
     * Converts the value from integer to floating format
     * using the specified format specification.
     *
     * @param {Number} value the integer to convert
     * @param {Object} formatSpec a specification of the format conversion
     * @return {Number} the value converted to float format
     */
    flock.audio.convert.intToFloat = function (value, formatSpec) {
        return value / formatSpec.scale;
    };

    flock.audio.convert.intsToFloats = function (buf, formatSpec) {
        if (!buf) {
            return;
        }

        var converted = new Float32Array(buf.length);

        for (var i = 0; i < buf.length; i++) {
            var intVal = buf[i],
                floatVal = flock.audio.convert.intToFloat(intVal, formatSpec);

            converted[i] = floatVal;
        }

        return converted;
    };
}());
