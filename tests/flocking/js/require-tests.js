/*global require, module, asyncTest, ok, start*/

(function () {
    "use strict";

    module("Require.js AMD tests");

    asyncTest("flock variable is defined and populated", function () {
        require(["../../../dist/flocking-all.min"], function (flock) {
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

}());
