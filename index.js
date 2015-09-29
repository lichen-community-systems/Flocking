/*
 * Flocking Node.js Main
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2013-2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true,
    node: true, forin: true, continue: true, nomen: true,
    bitwise: true, maxerr: 100, indent: 4 */

"use strict";

var fluid = require("infusion"),
    flock = fluid.registerNamespace("flock"),
    loader = fluid.getLoader(__dirname); // jshint ignore:line

loader.require("src/core.js");
loader.require("src/node-list.js");
loader.require("src/evaluators.js");
loader.require("src/synths/band.js");
loader.require("src/synths/model.js");
loader.require("src/synths/group.js");
loader.require("src/synths/polyphonic.js");
loader.require("src/buffers.js");
loader.require("src/parser.js");
loader.require("src/audiofile.js");
loader.require("src/audiofile-encoder.js");
loader.require("src/flocking-audiofile-compatibility.js");
loader.require("src/scheduler.js");
loader.require("src/web/midi.js");

// Unit generators
loader.require("src/ugens/core.js");
loader.require("src/ugens/bandlimited.js");
loader.require("src/ugens/browser.js");
loader.require("src/ugens/buffer.js");
loader.require("src/ugens/debugging.js");
loader.require("src/ugens/distortion.js");
loader.require("src/ugens/dynamics.js");
loader.require("src/ugens/envelopes.js");
loader.require("src/ugens/filters.js");
loader.require("src/ugens/gates.js");
loader.require("src/ugens/granular.js");
loader.require("src/ugens/listening.js");
loader.require("src/ugens/math.js");
loader.require("src/ugens/midi.js");
loader.require("src/ugens/multichannel.js");
loader.require("src/ugens/oscillators.js");
loader.require("src/ugens/random.js");
loader.require("src/ugens/scheduling.js");
loader.require("src/ugens/triggers.js");

loader.require("src/nodejs/audio-system.js");
loader.require("src/nodejs/output-manager.js");
loader.require("src/nodejs/buffer-writer.js");
loader.require("src/nodejs/midi.js");

module.exports = flock;
