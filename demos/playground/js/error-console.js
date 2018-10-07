/*
 * Flocking Playground Error Console
 *   Copyright 2018, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.defaults("flock.playground.errorConsole", {
        gradeNames: "fluid.viewComponent",

        invokers: {
            clearErrors: {
                "this": "{that}.container",
                method: "empty"
            }
        },

        events: {
            onEvaluationError: "{sourceEvaluator}.events.onEvaluationError",
            afterEvaluated: "{sourceEvaluator}.events.afterEvaluated"
        },

        listeners: {
            "afterEvaluated.clearErrors": "{that}.clearErrors()",

            "onEvaluationError.clearErrors": "{that}.clearErrors()",

            "onEvaluationError.renderError": {
                priority: "after:clearErrors",
                funcName: "flock.playground.errorConsole.renderError",
                args: ["{arguments}.0", "{that}"]
            }
        },

        markup: {
            err: "<span class='error-type'>%name</span>: <span class='error-message'>%message</span>"
        }
    });

    flock.playground.errorConsole.renderError = function (e, that) {
        var renderedHTML = fluid.stringTemplate(that.options.markup.err, {
            name: e.name,
            message: e.message
        });
        that.container.append(renderedHTML);
    };
}());
