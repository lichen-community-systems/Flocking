/*
 * Flocking Node.js Audio System
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2013-2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true,
    node: true, forin: true, continue: true, nomen: true,
    bitwise: true, maxerr: 100, indent: 4 */

"use strict";

var fs = require("fs"),
    url = require("url"),
    fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");


fluid.defaults("flock.nodejs.audioSystem", {
    gradeNames: "flock.audioSystem",

    components: {
        outputManager: {
            type: "flock.nodejs.outputManager"
        },

        bufferWriter: {
            type: "flock.nodejs.bufferWriter"
        }
    }
});



/********************************************************
 * Monkeypatches for various parts of the buffer system *
 ********************************************************/

// TODO: Ditch all this by better componentizing Flocking's buffer system.

fluid.registerNamespace("flock.file");

flock.file.readFromPath = function (options) {
    var path = options.src;

    fs.exists(path, function (exists) {
        if (!exists && options.error) {
            options.error(path + " doesn't exist.");
            return;
        }

        fs.stat(path, function (error, stats) {
            fs.open(path, "r", function (error, fd) {
                var buf = new Buffer(stats.size);

                fs.read(fd, buf, 0, buf.length, null, function () {
                    var type = flock.file.parseFileExtension(path);
                    var arr = new Int8Array(buf);
                    options.success(arr.buffer, type);
                });
            });
        });
    });
};

fluid.registerNamespace("flock.net");

flock.net.readBufferFromUrl = function () {
    throw new Error("Loading files from URLs is not currently supported in Node.js.");
};

fluid.registerNamespace("flock.audio.loadBuffer");

flock.audio.loadBuffer.readerForSource = function (src) {
    if (typeof (src) !== "string") {
        throw new Error("Flocking error: Can't load a buffer from an unknown type of source. " +
            "Only paths and URLs are currently supported on Node.js.");
    }
    var parsed = url.parse(src);
    return parsed.protocol === "data:" ? flock.file.readBufferFromDataUrl :
        !parsed.protocol ? flock.file.readFromPath : flock.net.readBufferFromUrl;
};

fluid.registerNamespace("flock.audio.decode");

// TODO: Use a stream-style interface for decoding rather than just dumping the whole job on nextTick().
flock.audio.decode.node = function (options) {
    process.nextTick(function () {
        flock.audio.decode.sync(options);
    });
};

flock.audio.registerDecoderStrategy({
    "default": flock.audio.decode.node,
    "aiff": flock.audio.decode.node
});


/**
 * Distributes platform-specific grades for Node.js
 */
fluid.defaults("flock.nodejs.enviroContextDistributor", {
    gradeNames: "fluid.component",

    distributeOptions: [
        {
            target: "{/ flock.scheduler.once}.options.components.clock",
            record: {
                type: "flock.scheduler.scheduleClock"
            }
        },
        {
            target: "{/ flock.scheduler.repeat}.options.components.clock",
            record: {
                type: "flock.scheduler.intervalClock"
            }
        },
        {
            target: "{/ flock.enviro > audioSystem}.options",
            record: {
                gradeNames: "flock.nodejs.audioSystem"
            }
        }
    ]
});

fluid.constructSingle([], {
    singleRootType: "flock.enviroContextDistributor",
    type: "flock.nodejs.enviroContextDistributor"
});
