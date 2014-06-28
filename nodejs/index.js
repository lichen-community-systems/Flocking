var fluid = require("infusion"),
    flock = fluid.registerNamespace("flock"),
    loader = fluid.getLoader(__dirname);

loader.require("../flocking/flocking-core.js");
loader.require("../flocking/flocking-buffers.js");
loader.require("../flocking/flocking-audiofile.js");
loader.require("../flocking/flocking-scheduler.js");
loader.require("./lib/flocking-node.js");
loader.require("../flocking/flocking-parser.js");
loader.require("../flocking/flocking-ugens.js");

module.exports = flock;
