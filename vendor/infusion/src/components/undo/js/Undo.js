/*
Copyright The Infusion copyright holders
See the AUTHORS.md file at the top-level directory of this distribution and at
https://github.com/fluid-project/infusion/raw/main/AUTHORS.md.

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/main/Infusion-LICENSE.txt
*/

(function ($, fluid) {
    "use strict";

    fluid.registerNamespace("fluid.undo");

    // The three states of the undo component
    fluid.undo.STATE_INITIAL = "state_initial";
    fluid.undo.STATE_CHANGED = "state_changed";
    fluid.undo.STATE_REVERTED = "state_reverted";

    fluid.undo.defaultRenderer = function (that, targetContainer) {
        var str = that.options.strings;
        var markup = "<span class='flc-undo'>" +
            "<a href='#' class='flc-undo-undoControl'>" + str.undo + "</a>" +
            "<a href='#' class='flc-undo-redoControl'>" + str.redo + "</a>" +
            "</span>";
        var markupNode = $(markup).attr({
            "role": "region",
            "aria-live": "polite",
            "aria-relevant": "all"
        });
        targetContainer.append(markupNode);
        return markupNode;
    };

    fluid.undo.refreshView = function (that) {
        if (that.state === fluid.undo.STATE_INITIAL) {
            that.locate("undoContainer").hide();
            that.locate("redoContainer").hide();
        } else if (that.state === fluid.undo.STATE_CHANGED) {
            that.locate("undoContainer").show();
            that.locate("redoContainer").hide();
        } else if (that.state === fluid.undo.STATE_REVERTED) {
            that.locate("undoContainer").hide();
            that.locate("redoContainer").show();
        }
    };

    fluid.undo.undoControlClick = function (that) {
        if (that.state !== fluid.undo.STATE_REVERTED) {
            fluid.model.copyModel(that.extremalModel, that.component.model);
            that.component.updateModel(that.initialModel, that);
            that.state = fluid.undo.STATE_REVERTED;
            fluid.undo.refreshView(that);
            that.locate("redoControl").trigger("focus");
        }
        return false;
    };

    fluid.undo.redoControlClick = function (that) {
        if (that.state !== fluid.undo.STATE_CHANGED) {
            that.component.updateModel(that.extremalModel, that);
            that.state = fluid.undo.STATE_CHANGED;
            fluid.undo.refreshView(that);
            that.locate("undoControl").trigger("focus");
        }
        return false;
    };

    fluid.undo.modelChanged = function (that, newModel, oldModel, source) {
        if (source !== that) {
            that.state = fluid.undo.STATE_CHANGED;
            fluid.model.copyModel(that.initialModel, oldModel);
            fluid.undo.refreshView(that);
        }
    };

    fluid.undo.copyInitialModel = function (that) {
        fluid.model.copyModel(that.initialModel, that.component.model);
        fluid.model.copyModel(that.extremalModel, that.component.model);
    };

    fluid.undo.setTabindex = function (that) {
        fluid.tabindex(that.locate("undoControl"), 0);
        fluid.tabindex(that.locate("redoControl"), 0);
    };

    /**
     * Decorates a target component with the function of "undoability". This component is intended to be attached as a
     * subcomponent to the target component, which will bear a grade of "fluid.undoable"
     *
     * @param {Object} component - a "model-bearing" standard Fluid component to receive the "undo" functionality
     * @param {Object} options - (optional) a collection of options settings
     */
    fluid.defaults("fluid.undo", {
        gradeNames: ["fluid.component"],
        members: {
            state: fluid.undo.STATE_INITIAL,
            initialModel: {},
            extremalModel: {},
            component: "{fluid.undoable}",
            container: {
                expander: {
                    func: "{that}.options.renderer",
                    args: ["{that}", "{that}.component.container"]
                }
            },
            dom: {
                expander: {
                    funcName: "fluid.initDomBinder",
                    args: ["{that}", "{that}.options.selectors"]
                }
            }
        },
        invokers: {
            undoControlClick: {
                funcName: "fluid.undo.undoControlClick",
                args: "{that}"
            },
            redoControlClick: {
                funcName: "fluid.undo.redoControlClick",
                args: "{that}"
            }
        },
        listeners: {
            "onCreate.copyInitialModel": {
                funcName: "fluid.undo.copyInitialModel",
                priority: "before:refreshView"
            },
            "onCreate.setTabindex": "fluid.undo.setTabindex",
            "onCreate.refreshView": "fluid.undo.refreshView",
            "onCreate.bindUndoClick": {
                "this": "{that}.dom.undoControl",
                method: "on",
                args: ["click", "{that}.undoControlClick"]
            },
            "onCreate.bindRedoClick": {
                "this": "{that}.dom.redoControl",
                method: "on",
                args: ["click", "{that}.redoControlClick"]
            },
            "{fluid.undoable}.events.modelChanged": {
                funcName: "fluid.undo.modelChanged",
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
            }
        },
        selectors: {
            undoContainer: ".flc-undo-undoControl",
            undoControl: ".flc-undo-undoControl",
            redoContainer: ".flc-undo-redoControl",
            redoControl: ".flc-undo-redoControl"
        },

        strings: {
            undo: "undo edit",
            redo: "redo edit"
        },

        renderer: fluid.undo.defaultRenderer
    });

    // An uninstantiable grade expressing the contract of the "fluid.undoable" grade
    fluid.defaults("fluid.undoable", {
        gradeNames: ["fluid.modelComponent"],
        invokers: {
            updateModel: {} // will be implemented by concrete grades
        },
        events: {
            modelChanged: null
        }
    });

    // Backward compatibility for users of Infusion 1.4.x API
    fluid.defaults("fluid.undoDecorator", {
        gradeNames: ["fluid.undo"]
    });

})(jQuery, fluid_3_0_0);
