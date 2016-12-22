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
    flock = fluid.registerNamespace("flock");

// Flocking core
require("./src/core.js");
require("./src/node-list.js");
require("./src/evaluators.js");
require("./src/synths/model.js");
require("./src/synths/group.js");
require("./src/synths/polyphonic.js");
require("./src/synths/band.js");
require("./src/buffers.js");
require("./src/parser.js");
require("./src/audiofile.js");
require("./src/flocking-audiofile-converters.js");
require("./src/audiofile-encoder.js");
require("./src/flocking-audiofile-compatibility.js");
require("./src/scheduler.js");
require("./src/web/midi.js");
require("./src/midi/controller.js");

// Unit generators
require("./src/ugens/core.js");
require("./src/ugens/bandlimited.js");
require("./src/ugens/buffer.js");
require("./src/ugens/debugging.js");
require("./src/ugens/distortion.js");
require("./src/ugens/dynamics.js");
require("./src/ugens/envelopes.js");
require("./src/ugens/filters.js");
require("./src/ugens/gates.js");
require("./src/ugens/granular.js");
require("./src/ugens/listening.js");
require("./src/ugens/math.js");
require("./src/ugens/midi.js");
require("./src/ugens/multichannel.js");
require("./src/ugens/oscillators.js");
require("./src/ugens/random.js");
require("./src/ugens/scheduling.js");
require("./src/ugens/triggers.js");

// Node.js-specific modules.
require("./src/nodejs/audio-system.js");
require("./src/nodejs/output-manager.js");
require("./src/nodejs/buffer-writer.js");
require("./src/nodejs/midi.js");

module.exports = flock;
