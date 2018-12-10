/*
 * Flocking Playground
 *   Copyright 2014-2018, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    // TODO: Declarativize.
    flock.init({
        chans: flock.ALL_CHANNELS
    });
    flock.debug.failHard = false;

    /**************
     * Playground *
     **************/

    fluid.defaults("flock.playground", {
        gradeNames: ["fluid.viewComponent"],

        model: {
            activeSynthSpec: {},
            isDeclarative: false
        },

        components: {
            enviro: "{environment}",

            demos: {
                type: "flock.playground.demos"
            },

            editor: {
                type: "flock.ui.codeMirror",
                container: "{that}.dom.editor",
                options: {
                    mode: "text/javascript"
                }
            },

            evaluator: {
                type: "flock.sourceEvaluator.code",
                options: {
                    events: {
                        onParseError: "{playground}.events.onError",
                        onEvaluationError: "{playground}.events.onError"
                    }
                }
            },

            errorConsole: {
                type: "flock.playground.errorConsole",
                container: "{that}.dom.errorConsole"
            },

            demoSelector: {
                type: "flock.playground.demoSelector",
                container: "{that}.dom.demoSelector",
                options: {
                    components: {
                        selectBox: {
                            options: {
                                // TODO: This is hack to work around issues
                                // in recent Infusions
                                // (after 3.0.0-dev.20171121T212609Z.9b4fde781)
                                // where a simpler "{demos}.model" distribution
                                // fails.
                                // The "potentia II" branch fixes this,
                                // but exposes other issues in Flocking.
                                model: {
                                    groups: "{demos}.model.groups",
                                    defaultOption: "{demos}.model.groups"
                                }
                            }
                        }
                    },

                    listeners: {
                        "afterDemoLoaded.setEditorContent": {
                            func: "{editor}.setContent",
                            args: ["{arguments}.0"],
                        },

                        "onSelect.pause": {
                            func: "{playButton}.pause"
                        }
                    }
                }
            },

            playButton: {
                type: "flock.ui.resetEnviroPlayButton",
                container: "{that}.dom.playButton"
            }
        },

        invokers: {
            parse: "flock.playground.parseSource({editor}, {evaluator})"
        },

        events: {
            onSourceUpdated: null,
            onEvaluateDemo: "{playButton}.events.onPlay",
            onError: null
        },

        listeners: {
            "onCreate.loadDemo": "{demoSelector}.loadDemoFromURL()",

            "onError.fail": "flock.fail({arguments}.0)"
        },

        selectors: {
            editor: "#source-view",
            playButton: "#playButton",
            demoSelector: "#demos",
            errorConsole: "#error-console"
        }
    });

    flock.playground.parseSource = function (editor, evaluator) {
        var source = editor.getSource();
        evaluator.parse(source);
    };

    fluid.defaults("flock.playground.code", {
        gradeNames: ["flock.playground"],

        listeners: {
            "onEvaluateDemo.parse": "{that}.parse()",

            "onEvaluateDemo.evaluate": {
                priority: "after:parse",
                func: "{evaluator}.evaluate"
            }
        }
    });
}());
