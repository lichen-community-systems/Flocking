/*global require, QUnit*/

(function () {
    "use strict";

    // Simulate a full-on require environment.
    window.module = {
        exports: {}
    };

    require.config({
        paths: {
            jquery: "../../../third-party/jquery/js/jquery"
        }
    });

    var flockingBuildPath = "../../../dist/flocking-no-jquery";

    QUnit.module("Require.js AMD tests");

    QUnit.asyncTest("Flocking is defined and populated using the AMD style", function () {
        require([flockingBuildPath], function (flock) {
            QUnit.ok(flock, "The 'flock' variable should be defined");

            flock.init();
            QUnit.ok(flock.enviro.shared, "The shared environment can successfully be initialized.");

            var synth = flock.synth({
                synthDef: {
                    ugen: "flock.ugen.impulse"
                }
            });

            QUnit.ok(synth, "A synth can be correct instantiated.");

            flock.enviro.shared.play();
            flock.enviro.shared.stop();

            QUnit.start();
        });
    });

}());
