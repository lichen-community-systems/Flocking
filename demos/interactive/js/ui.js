/*
 * Flocking UI Components
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

    /**********************
     * Code Mirror Editor *
     **********************/

    fluid.defaults("flock.ui.codeMirror", {
        gradeNames: ["fluid.lintingCodeMirror", "autoInit"],

        codeMirrorOpts:[
            "lineNumbers",
            "mode",
            "gutters",
            "autoCloseBrackets",
            "tabSize",
            "indentUnit",
            "theme",
            "smartIndent",
            "matchBrackets"
        ],

        mode: "application/json",
        autoCloseBrackets: true,
        matchBrackets: true,
        smartIndent: true,
        theme: "flockingcm",
        indentUnit: 4,
        tabSize: 4,
        lineNumbers: true,
        gutters: ["CodeMirror-lint-markers"],

        invokers: {
            createEditor: "CodeMirror({that}.container.0, {arguments}.0)"
        }
    });


    fluid.defaults("flock.ui.toggleButton", {
        gradeNames: ["fluid.viewComponent", "autoInit"],

        selfRender: false,

        model: {
            isEnabled: false
        },

        invokers: {
            toggle: {
                funcName: "flock.ui.toggleButton.toggleModelState",
                args: ["{that}.model", "{that}.applier"]
            },

            enable: {
                func: "{that}.applier.requestChange", //"{that}.events.onEnabled.fire"
                args: ["isEnabled", true]
            },

            disable: {
                func: "{that}.applier.requestChange", //"{that}.events.onDisabled.fire"
                args: ["isEnabled", false]
            },

            refreshView: {
                funcName: "flock.ui.toggleButton.refreshView",
                args: ["{that}.model.isEnabled", "{that}.events.onEnabled.fire", "{that}.events.onDisabled.fire"]
            }
        },

        events: {
            onEnabled: null,
            onDisabled: null
        },

        listeners: {
            onCreate: [
                {
                    funcName: "flock.ui.toggleButton.render",
                    args: ["{that}"]
                },

                {
                    "this": "{that}.container",
                    method: "click",
                    args: "{that}.toggle"
                },
                {
                    func: "{that}.refreshView"
                }
            ],

            onEnabled: [
                {
                    "this": "{that}.container",
                    method: "addClass",
                    args: ["{that}.options.styles.enabled"]
                },
                {
                    "this": "{that}.container",
                    method: "removeClass",
                    args: ["{that}.options.styles.disabled"]
                },
                {
                    "this": "{that}.container",
                    method: "html",
                    args: "{that}.options.strings.enabled"
                }
            ],

            onDisabled: [
                {
                    "this": "{that}.container",
                    method: "addClass",
                    args: ["{that}.options.styles.disabled"]
                },
                {
                    "this": "{that}.container",
                    method: "removeClass",
                    args: ["{that}.options.styles.enabled"]
                },
                {
                    "this": "{that}.container",
                    method: "html",
                    args: "{that}.options.strings.disabled"
                }
            ]
        },

        modelListeners: {
            "isEnabled": {
                func: "{that}.refreshView"
            }
        },

        strings: {
            enabled: "On",
            disabled: "Off",
        },

        markup: {
            button: "<button>%label</button>"
        },

        styles: {
            enabled: "on",
            disabled: "off"
        }
    });

    flock.ui.toggleButton.render = function (that) {
        if (!that.options.selfRender) {
            return;
        }

        // TODO: This is all very shady.
        var renderedMarkup = fluid.stringTemplate(that.options.markup.button, {
            label: that.options.strings.disabled
        });

        var button = $(renderedMarkup);
        that.container.append(button);
        that.container = button;
    };

    flock.ui.toggleButton.toggleModelState = function (model, applier) {
        applier.requestChange("isEnabled", !model.isEnabled);
    };

    flock.ui.toggleButton.refreshView = function (isEnabled, onEnabled, onDisabled) {
        if (isEnabled) {
            onEnabled();
        } else {
            onDisabled();
        }
    };


    /***************
     * Play Button *
     ***************/

    fluid.defaults("flock.ui.playButton", {
        gradeNames: ["flock.ui.toggleButton", "autoInit"],

        invokers: {
            play: {
                func: "{that}.enable"
            },

            pause: {
                func: "{that}.disable"
            }
        },

        events: {
            onPlay: "{that}.events.onEnabled",
            onPause: "{that}.events.onDisabled"
        },

        strings: {
            enabled: "Pause",
            disabled: "Play"
        },

        styles: {
            enabled: "playing",
            disabled: "paused"
        }
    });

    fluid.defaults("flock.ui.enviroPlayButton", {
        gradeNames: ["flock.ui.playButton", "autoInit"],

        listeners: {
            onEnabled: {
                funcName: "flock.enviro.shared.play"
            },
            onDisabled: {
                funcName: "flock.enviro.shared.reset"
            }
        }
    });

    /**************
     * Select Box *
     **************/

    fluid.defaults("flock.ui.selectBox", {
        gradeNames: ["fluid.viewComponent", "autoInit"],

        model: {
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

            options: [],

            selection: "hugo"
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
            var defaultSelectedOption = model.groups ? model.groups.options[0] : model.options[0];

            if (defaultSelectedOption) {
                applier.requestChange("selection", defaultSelectedOption);
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
}());
