/*
 * Flocking Playground
 *   Copyright 2014-2015, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    // TODO: Declarativize.
    flock.init();

    /**************
     * Playground *
     **************/

    fluid.defaults("flock.playground", {
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],

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
                    listeners: {
                        onParseError: "flock.fail({arguments}.0)",
                        onEvaluationError: "flock.fail({arguments}.0)"
                    }
                }
            },

            demoSelector: {
                type: "flock.playground.demoSelector",
                container: "{that}.dom.demoSelector",
                options: {
                    listeners: {
                        afterDemoLoaded: "{editor}.setContent({arguments}.0)",

                        onSelect: [
                            "{playButton}.pause()"
                        ]
                    }
                }
            },

            playButton: {
                type: "flock.ui.enviroPlayButton",
                container: "{that}.dom.playButton",
                options: {
                    listeners: {
                        onPause: [
                            "{evaluator}.clearPlayable()",
                            "{enviro}.reset"
                        ]
                    }
                }
            }
        },

        events: {
            onSourceUpdated: null,
            onEvaluateDemo: "{playButton}.events.onPlay"
        },

        listeners: {
            onCreate: [
                {
                    funcName: "{demoSelector}.loadDemoFromURL"
                }
            ],

            onEvaluateDemo: [
                "flock.playground.parseSource({editor}, {evaluator})",
                "{evaluator}.evaluate()"
            ]
        },

        selectors: {
            editor: "#source-view",
            playButton: "#playButton",
            demoSelector: "#demos"
        }
    });

    flock.playground.parseSource = function (editor, evaluator) {
        var source = editor.getSource();
        evaluator.parse(source);
    };
}());
