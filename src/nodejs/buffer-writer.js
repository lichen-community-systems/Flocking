/*
 * Flocking Node.js Buffer Writer
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2013-2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/
/*jshint white: false, newcap: true, regexp: true, node: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

"use strict";

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock"),
    fs = require("fs");

fluid.defaults("flock.nodejs.bufferWriter", {
    gradeNames: "fluid.component",

    invokers: {
        save: "flock.nodejs.bufferWriter.saveBuffer({arguments}.0)"
    }
});

flock.nodejs.bufferWriter.saveBuffer = function (o) {
    var encoded = flock.audio.encode.wav(o.buffer);

    fs.writeFile(o.path, new Buffer(encoded), function (err) {
        if (err) {
            if (!o.error) {
                flock.fail("There was an error while writing a buffer named " +
                    o.buffer.id + " with the file path " + o.path + ". Error was: " + err);
            } else {
                o.error(err);
            }

            return;
        }

        if (o.success) {
            o.success(encoded);
        }
    });
};
