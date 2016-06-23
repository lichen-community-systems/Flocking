/*
 * Flocking IoC Integration Tests
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2015, Colin Clark
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    QUnit.test("Destroying a synth with an IoC-configured Environment", function () {
        QUnit.expect(3);
        fluid.defaults("flock.test.synthAndEnviroParent", {
            gradeNames: "fluid.component",

            components: {
                enviro: {
                    type: "flock.silentEnviro"
                },

                synth: {
                    type: "flock.synth",
                    options: {
                        synthDef: {
                            ugen: "flock.ugen.sinOsc"
                        }
                    }
                }
            }
        });

        var parent = flock.test.synthAndEnviroParent();

        try {
            parent.destroy();
            QUnit.equal(parent.synth.lifecycleStatus, "destroyed",
                "The synth was successfully destroyed.");

            QUnit.equal(parent.enviro.lifecycleStatus, "destroyed",
                "The enviro was successfully destroyed.");

            QUnit.equal(parent.lifecycleStatus, "destroyed",
                "The parent component was successfully destroyed.");
        } catch (e) {
            QUnit.ok(false, "An exception was thrown while attempting to destroy a parent component containing " +
                "both an enviro and a synth.");
        }
    });
}());
