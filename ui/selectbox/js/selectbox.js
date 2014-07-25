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

    fluid.setLogging(true);

    var $ = fluid.registerNamespace("jQuery");

    /**************
     * Select Box *
     **************/

    fluid.defaults("flock.ui.selectBox", {
        gradeNames: ["fluid.viewComponent", "autoInit"],

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
            render: {
                funcName: "flock.ui.selectBox.render",
                args: [
                    "{that}.container",
                    "{that}.model",
                    "{that}.applier",
                    "{that}.options.markup",
                    "{that}.events.afterRender.fire"
                ]
            },

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
            afterRender: null
        },

        listeners: {
            onCreate: [
                {
                    "this": "{that}.container",
                    method: "change",
                    args: ["{that}.handleChange"]
                },
                {
                    funcName: "{that}.render"
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
            selectedDemo = selectedEl.data("flock-selectBox-model-binding");

        applier.requestChange("selection", id);
        onSelect(selectedDemo);
    };

    flock.ui.selectBox.select = function (that, id, container) {
        var optionToSelect = container.find("[value='" + id + "']").eq(0);
        container.find("option").removeAttr("selected");
        optionToSelect.attr("selected", "selected");
        that.updateSelection(id);
    };

    flock.ui.selectBox.render = function (container, model, applier, markup, afterRender) {
        if (model.groups) {
            flock.ui.selectBox.render.groups(container, model.groups, markup);
        }

        if (model.options) {
            flock.ui.selectBox.render.options(container, model.options, markup);
        }

        if (!model.selection) {
            var defaultSelection = (model.groups && model.groups.options) ? model.group.options[0] :
                model.options ? model.options : undefined;

            if (defaultSelection) {
                applier.requestChange("selection", defaultSelection);
            }
        }

        afterRender();
    };

    flock.ui.selectBox.render.groups = function (container, groups, markup) {
        fluid.each(groups, function (group) {
            flock.ui.selectBox.render.group(container, group, markup);
        });
    };

    flock.ui.selectBox.render.group = function (container, group, markup) {
        var renderedMarkup = fluid.stringTemplate(markup.group, {
            label: group.name
        });

        var optGroupEl = $(renderedMarkup);
        container.append(optGroupEl);
        flock.ui.selectBox.render.options(optGroupEl, group.options, markup);
    };

    flock.ui.selectBox.render.options = function (container, options, markup) {
        fluid.each(options, function (option) {
            flock.ui.selectBox.render.option(container, option, markup);
        });
    };

    flock.ui.selectBox.render.option = function (container, option, markup) {
        var renderedMarkup = fluid.stringTemplate(markup.option, {
            label: option.name,
            value: option.id
        });

        var optionEl = $(renderedMarkup);
        container.append(optionEl);
        optionEl.data("flock-selectBox-model-binding", option);
    };


    fluid.defaults("flock.ui.midiPortSelector", {
        gradeNames: ["flock.ui.selectBox", "autoInit"],

        sysex: false,

        model: {
            options: [],
            selection: null
        },

        invokers: {
            refreshPorts: {
                funcName: "flock.ui.midiPortSelector.refreshPorts",
                args: ["{that}.applier", "{arguments}.0", "{that}.options.selectionDefaults"]
            }
        },

        events: {
            onAccessGranted: null,
            onAccessError: null
        },

        modelListeners: {
            "*": {
                func: "{that}.render"
            }
        },

        listeners: {
            onCreate: {
                funcName: "flock.midi.requestAccess",
                args: [
                    "{that}.options.sysex",
                    "{that}.events.onAccessGranted.fire",
                    "{that}.events.onAccessError.fire"
                ]
            },

            onAccessGranted: {
                func: "{that}.refreshPorts"
            },

            onAccessError: {
                func: "fluid.log",
                args: [fluid.logLevel.WARN, "{arguments}.0"]
            }
        },

        selectionDefaults: {
            prompt: {
                id: "choose",
                name: "Select a MIDI input..."
            },

            noPorts: {
                id: "none",
                name: "No MIDI inputs found."
            }
        }
    });

    flock.ui.midiPortSelector.refreshPorts = function (applier, access, selectionDefaults) {
        var ports = flock.midi.getPorts(access);

        var portsModel = fluid.transform(ports.inputs, function (port) {
            return {
                id: port.id,
                name: port.manufacturer + " " + port.name
            }
        });

        var firstOption = portsModel.length > 0 ? selectionDefaults.prompt : selectionDefaults.noPorts;
        portsModel.unshift(firstOption);

        // Update the model with the new options.
        applier.change("options", []);
        applier.change("options", portsModel);
    };

}());
