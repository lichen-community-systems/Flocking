/*global require, module, __dirname*/

var fluid = require("infusion"),
    flock = fluid.registerNamespace("flock"),
    loader = fluid.getLoader(__dirname); // jshint ignore:line

loader.require("../src/core.js");
loader.require("../src/buffers.js");
loader.require("../src/parser.js");
loader.require("../src/audiofile.js");
loader.require("../src/audiofile-encoder.js");
loader.require("../src/flocking-audiofile-compatibility.js");
loader.require("../src/scheduler.js");
loader.require("../src/web/midi.js");

// Unit generators
loader.require("../src/ugens/core.js");
loader.require("../src/ugens/bandlimited.js");
loader.require("../src/ugens/browser.js");
loader.require("../src/ugens/buffer.js");
loader.require("../src/ugens/debugging.js");
loader.require("../src/ugens/distortion.js");
loader.require("../src/ugens/dynamics.js");
loader.require("../src/ugens/envelopes.js");
loader.require("../src/ugens/filters.js");
loader.require("../src/ugens/gates.js");
loader.require("../src/ugens/granular.js");
loader.require("../src/ugens/listening.js");
loader.require("../src/ugens/math.js");
loader.require("../src/ugens/midi.js");
loader.require("../src/ugens/multichannel.js");
loader.require("../src/ugens/oscillators.js");
loader.require("../src/ugens/random.js");
loader.require("../src/ugens/scheduling.js");
loader.require("../src/ugens/triggers.js");

loader.require("./lib/flocking-node.js");

module.exports = flock;
