/*
* Flocking Testing Components
* https://github.com/continuing-creativity/flocking
*
* Copyright 2013-2020, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*jshint browser:true*/
/*global fluid*/

var flock = fluid.registerNamespace("flock"),
    QUnit = fluid.registerNamespace("QUnit");

(function () {
    "use strict";

    fluid.defaults("flock.test.module", {
        gradeNames: "fluid.component",

        name: "Unnamed module",

        distributeOptions: {
            "enviroOptions": {
                source: "{that}.options.enviroOptions",
                target: "{that environment}.options"
            }
        },

        environmentOptions: {},

        components: {
            environment: {
                createOnEvent: "onSetup",
                type: "flock.silentEnviro",
                options: {
                    events: {
                        onCreate: "{module}.events.afterEnvironmentCreated",
                        onDestroy: "{module}.events.onTeardown"
                    }
                }
            }
        },

        events: {
            onSetup: null,
            afterEnvironmentCreated: null,
            onTeardown: null
        },

        listeners: {
            "onCreate.registerModule": {
                priority: "first",
                funcName: "flock.test.module.register",
                args: "{that}"
            }
        }
    });

    flock.test.module.register = function (that) {
        QUnit.module(that.options.name, {
            setup: that.events.onSetup.fire,
            teardown: that.events.onTeardown.fire
        });
    };

    // TODO: The flock.test.module grades should be flipped so that
    // the one containing an environment is additive on the
    // base module grade (and all the tests updated accordingly).
    fluid.defaults("flock.test.module.noEnvironment", {
        gradeNames: "flock.test.module",

        components: {
            environment: {
                type: "fluid.component"
            }
        }
    });

    fluid.defaults("flock.test.module.runOnCreate", {
        gradeNames: "flock.test.module",

        invokers: {
            run: "fluid.notImplemented()"
        },

        listeners: {
            "onCreate.runTests": "{that}.run()"
        }
    });


    fluid.defaults("flock.test.testEnvironment", {
        gradeNames: "fluid.test.testEnvironment",

        audioSystemOptions: {},

        components: {
            environment: {
                type: "flock.silentEnviro",
                options: {
                    components: {
                        audioSystem: {
                            options: {
                                model: "{testEnvironment}.options.audioSystemOptions"
                            }
                        }
                    }
                }
            }
        }
    });
}());
