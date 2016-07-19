/*!
* Flocking Module Require Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2013-16, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, QUnit*/

(function () {
    "use strict";

    // Simulate a full-on require environment.
    window.module = {
        exports: {}
    };

    require.config({
        paths: {
            jquery: "../../../node_modules/jquery/dist/jquery"
        }
    });

    var flockingBuildPath = "../../../dist/flocking-no-jquery";

    QUnit.module("Require.js AMD tests");

    QUnit.asyncTest("Flocking is defined and populated using the AMD style", function () {
        require([flockingBuildPath], function (flock) {
            QUnit.ok(flock, "The 'flock' variable should be defined");

            var environment = flock.init();
            QUnit.ok(environment, "The shared environment can successfully be initialized.");

            var synth = flock.synth({
                synthDef: {
                    ugen: "flock.ugen.impulse"
                }
            });

            QUnit.ok(synth, "A synth can be correct instantiated.");

            environment.play();
            environment.stop();

            QUnit.start();
        });
    });

}());
