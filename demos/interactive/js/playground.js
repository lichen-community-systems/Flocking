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
                args: ["@expand:{editor}.getContent()", "{that}.applier"],
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

            onEvaluateDemo: [
                {
                    func: "{that}.evaluateSource"
                },
                {
                    funcName: "flock.playground.synthForActiveSynthSpec",
                    args: ["{that}", "{that}.model.activeSynthSpec"]
                }
            ]
        },

        selectors: {
            editor: "#source-view",
            playButton: "#playButton",
            demoSelector: "#demos"
        }
    });

    flock.playground.evaluateSource = function (source, applier) {
        if (source.length < 1) {
            return;
        }

        var trimmed = source.trim(),
            first = trimmed[0],
            last = trimmed[trimmed.length - 1];

        applier.change("activeSynthSpec", null);

        // TODO: Better JSON detection.
        // CodeMirror's JavaScript and JSON modes are the same,
        // so we have to detect declarative synths by brute force.
        if ((first === "[" && last === "]") || (first === "{" && last === "}")) {
            return flock.playground.parseJSON(source, applier);
        } else {
            return flock.playground.evaluateCode(source);
        }
    };

    flock.playground.parseJSON = function (source, applier) {
        var synthSpec = JSON.parse(source);
        applier.change("activeSynthSpec", synthSpec);
    };

    flock.playground.evaluateCode = function (source) {
        eval(source); // jshint ignore: line
    };

    // TODO: This synth needs to be a dynamic component!
    flock.playground.synthForActiveSynthSpec = function (that, activeSynthSpec) {
        if (that.synth) {
            that.synth.pause();
        }

        if (activeSynthSpec) {
            that.synth = flock.synth(activeSynthSpec);
            return that.synth;
        }
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
                container: "{that}.dom.synthSelector",
                options: {
                    selfRender: true
                }
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
            synthSelector: ".synthSelector"
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
