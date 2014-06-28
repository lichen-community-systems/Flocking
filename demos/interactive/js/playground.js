/*
 * Flocking Playground
 *   Copyright 2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, window*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    // TODO: Declarativize.
    flock.init();

    /**************
     * Playground *
     **************/

    fluid.defaults("flock.playground", {
        gradeNames: ["fluid.viewComponent", "autoInit"],

        flockingSettings: {},

        model: {
            activeSynth: {}
        },

        components: {
            demos: {
                type: "flock.playground.demos"
            },

            editor: {
                type: "flock.ui.codeEditor.cm",
                container: "{that}.dom.editor",
                options: {
                    listeners: {
                        afterContentReplaced: {
                            func: "{playground}.evaluateSource"
                        }
                    }
                }
            },

            demoSelector: {
                type: "flock.playground.demoSelector",
                container: "{that}.dom.demoSelector",
                options: {
                    listeners: {
                        afterDemoLoaded: {
                            func: "{editor}.setContent",
                            args: ["{arguments}.0"]
                        },

                        onSelect: {
                            func: "{playButton}.pause"
                        }
                    }
                }
            },

            playButton: {
                type: "flock.ui.enviroPlayButton",
                container: "{that}.dom.playButton"
            }
        },

        invokers: {
            evaluateSource: {
                funcName: "flock.playground.evaluateSource",
                args: ["{that}.applier", "@expand:{editor}.getContent()"],
                dynamic: true
            }
        },

        events: {
            onEvaluateDemo: "{playButton}.events.onPlay"
        },

        listeners: {
            onCreate: [
                {
                    funcName: "{demoSelector}.loadDemoFromURL"
                }
            ],

            onEvaluateDemo: {
                funcName: "flock.playground.synthForActiveSynthSpec",
                args: "{that}.model.activeSynthSpec"
            }
        },

        selectors: {
            editor: "#source-view",
            playButton: "#playButton",
            demoSelector: "#demos"
        }
    });

    flock.playground.evaluateSource = function (applier, source) {
        var synthSpec = JSON.parse(source);

        applier.change("activeSynthSpec", null);
        applier.change("activeSynthSpec", synthSpec);
    };

    // TODO: This synth needs to be a dynamic component!
    flock.playground.synthForActiveSynthSpec = function (activeSynthSpec) {
        return flock.synth(activeSynthSpec);
    };

    fluid.defaults("flock.playground.editorModeToggle", {
        gradeNames: ["flock.ui.toggleButton", "autoInit"],

        model: {
            isEnabled: true
        },

        listeners: {
            onEnabled: [
                {
                    "this": "{playground}.dom.editor",
                    method: "hide"
                },
                {
                    "this": "{playground}.dom.visual",
                    method: "show"
                },
                {
                    func: "{visualView}.synthDefRenderer.refreshView"
                }
            ],

            onDisabled: [
                {
                    "this": "{playground}.dom.visual",
                    method: "hide"
                },
                {
                    "this": "{playground}.dom.editor",
                    method: "show"
                }
            ]
        },

        strings: {
            enabled: "Source",
            disabled: "Graph"
        }
    });


    fluid.defaults("flock.playground.visual", {
        gradeNames: ["flock.playground", "autoInit"],

        components: {
            viewToggleButton: {
                type: "flock.playground.editorModeToggle",
                container: "{that}.dom.viewToggler"
            },

            visualView: {
                type: "flock.playground.visualView",
                container: "#visual-view",
                options: {
                    model: "{playground}.model.activeSynthSpec"
                }
            }
        },

        selectors: {
            visual: "#visual-view",
            viewToggler: "#viewButton"
        },

        modelListeners: {
            "activeSynthSpec": {
                func: "{visualView}.synthDefRenderer.refreshView",
                args: "{change}.value"
            }
        }
    });

    /*****************
     * Demo Selector *
     *****************/

    fluid.defaults("flock.playground.demoSelector", {
        gradeNames: ["fluid.viewComponent", "autoInit"],

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
            pathPrefix: "../demos/",
            id: "sine",
            fileExt: "json"
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
            afterDemoLoaded: null                       // Fires after a demo file has been loaded.
        },

        listeners: {
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

        var url = demo.url || (demoDefaults.pathPrefix + demo.id + "." + demoDefaults.fileExt);

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
