/*
 * Flocking CodeMirror Editor
 *   Copyright 2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    /**********************
     * Code Mirror Editor *
     **********************/

    fluid.defaults("flock.ui.codeMirror", {
        gradeNames: ["fluid.modelComponent", "fluid.lintingCodeMirror"],

        model: {
            lastChange: {}
        },

        codeMirrorOpts: [
            "lineNumbers",
            "mode",
            "gutters",
            "autoCloseBrackets",
            "tabSize",
            "indentUnit",
            "theme",
            "smartIndent",
            "matchBrackets",
            "lineWrapping",
            "keyMap",
            "extraKeys"
        ],

        mode: "application/json",
        autoCloseBrackets: true,
        matchBrackets: true,
        smartIndent: true,
        theme: "flockingcm",
        indentUnit: 4,
        tabSize: 4,
        lineNumbers: true,
        keyMap: "sublime",
        gutters: ["CodeMirror-lint-markers"],
        extraKeys: {
            "Cmd-/": "toggleComment"
        },

        changeEventDelay: 250,

        invokers: {
            createEditor: "CodeMirror({that}.container.0, {arguments}.0)",
            getSource: "flock.ui.codeMirror.getSource({that})"
        },

        events: {
            onValidChange: null
        },

        listeners: {
            onValidatedContentChange: {
                funcName: "flock.ui.codeMirror.throttleContentValidation",
                args: [
                    "{arguments}.1", // Is valid?
                    "{that}"
                ]
            }
        }
    });

    flock.ui.codeMirror.getSource = function (that) {
        // TODO: Why is this needed at all, and if it is,
        // why isn't it upstream?
        if (!that.editor || !that.editor.getDoc()) {
            return;
        }

        return that.getContent();
    };

    flock.ui.codeMirror.throttleContentValidation = function (isValid, that) {
        if (!isValid) {
            return;
        }

        if (that.model.lastChange.id) {
            clearTimeout(that.model.lastChange.id);
        }

        var id = setTimeout(function () {
            that.events.onValidChange.fire();
            that.applier.change("lastChange", {});
        }, that.options.changeEventDelay);

        that.applier.change("lastChange", {
            id: id
        });
    };
}());
