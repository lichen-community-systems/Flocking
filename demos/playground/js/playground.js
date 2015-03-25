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

        flockingSettings: {},

        defaultComponentType: "flock.band",

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
                    mode: "text/javascript",
                    listeners: {
                        onValidChange: "{playground}.events.onSourceUpdated.fire()"
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
                            }

                        ],

                        onSelect: [
                            {
                                func: "{playButton}.pause"
                            }
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
                            "{playground}.clearPlayableComponent()",
                            "{enviro}.reset"
                        ]
                    }
                }
            }
        },

        invokers: {
            makePlayableComponent: {
                funcName: "flock.playground.makePlayableComponent",
                args: [
                    "{that}",
                    "{arguments}.0", // A component definition.
                    "{that}.options.defaultComponentType"
                ]
            },

            clearPlayableComponent: {
                funcName: "flock.playground.clearPlayableComponent",
                args: ["{that}"]
            },

            detectSourceType: {
                funcName: "flock.playground.detectSourceType",
                args: ["{editor}", "{that}.applier"],
                dynamic: true
            },

            evaluateSource: {
                funcName: "flock.playground.evaluateSource",
                args: ["{arguments}.0", "{editor}", "{that}.applier"]
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
                    func: "{that}.makePlayableComponent",
                    args: ["{that}.model.componentDef"]
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
        var componentDef = JSON.parse(source),
            synthSpec = flock.playground.findFirstSynthSpec(componentDef);

        applier.change("componentDef", null);
        applier.change("componentDef", componentDef);

        applier.change("activeSynthSpec", null);
        applier.change("activeSynthSpec", synthSpec);
    };

    flock.playground.matchSynthSpec = function (o) {
        return o && o.synthDef ? o : undefined;
    };

    flock.playground.findInArray = function (arr, fn) {
        var ret,
            match;

        for (var i = 0; i < arr.length; i++) {
            ret = fn(arr[i], i);
            if (ret) {
                return ret;
            } else {
                match = flock.playground.findRecursive(arr[i], fn);
                if (match) {
                    return match;
                }
            }
        }
    };

    flock.playground.findInObject = function (o, fn) {
        var ret,
            match;

        for (var key in o) {
            ret = fn(o[key], key);
            if (ret) {
                return ret;
            } else {
                match = flock.playground.findRecursive(o[key], fn);
                if (match) {
                    return match;
                }
            }
        }
    };

    flock.playground.findRecursive = function (o, fn) {
        if (fluid.isPrimitive(o)) {
            return fn(o);
        }

        var findFn = flock.isIterable(o) ? flock.playground.findInArray :
            flock.playground.findInObject;

        return findFn(o, fn);
    };

    flock.playground.findFirstSynthSpec = function (componentDef) {
        return flock.playground.matchSynthSpec(componentDef) ? componentDef :
            flock.playground.findRecursive(componentDef, flock.playground.matchSynthSpec);
    };

    flock.playground.evaluateCode = function (source) {
        eval(source); // jshint ignore: line
    };

    flock.playground.makePlayableComponent = function (that, componentDef, defaultType) {
        if (!componentDef || !that.model.isDeclarative) {
            return;
        }

        var type = componentDef.synthDef ? "flock.synth" : componentDef.type || defaultType,
            options = componentDef.options || componentDef;

        flock.playground.clearPlayableComponent(that);

        if (options) {
            that.playable = fluid.invokeGlobalFunction(type, [options]);
        }

        return that.playable;
    };

    flock.playground.clearPlayableComponent = function (that) {
        var current = that.playable;
        if (current) {
            current.destroy();
            that.playable = undefined;
        }
    };

}());
