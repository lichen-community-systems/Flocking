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
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],

        flockingSettings: {},

        model: {
            activeSynth: {},
            isDeclarative: false
        },

        components: {
            demos: {
                type: "flock.playground.demos"
            },

            editor: {
                type: "flock.ui.codeMirror",
                container: "{that}.dom.editor",
                options: {
                    listeners: {
                        onValidatedContentChange: [
                            "{playground}.events.onSourceUpdated.fire()"
                        ]
                    }
                }
            },

            demoSelector: {
                type: "flock.playground.demoSelector",
                container: "{that}.dom.demoSelector",
                options: {
                    listeners: {
                        afterDemoLoaded: [
                            {
                                func: "{editor}.setContent",
                                args: ["{arguments}.0"]
                            },
                            {
                                func: "{playground}.events.onSourceUpdated.fire"
                            }

                        ],

                        onSelect: [
                            {
                                func: "{playButton}.pause"
                            },
                            {
                                func: "{playground}.events.onSourceUpdated.fire"
                            }
                        ]
                    }
                }
            },

            playButton: {
                type: "flock.ui.enviroPlayButton",
                container: "{that}.dom.playButton"
            }
        },

        invokers: {
            detectSourceType: {
                funcName: "flock.playground.detectSourceType",
                args: ["{editor}", "{that}.applier"],
                dynamic: true
            },

            evaluateSource: {
                funcName: "flock.playground.evaluateSource",
                args: ["{arguments}.0", "{editor}", "{that}.applier"],
                dynamic: true
            }
        },

        events: {
            onEvaluateDemo: "{playButton}.events.onPlay",
            onSourceUpdated: null
        },

        listeners: {
            onCreate: [
                {
                    funcName: "{demoSelector}.loadDemoFromURL"
                }
            ],

            onEvaluateDemo: [
                {
                    func: "{that}.detectSourceType"
                },
                {
                    func: "{that}.evaluateSource",
                    args: "{that}.model.isDeclarative"
                },
                {
                    funcName: "flock.playground.synthForActiveSynthSpec",
                    args: ["{that}", "{that}.model.activeSynthSpec"]
                }
            ],

            onSourceUpdated: [
                {
                    func: "{playground}.detectSourceType"
                },
                {
                    func: "{playground}.evaluateSource",
                    args: "{playground}.model.isDeclarative"
                }
            ]
        },

        selectors: {
            editor: "#source-view",
            playButton: "#playButton",
            demoSelector: "#demos"
        }
    });

    // TODO: Better JSON detection.
    // CodeMirror's JavaScript and JSON modes are the same,
    // so we have to detect declarative synths by brute force.
    flock.playground.detectSourceType = function (editor, applier) {
        if (!editor.editor || !editor.editor.getDoc()) {
            return;
        }

        var source = editor.getContent();

        if (source.length < 1) {
            return;
        }

        var trimmed = source.trim(),
            first = trimmed[0],
            last = trimmed[trimmed.length - 1],
            isJSON = (first === "[" && last === "]") || (first === "{" && last === "}");

        applier.change("activeSynthSpec", null);
        applier.change("isDeclarative", isJSON);
    };

    flock.playground.evaluateSource = function (isJSON, editor, applier) {
        if (!editor.editor || !editor.editor.getDoc()) {
            return;
        }

        var source = editor.getContent(),
            fn = isJSON ? flock.playground.parseJSON : flock.playground.evaluateCode;

        fn(source, applier);
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
