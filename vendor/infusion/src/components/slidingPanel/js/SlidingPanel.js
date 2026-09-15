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
    /**********************
     * Sliding Panel *
     *********************/

    fluid.defaults("fluid.slidingPanel", {
        gradeNames: ["fluid.viewComponent"],
        selectors: {
            panel: ".flc-slidingPanel-panel",
            toggleButton: ".flc-slidingPanel-toggleButton",
            toggleButtonLabel: ".flc-slidingPanel-toggleButton"
        },
        strings: {
            showText: "show",
            hideText: "hide",
            panelLabel: "panel"
        },
        events: {
            onPanelHide: null,
            onPanelShow: null,
            afterPanelHide: null,
            afterPanelShow: null
        },
        listeners: {
            "onCreate.bindClick": {
                "this": "{that}.dom.toggleButton",
                "method": "on",
                "args": ["click", "{that}.togglePanel"]
            },
            "onCreate.bindModelChange": {
                listener: "{that}.applier.modelChanged.addListener",
                args: ["isShowing", "{that}.refreshView"]
            },
            "onCreate.setAriaProps": "{that}.setAriaProps",
            "onCreate.setInitialState": {
                listener: "{that}.refreshView"
            },
            "onPanelHide.setText": {
                "this": "{that}.dom.toggleButtonLabel",
                "method": "text",
                "args": ["{that}.options.strings.showText"],
                "priority": "first"
            },
            "onPanelHide.setAriaLabel": {
                "this": "{that}.dom.toggleButtonLabel",
                "method": "attr",
                "args": ["aria-label", "{that}.options.strings.showTextAriaLabel"]
            },
            "onPanelShow.setText": {
                "this": "{that}.dom.toggleButtonLabel",
                "method": "text",
                "args": ["{that}.options.strings.hideText"],
                "priority": "first"
            },
            "onPanelShow.setAriaLabel": {
                "this": "{that}.dom.toggleButtonLabel",
                "method": "attr",
                "args": ["aria-label", "{that}.options.strings.hideTextAriaLabel"]
            },
            "onPanelHide.operate": {
                listener: "{that}.operateHide"
            },
            "onPanelShow.operate": {
                listener: "{that}.operateShow"
            },
            "onCreate.setAriaStates": "{that}.setAriaStates"
        },
        members: {
            panelId: {
                expander: {
                    // create an id for panel
                    // and set that.panelId to the id value
                    funcName: "fluid.allocateSimpleId",
                    args: "{that}.dom.panel"
                }
            }
        },
        model: {
            isShowing: false
        },
        modelListeners: {
            "isShowing": {
                funcName: "{that}.setAriaStates",
                excludeSource: "init"
            }
        },
        invokers: {
            operateHide: {
                "this": "{that}.dom.panel",
                "method": "slideUp",
                "args": ["{that}.options.animationDurations.hide", "{that}.events.afterPanelHide.fire"]
            },
            operateShow: {
                "this": "{that}.dom.panel",
                "method": "slideDown",
                "args": ["{that}.options.animationDurations.show", "{that}.events.afterPanelShow.fire"]
            },
            hidePanel: {
                func: "{that}.applier.change",
                args: ["isShowing", false]
            },
            showPanel: {
                func: "{that}.applier.change",
                args: ["isShowing", true]
            },
            setAriaStates: {
                funcName: "fluid.slidingPanel.setAriaStates",
                args: ["{that}", "{that}.model.isShowing"]
            },
            setAriaProps: {
                funcName: "fluid.slidingPanel.setAriaProperties",
                args: ["{that}", "{that}.panelId"]
            },
            togglePanel: {
                funcName: "fluid.slidingPanel.togglePanel",
                args: ["{that}"]
            },
            refreshView: {
                funcName: "fluid.slidingPanel.refreshView",
                args: ["{that}"]
            }
        },
        animationDurations: {
            hide: 400,
            show: 400
        }
    });

    fluid.slidingPanel.togglePanel = function (that) {
        that.applier.change("isShowing", !that.model.isShowing);
    };

    fluid.slidingPanel.refreshView = function (that) {
        that.events[that.model.isShowing ? "onPanelShow" : "onPanelHide"].fire();
    };

    // panelId is passed in to ensure that it is evaluated before this
    // function is called.
    fluid.slidingPanel.setAriaProperties = function (that, panelId) {
        that.locate("toggleButton").attr({
            "role": "button",
            "aria-controls": panelId
        });
        that.locate("panel").attr({
            "aria-label": that.options.strings.panelLabel,
            "role": "group"
        });
    };

    fluid.slidingPanel.setAriaStates = function (that, isShowing) {
        that.locate("toggleButton").attr({
            "aria-pressed": isShowing,
            "aria-expanded": isShowing
        });
    };

})(jQuery, fluid_3_0_0);
