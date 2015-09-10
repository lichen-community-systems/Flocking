/*
 * Flocking Web Audio Buffer Writer
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

    fluid.defaults("flock.webAudio.bufferWriter", {
        gradeNames: "fluid.component",

        invokers: {
            save: "flock.webAudio.bufferWriter.saveBuffer({arguments}.0)"
        }
    });

    // TODO: This should move into its own component.
    flock.webAudio.bufferWriter.saveBuffer = function (o) {
        try {
            var encoded = flock.audio.encode.wav(o.buffer, o.format),
                blob = new Blob([encoded], {
                    type: "audio/wav"
                });

            flock.webAudio.bufferWriter.download(o.path, blob);

            if (o.success) {
                o.success(encoded);
            }

            return encoded;
        } catch (e) {
            if (!o.error) {
                flock.fail("There was an error while trying to download the buffer named " +
                    o.buffer.id + ". Error: " + e);
            } else {
                o.error(e);
            }
        }
    };

    flock.webAudio.bufferWriter.download = function (fileName, blob) {
        var dataURL = flock.shim.URL.createObjectURL(blob),
            a = window.document.createElement("a"),
            click = document.createEvent("Event");

        // TODO: This approach currently only works in Chrome.
        // Although Firefox apparently supports it, this method of
        // programmatically clicking the link doesn't seem to have an
        // effect in it.
        // http://caniuse.com/#feat=download
        a.href = dataURL;
        a.download = fileName;
        click.initEvent("click", true, true);
        a.dispatchEvent(click);
    };
}());
