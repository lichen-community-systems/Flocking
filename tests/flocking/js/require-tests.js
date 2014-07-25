/*global flock, require, module, test, asyncTest, ok, equal, start*/

(function () {
    "use strict";

    var flockingBuildPath = "../../../dist/flocking-all.min";

    module("Require.js AMD tests");

    asyncTest("Flocking is defined and populated using the AMD style", function () {
        require([flockingBuildPath], function (flock) {
            ok(flock, "The 'flock' variable should be defined");

            flock.init();
            ok(flock.enviro.shared, "The shared environment can successfully be initialized.");

            var synth = flock.synth({
                synthDef: {
                    ugen: "flock.ugen.impulse"
                }
            });

            ok(synth, "A synth can be correct instantiated.");

            start();
        });
    });

    test("Flocking is returned synchronously when using a CommonJS-style require.", function () {
        var myFlock = require("../../../dist/flocking-all.min");
        ok(myFlock);
        equal(myFlock, flock,
            "The value returned from a call to require() is the same instance as the browser global.");
    });

}());
