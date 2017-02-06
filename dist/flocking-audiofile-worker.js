/*! Flocking audio file web worker decoder, Copyright 2011-2014 Colin Clark | flockingjs.org */

/*global importScripts, postMessage, self*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

var flock = {};

(function () {

    "use strict";

    flock.audio = {
        decode: {},
        workerDecoder: {}
    };

    // TODO: Allow toggling of these files with a production concatenated build.
    importScripts(
        "./flocking-audiofile-compatibility.js",
        "./flocking-audiofile-converters.js"
    );

    flock.audio.workerDecoder.sendBuffer = function (buffer, type) {
        postMessage({
            msg: "afterDecoded",
            buffer: buffer,
            type: type
        });
    };

    flock.audio.workerDecoder.sendError = function (errorMsg) {
        postMessage({
            msg: "onError",
            errorMsg: errorMsg
        });
    };

    self.addEventListener("message", function (e) {
        var data = e.data,
            type = data.type;

        if (data.msg === "decode") {
            try {
                var buffer = flock.audio.decodeArrayBuffer(data.rawData, type);
                flock.audio.workerDecoder.sendBuffer(buffer, type);
            } catch (err) {
                flock.audio.workerDecoder.sendError(err.message);
            } finally {
                self.close();
            }
        }
    });

}());
