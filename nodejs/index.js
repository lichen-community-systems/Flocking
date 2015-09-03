/*global require, module, __dirname*/

var fluid = require("infusion"),
    flock = fluid.registerNamespace("flock"),
    loader = fluid.getLoader(__dirname); // jshint ignore:line

loader.require("../flocking/flocking-core.js");
loader.require("../flocking/flocking-buffers.js");
loader.require("../flocking/flocking-parser.js");
loader.require("../flocking/flocking-audiofile.js");
loader.require("../flocking/flocking-audiofile-encoder.js");
loader.require("../flocking/flocking-audiofile-compatibility.js");
loader.require("../flocking/flocking-scheduler.js");
loader.require("../flocking/web/midi.js");

// Unit generators
loader.require("../flocking/ugens/core.js");
loader.require("../flocking/ugens/bandlimited.js");
loader.require("../flocking/ugens/browser.js");
loader.require("../flocking/ugens/buffer.js");
loader.require("../flocking/ugens/debugging.js");
loader.require("../flocking/ugens/distortion.js");
loader.require("../flocking/ugens/dynamics.js");
loader.require("../flocking/ugens/envelopes.js");
loader.require("../flocking/ugens/filters.js");
loader.require("../flocking/ugens/gates.js");
loader.require("../flocking/ugens/granular.js");
loader.require("../flocking/ugens/listening.js");
loader.require("../flocking/ugens/math.js");
loader.require("../flocking/ugens/midi.js");
loader.require("../flocking/ugens/multichannel.js");
loader.require("../flocking/ugens/oscillators.js");
loader.require("../flocking/ugens/random.js");
loader.require("../flocking/ugens/scheduling.js");
loader.require("../flocking/ugens/triggers.js");

loader.require("./lib/flocking-node.js");

module.exports = flock;
