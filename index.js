var fluid = require("infusion"),
    loader = fluid.getLoader(__dirname);

fluid.setLogging(true);

loader.require("./flocking/flocking/flocking-core.js");
loader.require("./flocking-node.js");
loader.require("./flocking/flocking/flocking-parser.js");
loader.require("./flocking/flocking/flocking-ugens.js");

loader.require("./tests/test-synth.js")

var flock = fluid.registerNamespace("flock");
var synth = flock.demo.nodeTest();
synth.play();

setTimeout(function () {
    // Wait 25 seconds before Node exits.
}, 25000);
