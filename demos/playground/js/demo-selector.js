/*
 * Flocking Playground
 *   Copyright 2014-2015, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, window*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    /*****************
     * Demo Selector *
     *****************/

    fluid.defaults("flock.playground.demoSelector", {
        gradeNames: ["fluid.viewComponent"],

        components: {
            selectBox: {
                type: "flock.ui.selectBox",
                container: "{that}.container",
                options: {
                    model: "{demos}.model"
                }
            }
        },

        demoDefaults: {
            pathPrefix: "demos/",
            id: "sine",
            fileExt: "js"
        },

        invokers: {
            loadDemo: {
                funcName: "flock.playground.demoSelector.load",
                args: [
                    "{arguments}.0",
                    "{that}.options.demoDefaults",
                    "{that}.events.afterDemoLoaded.fire"
                ]
            },

            loadDemoFromURL: {
                funcName: "flock.playground.demoSelector.loadDemoFromURLHash",
                args: ["{that}.container", "{selectBox}", "{that}.loadDemo"]
            },

            updateURL: {
                funcName: "flock.playground.demoSelector.updateURLHash",
                args: ["{arguments}.0.id"]
            }
        },

        events: {
            onSelect: "{selectBox}.events.onSelect",    // Fires when the user selects a demo.
            onURLHashChange: null,
            afterDemoLoaded: null
        },

        listeners: {
            onCreate: {
                funcName: "flock.playground.demoSelector.listenForHashChanges",
                args: ["{that}.events.onURLHashChange.fire"]
            },

            onURLHashChange: {
                func: "{that}.loadDemoFromURL"
            },

            onSelect: [
                {
                    funcName: "{that}.updateURL",
                    args: ["{arguments}.0"]
                },
                {
                    funcName: "{that}.loadDemo",
                    args: ["{arguments}.0"]
                }
            ]
        }
    });

    flock.playground.demoSelector.listenForHashChanges = function (onURLHashChange) {
        $(window).bind("hashchange", onURLHashChange);
    };

    flock.playground.demoSelector.updateURLHash = function (id) {
        if (id) {
            window.location.hash = "#" + id;
        }
    };

    flock.playground.demoSelector.loadDemoFromURLHash = function (container, selectBox) {
        var hash = window.location.hash,
            id = hash ? hash.slice(1) : selectBox.model.defaultOption;

        selectBox.select(id);
    };

    flock.playground.demoSelector.load = function (demo, demoDefaults, afterDemoLoaded) {
        demo = demo || {
            id: demoDefaults.id
        };

        var fileExt = demo.fileExt || demoDefaults.fileExt,
            url = demo.url || (demoDefaults.pathPrefix + demo.id + "." + fileExt);

        $.ajax({
            type: "get",
            url: url,
            dataType: "text",
            success: afterDemoLoaded,
            error: function (xhr, textStatus, errorThrown) {
                throw new Error(textStatus + " while loading " + url + ": " + errorThrown);
            }
        });
    };
}());
