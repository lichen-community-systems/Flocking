/*global require, module, __dirname*/

var fluid = require("infusion"),
    flock = fluid.registerNamespace("flock"),
    loader = fluid.getLoader(__dirname); // jshint ignore:line

loader.require("../flocking/flocking-core.js");
loader.require("../flocking/flocking-buffers.js");
loader.require("../flocking/flocking-audiofile.js");
loader.require("../flocking/flocking-audiofile-compatibility.js");
loader.require("../flocking/flocking-scheduler.js");
loader.require("../flocking/flocking-webmidi.js");
loader.require("./lib/flocking-node.js");
loader.require("../flocking/flocking-parser.js");
loader.require("../flocking/flocking-ugens.js");
loader.require("../flocking/flocking-envelopes.js");

module.exports = flock;
