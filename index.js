var fluid = require("infusion"),
    flock = fluid.registerNamespace("flock"),
    loader = fluid.getLoader(__dirname);

loader.require("./flocking/third-party/polydataview/js/polydataview.js");
loader.require("./flocking/flocking/flocking-core.js");
loader.require("./flocking/flocking/flocking-audiofile.js");
loader.require("./flocking/flocking/flocking-scheduler.js");
loader.require("./flocking-node.js");
loader.require("./flocking/flocking/flocking-parser.js");
loader.require("./flocking/flocking/flocking-ugens.js");

module.exports = flock;
