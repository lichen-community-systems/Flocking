/*
 * Flocking UI Select Box
 *   Copyright 2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    /**************
     * Select Box *
     **************/

    // TODO: Improve the selection handling of this component to make it
    // simpler and more model-oriented.
    fluid.defaults("flock.ui.selectBox", {
        gradeNames: ["fluid.viewComponent"],

        model: {
            /*
            Example model for a selectBox instance:
            groups: [
                {
                    name: "Cats",
                    options: [
                        {
                            id: "hugo",
                            name: "Hugo"
                        },
                        {
                            id: "sirius",
                            name: "Sirius"
                        }
                    ]
                }
            ],

            options: [
                {
                    id: "doge",
                    name: "Doge"
                }
            ],

            selection: "hugo"
            */
        },

        markup: {
            group: "<optgroup label='%label'></optgroup",
            option: "<option value='%value'>%label</option>"
        },

        invokers: {
            // TODO: This should be named refreshView;
            refreshView: "{that}.events.onRender.fire()",

            select: {
                funcName: "flock.ui.selectBox.select",
                args: ["{that}", "{arguments}.0", "{that}.container"]
            },

            handleChange: {
                funcName: "flock.ui.selectBox.handleChange",
                args: ["{that}.container", "{that}.updateSelection"]
            },

            updateSelection: {
                funcName: "flock.ui.selectBox.updateSelection",
                args: ["{arguments}.0", "{that}.container", "{that}.applier", "{that}.events.onSelect.fire"]
            }
        },

        events: {
            onSelect: null,
            onRender: null,
            afterRender: null
        },

        modelListeners: {
            groups: "{that}.refreshView()",
            options: "{that}.refreshView()"
        },

        listeners: {
            onCreate: [
                {
                    "this": "{that}.container",
                    method: "change",
                    args: ["{that}.handleChange"]
                },
                {
                    funcName: "{that}.events.onRender.fire"
                }
            ],

            onRender: [
                {
                    funcName: "flock.ui.selectBox.clearContainer",
                    args: "{that}.container"
                },
                {
                    funcName: "flock.ui.selectBox.renderGroups",
                    args: [
                        "{that}.container",
                        "{that}.model.groups",
                        "{that}.options.markup"
                    ]
                },
                {
                    funcName: "flock.ui.selectBox.renderOptions",
                    args: [
                        "{that}.container",
                        "{that}.model.options",
                        "{that}.options.markup"
                    ]
                },
                {
                    funcName: "flock.ui.selectBox.selectInitial",
                    args: "{that}"
                },
                {
                    func: "{that}.events.afterRender.fire"
                }
            ]
        }
    });

    flock.ui.selectBox.handleChange = function (container, updateSelection) {
        var id = container.val();
        updateSelection(id);
    };

    flock.ui.selectBox.updateSelection = function (id, container, applier, onSelect) {
        var selectedEl = container.find("[value='" + id + "']").eq(0),
            selection = selectedEl.data("flock-selectBox-model-binding");

        applier.change("selection", id);
        onSelect(selection);
    };

    flock.ui.selectBox.select = function (that, id, container) {
        flock.ui.selectBox.selectElement(container, id);
        that.updateSelection(id);
    };

    flock.ui.selectBox.selectElement = function (container, id) {
        // Deselect the previously-selected item.
        container.find(":selected").prop("selected", false);

        // Select the new one.
        var optionToSelect = container.find("[value='" + id + "']").eq(0);
        optionToSelect.prop("selected", true);
    };

    flock.ui.selectBox.selectFirstOption = function (that) {
        var firstOptionModel = that.model.groups && that.model.groups.options ?
            that.model.groups.options[0] : that.model.options ?
            that.model.options[0] : undefined;

        if (!firstOptionModel) {
            return;
        }

        that.select(firstOptionModel.id);
    };

    flock.ui.selectBox.selectInitial = function (that) {
        if (that.model.selection) {
            flock.ui.selectBox.selectElement(that.container, that.model.selection.id);
        } else {
            flock.ui.selectBox.selectFirstOption(that);
        }
    };

    flock.ui.selectBox.clearContainer = function (container) {
        container.empty();
    };

    flock.ui.selectBox.renderGroups = function (container, groups, markup) {
        fluid.each(groups, function (group) {
            flock.ui.selectBox.renderGroup(container, group, markup);
        });
    };

    flock.ui.selectBox.renderGroup = function (container, group, markup) {
        var renderedMarkup = fluid.stringTemplate(markup.group, {
            label: group.name
        });

        var optGroupEl = $(renderedMarkup);
        container.append(optGroupEl);
        flock.ui.selectBox.renderOptions(optGroupEl, group.options, markup);
    };

    flock.ui.selectBox.renderOptions = function (container, options, markup) {
        fluid.each(options, function (option) {
            flock.ui.selectBox.renderOption(container, option, markup);
        });
    };

    flock.ui.selectBox.renderOption = function (container, option, markup) {
        var renderedMarkup = fluid.stringTemplate(markup.option, {
            label: option.name,
            value: option.id
        });

        var optionEl = $(renderedMarkup);
        container.append(optionEl);
        optionEl.data("flock-selectBox-model-binding", option);
    };

}());
