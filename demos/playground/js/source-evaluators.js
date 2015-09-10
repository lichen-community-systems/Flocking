/*
 * Flocking Playground Source Evaluators
 *   Copyright 2014-2015, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    /*************
     * Utilities *
     *************/

    flock.findInArray = function (arr, fn) {
        var ret,
            match;

        for (var i = 0; i < arr.length; i++) {
            ret = fn(arr[i], i);
            if (ret) {
                return ret;
            } else {
                match = flock.findRecursive(arr[i], fn);
                if (match) {
                    return match;
                }
            }
        }
    };

    flock.findInObject = function (o, fn) {
        var ret,
            match;

        for (var key in o) {
            ret = fn(o[key], key);
            if (ret) {
                return ret;
            } else {
                match = flock.findRecursive(o[key], fn);
                if (match) {
                    return match;
                }
            }
        }
    };

    flock.findRecursive = function (o, fn) {
        if (fluid.isPrimitive(o)) {
            return fn(o);
        }

        var findFn = flock.isIterable(o) ? flock.findInArray :
            flock.findInObject;

        return findFn(o, fn);
    };


    /******************************
     * SourceEvaluator Base Grade *
     ******************************/

    fluid.defaults("flock.sourceEvaluator", {
        gradeNames: ["fluid.modelComponent"],

        members: {
            // TODO: Where should this be located, given that
            // it's actually a dynamically-instantiated component?
            playable: null
        },

        invokers: {
            clearPlayable: "flock.sourceEvaluator.clearPlayable({that})"
        },

        events: {
            onParseError: null,
            afterEvaluated: null,
            onEvaluationError: null
        }
    });

    flock.sourceEvaluator.clearPlayable = function (that) {
        var current = that.playable;
        if (current) {
            current.destroy();
            that.playable = null;
        }
    };


    /******************
     * JSON Evaluator *
     ******************/

    fluid.defaults("flock.sourceEvaluator.json", {
        gradeNames: ["flock.sourceEvaluator"],

        defaultComponentType: "flock.band",

        model: {
            parsed: {},
            activeSynthSpec: {}
        },

        invokers: {
            parse: {
                funcName: "flock.sourceEvaluator.json.parse",
                args: [
                    "{arguments}.0",
                    "{that}.applier",
                    "{that}.events.onParseError.fire"
                ]
            },
            evaluate: "flock.sourceEvaluator.json.evaluate({that})"
        },

        modelListeners: {
            parsed: {
                funcName: "flock.sourceEvaluator.json.updateActiveSynthSpec",
                args: ["{change}.value", "{that}.applier"]
            }
        }
    });

    flock.sourceEvaluator.json.tryParse = function (source, onParseError) {
        try {
            return JSON.parse(source);
        } catch (e) {
            onParseError(e, source);
        }
    };

    flock.sourceEvaluator.json.parse = function (source, applier, onParseError) {
        var parsed = flock.sourceEvaluator.json.tryParse(source, onParseError);
        if (!parsed) {
            return;
        }

        applier.change("parsed", null);
        applier.change("parsed", parsed);
    };

    flock.sourceEvaluator.json.updateActiveSynthSpec = function (parsed, applier) {
        var activeSynthSpec = flock.sourceEvaluator.json.findFirstSynthSpec(parsed);

        if (activeSynthSpec) {
            applier.change("activeSynthSpec", null);
            applier.change("activeSynthSpec", activeSynthSpec);
        }
    };

    flock.sourceEvaluator.json.matchSynthSpec = function (o) {
        return o && o.synthDef ? o : undefined;
    };

    flock.sourceEvaluator.json.findFirstSynthSpec = function (parsed) {
        var matcher = flock.sourceEvaluator.json.matchSynthSpec;
        return matcher(parsed) ? parsed : flock.findRecursive(parsed, matcher);
    };

    flock.sourceEvaluator.json.tryMakePlayable = function (type, options, onEvaluationError) {
        try {
            return fluid.invokeGlobalFunction(type, [options]);
        } catch (e) {
            onEvaluationError(e, type, options);
        }
    };

    flock.sourceEvaluator.json.evaluate = function (that) {
        var parsed = that.model.parsed;

        if (!parsed) {
            return;
        }

        var type = parsed.synthDef ? "flock.synth" : parsed.type || that.options.defaultComponentType,
            options = parsed.options || parsed,
            playable = flock.sourceEvaluator.json.tryMakePlayable(type, options,
                that.events.onEvaluationError.fire);

        if (playable) {
            that.clearPlayable();
            that.playable = playable;
            that.events.afterEvaluated.fire(playable);
        }

        return playable;
    };


    /************************
     * JavaScript Evaluator *
     ************************/

    fluid.defaults("flock.sourceEvaluator.code", {
        gradeNames: ["flock.sourceEvaluator"],

        model: {
            source: ""
        },

        invokers: {
            parse: "{that}.applier.change(source, {arguments}.0)",
            evaluate: "flock.sourceEvaluator.code.evaluate({that}.model.source, {that})"
        }
    });

    flock.sourceEvaluator.code.tryEvaluate = function (source, onEvaluationError) {
        try {
            return eval(source); // jshint ignore: line
        } catch (e) {
            onEvaluationError(e, source);
        }
    };

    flock.sourceEvaluator.code.evaluate = function (source, that) {
        that.clearPlayable();
        var val = flock.sourceEvaluator.code.tryEvaluate(source, that.events.onEvaluationError.fire);
        if (fluid.hasGrade(val, "flock.synth") || fluid.hasGrade(val, "flock.band")) {
            that.playable = val;
        }
    };

}());
